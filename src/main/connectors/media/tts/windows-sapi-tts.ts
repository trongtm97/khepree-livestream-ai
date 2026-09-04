/**
 * Windows SAPI (System.Speech) — local, free OS TTS.
 * Suitable for commercial local preview on the operator machine.
 * No cloud API; no edge-tts (commercial redistribution ToS unclear).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RuntimeHealth } from "../../../../shared/live-types";
import type { TtsVoiceInfo } from "../../../../shared/media-contracts";
import { MockTtsProvider } from "./mock-tts";
import type { TtsProvider, TtsSynthesizeInput, TtsSynthesizeResult } from "./types";

const execFileAsync = promisify(execFile);

function rateToSapi(rate?: number): number {
  // Map relative 0.5–2 → SAPI -10..10
  const r = typeof rate === "number" && Number.isFinite(rate) ? rate : 1;
  const clamped = Math.min(2, Math.max(0.5, r));
  return Math.round((clamped - 1) * 10);
}

function powershell(script: string, timeoutMs = 30_000): Promise<string> {
  return execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { timeout: timeoutMs, windowsHide: true, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
  ).then((r) => String(r.stdout ?? ""));
}

function escapePs(s: string): string {
  return s.replace(/'/g, "''");
}

export class WindowsSapiTtsProvider implements TtsProvider {
  readonly id = "windows-sapi" as const;
  private cancelled = false;

  async health(): Promise<RuntimeHealth> {
    if (process.platform !== "win32") {
      return {
        component: "tts:windows-sapi",
        status: "DOWN",
        message: "Windows SAPI only available on win32",
        checkedAt: new Date().toISOString()
      };
    }
    try {
      const voices = await this.listVoices();
      return {
        component: "tts:windows-sapi",
        status: voices.length > 0 ? "OK" : "DEGRADED",
        message:
          voices.length > 0
            ? `SAPI ready (${voices.length} voices)`
            : "SAPI loaded but no voices found",
        checkedAt: new Date().toISOString()
      };
    } catch (err) {
      return {
        component: "tts:windows-sapi",
        status: "DOWN",
        message: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString()
      };
    }
  }

  async listVoices(): Promise<TtsVoiceInfo[]> {
    if (process.platform !== "win32") return [];
    const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.GetInstalledVoices() | ForEach-Object {
  $v = $_.VoiceInfo
  Write-Output ($v.Name + '|' + $v.Culture.Name + '|' + $v.Gender)
}
$s.Dispose()
`.trim();
    const out = await powershell(script, 15_000);
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, locale, gender] = line.split("|");
        return {
          id: name ?? line,
          name: name ?? line,
          locale: locale || undefined,
          gender: gender || undefined
        };
      });
  }

  async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeResult> {
    if (process.platform !== "win32") {
      throw new Error("TTS_UNAVAILABLE:windows-sapi requires win32");
    }
    this.cancelled = false;
    const text = input.text.trim();
    if (!text) throw new Error("TTS_EMPTY_TEXT");
    const voice = input.voiceId ? escapePs(input.voiceId) : "";
    const out = escapePs(input.outPath);
    const rate = rateToSapi(input.rate);
    const spoken = escapePs(text);
    const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = ${rate}
${voice ? `try { $s.SelectVoice('${voice}') } catch {}` : ""}
$s.SetOutputToWaveFile('${out}')
$s.Speak('${spoken}')
$s.Dispose()
`.trim();
    await powershell(script, 60_000);
    if (this.cancelled) throw new Error("TTS_CANCELLED");
    return { path: input.outPath, format: "wav" };
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
  }
}

export function createDefaultTtsProvider(): TtsProvider {
  if (process.platform === "win32") return new WindowsSapiTtsProvider();
  return new MockTtsProvider();
}
