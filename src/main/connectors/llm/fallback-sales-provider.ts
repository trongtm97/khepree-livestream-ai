import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ActionProposal, LiveState, RuntimeHealth } from "../../../shared/live-types";
import type { AppLocale } from "../../../shared/locale";
import {
  SCRIPT_CATEGORIES,
  substituteScriptLine,
  type SalesScriptPack,
  type ScriptCategory
} from "../../../shared/sales-script";
import type { LlmContext, LlmProvider } from "./types";

export type FallbackSalesProviderOptions = {
  appRoot: string;
  getLocale: () => AppLocale;
};

/**
 * Config-driven script brain — keeps livestream moving when Gemini is down.
 * Lines come from resources/sales-scripts; never invent product facts.
 */
export class FallbackSalesProvider implements LlmProvider {
  private packs = new Map<string, SalesScriptPack>();
  private cursor = new Map<string, number>();
  private lastError?: string;

  constructor(private readonly opts: FallbackSalesProviderOptions) {
    this.reload();
  }

  reload(): void {
    this.packs.clear();
    for (const locale of ["vi", "en"] as const) {
      const file = path.join(this.opts.appRoot, "resources", "sales-scripts", `${locale}.json`);
      try {
        const raw = JSON.parse(fs.readFileSync(file, "utf8")) as SalesScriptPack;
        this.packs.set(locale, raw);
      } catch (error) {
        this.lastError = `Failed to load ${locale} script pack: ${String(error)}`;
      }
    }
  }

  async health(): Promise<RuntimeHealth> {
    const locale = this.opts.getLocale();
    const pack = this.packs.get(locale) ?? this.packs.get("en");
    return {
      component: "llm:fallback-script",
      status: pack ? "OK" : "DOWN",
      message: pack
        ? `Fallback script pack ready (${locale})`
        : this.lastError ?? "Script pack missing",
      checkedAt: new Date().toISOString()
    };
  }

  async listModels(): Promise<string[]> {
    return ["fallback-sales-script"];
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    const category = resolveScriptCategory(context);
    const speech = this.pickSpeech(category, context);
    if (!speech) {
      return {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        eventId: context.event.id,
        kind: "ASK_OPERATOR",
        confidence: 0.4,
        reason: `Fallback script: no speakable line for ${category} (missing Product DNA vars or empty pack).`,
        riskTags: ["fallback_script", "missing_product_fact"],
        nextState: "COMMENT_REPLY",
        metadata: { provider: "fallback-script", category }
      };
    }

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: context.event.id,
      kind: category === "THANK" ? "THANK_USER" : "SPEAK",
      speech,
      confidence: 0.55,
      reason: `Fallback sales script (${category}) — Gemini unavailable.`,
      riskTags: ["fallback_script"],
      nextState: mapCategoryToNextState(category, context.currentState),
      metadata: { provider: "fallback-script", category }
    };
  }

  private pickSpeech(category: ScriptCategory, context: LlmContext): string | null {
    const locale = this.opts.getLocale();
    const pack = this.packs.get(locale) ?? this.packs.get("en");
    const lines = pack?.categories[category] ?? [];
    if (lines.length === 0) return null;

    const key = `${locale}:${category}`;
    const start = this.cursor.get(key) ?? 0;
    for (let i = 0; i < lines.length; i += 1) {
      const idx = (start + i) % lines.length;
      const template = lines[idx]!;
      const speech = substituteScriptLine(template, context.product);
      if (speech) {
        this.cursor.set(key, (idx + 1) % lines.length);
        return speech;
      }
    }
    return null;
  }
}

export function resolveScriptCategory(context: LlmContext): ScriptCategory {
  const event = context.event;
  if (event.type === "ORDER_ACTIVITY") return "ORDER_REACTION";

  if (event.type === "COMMENT") {
    const text = event.text ?? "";
    if (/\b(cảm ơn|cam on|thank|thanks)\b/i.test(text)) return "THANK";
    if (/\b(giá|price|bao nhiêu)\b/i.test(text)) return "PRICE";
    if (/\b(mua|chốt|order|buy)\b/i.test(text)) return "CTA";
    return "GENERIC_REPLY";
  }

  return stateToCategory(context.currentState);
}

function stateToCategory(state: LiveState): ScriptCategory {
  switch (state) {
    case "WELCOME":
      return "WELCOME";
    case "PRODUCT_INTRO":
      return "PRODUCT_INTRO";
    case "FEATURE":
      return "FEATURE";
    case "BENEFIT":
      return "BENEFIT";
    case "PRICE":
      return "PRICE";
    case "CTA":
      return "CTA";
    case "IDLE":
    case "PAUSED":
      return "IDLE";
    case "ORDER_REACTION":
      return "ORDER_REACTION";
    case "COMMENT_REPLY":
      return "GENERIC_REPLY";
    default:
      return SCRIPT_CATEGORIES.includes(state as ScriptCategory)
        ? (state as ScriptCategory)
        : "TRANSITION";
  }
}

function mapCategoryToNextState(category: ScriptCategory, current: LiveState): LiveState {
  switch (category) {
    case "WELCOME":
      return "WELCOME";
    case "PRODUCT_INTRO":
      return "PRODUCT_INTRO";
    case "FEATURE":
      return "FEATURE";
    case "BENEFIT":
      return "BENEFIT";
    case "PRICE":
      return "PRICE";
    case "CTA":
      return "CTA";
    case "ORDER_REACTION":
      return "ORDER_REACTION";
    case "THANK":
    case "GENERIC_REPLY":
      return "COMMENT_REPLY";
    case "IDLE":
      return "IDLE";
    case "TRANSITION":
    default:
      return current === "IDLE" ? "PRODUCT_INTRO" : current;
  }
}
