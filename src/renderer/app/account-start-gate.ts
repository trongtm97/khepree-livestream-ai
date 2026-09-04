/**
 * Per-account blockers for start — plain operator reasons.
 */
import type { AccountLiveSnapshot } from "../../shared/live-types";
import {
  isOutputModeReady,
  normalizeLiveOutputMode
} from "../../shared/live-output-mode";

export type AccountStartBlock =
  | "no_product"
  | "tiktok_disconnected"
  | "audio_routing"
  | "output_mode";

export function accountStartBlock(live: AccountLiveSnapshot): AccountStartBlock | null {
  if (!live.currentProductId) return "no_product";
  if (!live.tiktok?.connected) return "tiktok_disconnected";
  const mode = normalizeLiveOutputMode(live.outputMode);
  if (live.mediaCapabilities && !isOutputModeReady(mode, live.mediaCapabilities)) {
    return "output_mode";
  }
  // Legacy audio-routing field (pre-capability) — still honor if present.
  if (live.audioRouting?.mode === "voice-stream" && !live.audioRouting.ready) {
    if (mode === "VOICE_ONLY" || mode === "AVATAR_LIVE") return "audio_routing";
  }
  return null;
}

export function formatLiveElapsed(startedAtIso: string | undefined, nowMs: number): string | null {
  if (!startedAtIso) return null;
  const start = Date.parse(startedAtIso);
  if (!Number.isFinite(start) || start > nowMs) return null;
  const totalSec = Math.floor((nowMs - start) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** ponytail: assert demo — fails if elapsed formatting breaks. */
if (typeof process !== "undefined" && process.argv[1]?.includes("account-start-gate")) {
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  const a = formatLiveElapsed("2026-01-01T00:00:00.000Z", base + 85_000);
  if (a !== "01:25") throw new Error(`expected 01:25 got ${a}`);
  const b = formatLiveElapsed("2026-01-01T00:00:00.000Z", base + 3_661_000);
  if (b !== "01:01:01") throw new Error(`expected 01:01:01 got ${b}`);
  if (formatLiveElapsed(undefined, base) !== null) throw new Error("undefined start");
  console.log("account-start-gate ok");
}
