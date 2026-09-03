import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ActionProposal, RuntimeHealth } from "../../../shared/live-types";
import { HttpWorkerProcess } from "../../workers/http-worker-process";
import type { LlmContext, LlmProvider } from "./types";

function extractJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export class GeminiWorkerProvider implements LlmProvider {
  private readonly worker: HttpWorkerProcess;

  constructor(appRoot: string, pythonExecutable = "python", startupTimeoutMs = 20000) {
    this.worker = new HttpWorkerProcess({
      name: "gemini-worker",
      scriptPath: path.join(appRoot, "workers", "gemini_worker", "app.py"),
      pythonExecutable,
      startupTimeoutMs
    });
  }

  async start(): Promise<void> {
    await this.worker.start();
    const res = await this.worker.request("/v1/init", {
      method: "POST",
      body: JSON.stringify({ authMode: "browser" })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini init failed: ${body}`);
    }
  }

  async stop(): Promise<void> {
    await this.worker.stop();
  }

  async health(): Promise<RuntimeHealth> {
    const startedAt = Date.now();
    try {
      const res = await this.worker.request("/health", { method: "GET" });
      const body = await res.json() as any;
      return {
        component: "llm:gemini-web",
        status: res.ok && body.ready ? "OK" : "DEGRADED",
        message: body.message ?? "Gemini worker",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        component: "llm:gemini-web",
        status: "DOWN",
        message: String(error),
        checkedAt: new Date().toISOString()
      };
    }
  }

  async listModels(): Promise<string[]> {
    const res = await this.worker.request("/v1/models", { method: "GET" });
    if (!res.ok) return [];
    const body = await res.json() as any;
    return Array.isArray(body.models) ? body.models.map((m: any) => String(m.name ?? m)) : [];
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    const prompt = buildPrompt(context);
    const res = await this.worker.request("/v1/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        temporary: true
      })
    });
    if (!res.ok) throw new Error(`Gemini generation failed: ${await res.text()}`);
    const body = await res.json() as any;
    const parsed = extractJsonObject(String(body.text ?? "")) as any;

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: context.event.id,
      kind: parsed.kind ?? "ASK_OPERATOR",
      speech: typeof parsed.speech === "string" ? parsed.speech : undefined,
      scene: typeof parsed.scene === "string" ? parsed.scene : undefined,
      productRef: typeof parsed.productRef === "string" ? parsed.productRef : undefined,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
      reason: String(parsed.reason ?? "Gemini proposal"),
      riskTags: Array.isArray(parsed.riskTags) ? parsed.riskTags.map(String) : [],
      nextState: parsed.nextState,
      metadata: { provider: "gemini-web" }
    };
  }
}

function buildPrompt(context: LlmContext): string {
  return [
    "You are the sales brain inside Khepree Livestream AI.",
    "Return ONE JSON object only. Do not use markdown.",
    'Schema: {"kind":"SPEAK|SET_SCENE|PIN_PRODUCT|THANK_USER|ASK_OPERATOR|IGNORE","speech":"string optional","scene":"string optional","productRef":"string optional","confidence":0.0,"reason":"short string","riskTags":["string"],"nextState":"COMMENT_REPLY|ORDER_REACTION|CTA|PRODUCT_INTRO|FEATURE|BENEFIT|PRICE|OBJECTION"}',
    "Never invent price, stock, size, shipping, warranty or regulated claims.",
    `CURRENT_STATE=${context.currentState}`,
    `EVENT=${JSON.stringify(context.event)}`,
    `PRODUCT_DNA=${JSON.stringify(context.product ?? null)}`,
    `RECENT_SPEECH=${JSON.stringify(context.recentSpeech.slice(-8))}`,
    "If the required fact is absent, use ASK_OPERATOR or a safe clarification rather than inventing it."
  ].join("\n");
}
