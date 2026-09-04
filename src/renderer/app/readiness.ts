import type { AppSnapshot } from "../../shared/ipc";
import {
  isOutputModeReady,
  missingCapabilitiesForMode,
  normalizeLiveOutputMode,
  outputModeRequirements,
  type MediaCapabilityKey
} from "../../shared/live-output-mode";
import type { TranslateFn } from "../i18n";
import type { AppTab } from "./types";

/** Internal severity codes — UI always shows translated labels. */
export type ReadinessSeverity = "READY" | "WARNING" | "BLOCKING" | "OPTIONAL";

/** CSS / chip tone derived from severity. */
export type ReadinessTone = "ready" | "warn" | "blocked" | "optional";

export type ReadinessCta = {
  label: string;
  tab: AppTab;
};

export type ReadinessItem = {
  id: string;
  label: string;
  detail: string;
  severity: ReadinessSeverity;
  tone: ReadinessTone;
  ready: boolean;
  /** Present when the item needs operator action. */
  cta?: ReadinessCta;
};

export type OverallReadiness = {
  severity: "READY" | "WARNING" | "BLOCKING";
  tone: ReadinessTone;
  label: string;
  detail: string;
  items: ReadinessItem[];
  readyCount: number;
  total: number;
  blockingCount: number;
  warningCount: number;
  canStartLive: boolean;
  /** Seller-facing reason when start is blocked (never empty when !canStartLive). */
  startBlockedReason: string;
  /** @deprecated use canStartLive */
  canStartLiveAssist: boolean;
};

function toneOf(severity: ReadinessSeverity): ReadinessTone {
  if (severity === "READY") return "ready";
  if (severity === "WARNING") return "warn";
  if (severity === "OPTIONAL") return "optional";
  return "blocked";
}

function isKhepreeReady(snapshot: AppSnapshot): boolean {
  return snapshot.khepree.status === "ACTIVE";
}

function isGeminiReady(snapshot: AppSnapshot): boolean {
  const phase = snapshot.gemini?.phase;
  return phase === "READY" || phase === "SLOW";
}

function isGeminiStartAllowed(snapshot: AppSnapshot): boolean {
  return (
    isGeminiReady(snapshot) ||
    Boolean(snapshot.gemini?.demoModeAcknowledged) ||
    Boolean(snapshot.gemini?.usingFallbackScript) ||
    snapshot.gemini?.phase === "FALLBACK_SCRIPT"
  );
}

function isTikTokReady(snapshot: AppSnapshot): boolean {
  const tiktok = snapshot.health.find((h) => h.component === "tiktok:tiktoklive");
  return Boolean(tiktok && tiktok.status === "OK" && !tiktok.component.includes("mock"));
}

function item(
  partial: Omit<ReadinessItem, "tone"> & { severity: ReadinessSeverity }
): ReadinessItem {
  return { ...partial, tone: toneOf(partial.severity) };
}

function capabilityLabel(key: MediaCapabilityKey, t: TranslateFn): string {
  switch (key) {
    case "voiceReady":
      return t("overview.check.cap.voice");
    case "audioRouteReady":
      return t("overview.check.cap.audio");
    case "avatarReady":
      return t("overview.check.cap.avatar");
    case "videoRouteReady":
      return t("overview.check.cap.video");
  }
}

function capabilityDetail(key: MediaCapabilityKey, ready: boolean, t: TranslateFn): string {
  if (ready) {
    switch (key) {
      case "voiceReady":
        return t("overview.check.cap.voice.ok");
      case "audioRouteReady":
        return t("overview.check.cap.audio.ok");
      case "avatarReady":
        return t("overview.check.cap.avatar.ok");
      case "videoRouteReady":
        return t("overview.check.cap.video.ok");
    }
  }
  switch (key) {
    case "voiceReady":
      return t("overview.check.cap.voice.no");
    case "audioRouteReady":
      return t("overview.check.cap.audio.no");
    case "avatarReady":
      return t("overview.check.cap.avatar.no");
    case "videoRouteReady":
      return t("overview.check.cap.video.no");
  }
}

export function buildReadiness(snapshot: AppSnapshot, t: TranslateFn): OverallReadiness {
  const productCount = snapshot.products.length;
  const khepreeOk = isKhepreeReady(snapshot);
  const geminiOk = isGeminiReady(snapshot);
  const geminiStartOk = isGeminiStartAllowed(snapshot);
  const tiktokOk = isTikTokReady(snapshot);
  const productsOk = productCount > 0;

  const focused =
    snapshot.lives.find((l) => l.accountId === snapshot.focusedAccountId) ??
    snapshot.lives[0];
  const outputMode = normalizeLiveOutputMode(focused?.outputMode);
  const caps = focused?.mediaCapabilities ?? {
    voiceReady: true,
    audioRouteReady: false,
    avatarReady: false,
    videoRouteReady: false
  };
  const modeReady = isOutputModeReady(outputMode, caps);
  const missing = missingCapabilitiesForMode(outputMode, caps);
  const need = outputModeRequirements(outputMode);

  const items: ReadinessItem[] = [
    item({
      id: "khepree",
      label: t("overview.check.khepree"),
      detail: khepreeOk ? t("overview.check.khepree.ok") : t("overview.check.khepree.no"),
      severity: khepreeOk ? "READY" : "BLOCKING",
      ready: khepreeOk,
      cta: khepreeOk ? undefined : { label: t("overview.cta.login"), tab: "connections" }
    }),
    item({
      id: "gemini",
      label: t("overview.check.gemini"),
      detail: geminiOk
        ? t("overview.check.gemini.ok")
        : snapshot.gemini?.usingFallbackScript || snapshot.gemini?.phase === "FALLBACK_SCRIPT"
          ? t("overview.check.gemini.fallback")
          : snapshot.gemini?.demoModeAcknowledged
            ? t("overview.check.gemini.demo")
            : t("overview.check.gemini.no"),
      severity: geminiOk
        ? "READY"
        : snapshot.gemini?.usingFallbackScript ||
            snapshot.gemini?.phase === "FALLBACK_SCRIPT" ||
            snapshot.gemini?.demoModeAcknowledged
          ? "WARNING"
          : "BLOCKING",
      ready: geminiStartOk,
      cta: geminiStartOk ? undefined : { label: t("overview.cta.connect"), tab: "connections" }
    }),
    item({
      id: "tiktok",
      label: t("overview.check.tiktok"),
      detail: tiktokOk ? t("overview.check.tiktok.ok") : t("overview.check.tiktok.no"),
      severity: tiktokOk ? "READY" : "BLOCKING",
      ready: tiktokOk,
      cta: tiktokOk ? undefined : { label: t("overview.cta.connect"), tab: "connections" }
    }),
    item({
      id: "products",
      label: t("overview.check.products"),
      detail: productsOk
        ? t("overview.check.products.ok", { count: productCount })
        : t("overview.check.products.no"),
      severity: productsOk ? "READY" : "BLOCKING",
      ready: productsOk,
      cta: productsOk ? undefined : { label: t("overview.cta.addProduct"), tab: "products" }
    }),
    item({
      id: "output-mode",
      label: t("overview.check.outputMode"),
      detail: modeReady
        ? t("overview.check.outputMode.ok", { mode: t(`voice.outputMode.${outputMode}`) })
        : t("overview.check.outputMode.no", {
            mode: t(`voice.outputMode.${outputMode}`),
            missing: missing.map((k) => capabilityLabel(k, t)).join(", ")
          }),
      severity: modeReady ? "READY" : "BLOCKING",
      ready: modeReady,
      cta: modeReady ? undefined : { label: t("overview.cta.setup"), tab: "avatar" }
    })
  ];

  const capEntries: Array<{ key: MediaCapabilityKey; needed: boolean; ready: boolean }> = [
    { key: "voiceReady", needed: need.needVoice, ready: caps.voiceReady },
    { key: "audioRouteReady", needed: need.needAudioRoute, ready: caps.audioRouteReady },
    { key: "avatarReady", needed: need.needAvatar, ready: caps.avatarReady },
    { key: "videoRouteReady", needed: need.needVideoRoute, ready: caps.videoRouteReady }
  ];

  for (const entry of capEntries) {
    if (!entry.needed) {
      items.push(
        item({
          id: `cap:${entry.key}`,
          label: capabilityLabel(entry.key, t),
          detail: t("overview.check.cap.notRequired"),
          severity: "OPTIONAL",
          ready: entry.ready
        })
      );
      continue;
    }
    items.push(
      item({
        id: `cap:${entry.key}`,
        label: capabilityLabel(entry.key, t),
        detail: capabilityDetail(entry.key, entry.ready, t),
        severity: entry.ready ? "READY" : "BLOCKING",
        ready: entry.ready,
        cta: entry.ready ? undefined : { label: t("overview.cta.setup"), tab: "avatar" }
      })
    );
  }

  const scored = items.filter((x) => x.severity !== "OPTIONAL");
  const readyCount = scored.filter((x) => x.ready).length;
  const blockingItems = items.filter((x) => x.severity === "BLOCKING" && !x.ready);
  const warningItems = items.filter((x) => x.severity === "WARNING" && !x.ready);
  const blockingCount = blockingItems.length;
  const warningCount = warningItems.length;
  const canStartLive = blockingCount === 0;

  let severity: "READY" | "WARNING" | "BLOCKING" = "READY";
  let label = t("overview.overall.ready");
  let detail = t("overview.overall.readyDetail");

  if (blockingCount > 0) {
    severity = "BLOCKING";
    label = t("overview.overall.blocked");
    detail = t("overview.overall.blockedDetail", { count: blockingCount });
  } else if (warningCount > 0) {
    severity = "WARNING";
    label = t("overview.overall.partial");
    detail = t("overview.overall.partialDetail", { count: warningCount });
  }

  const startBlockedReason = canStartLive
    ? ""
    : t("overview.start.needSteps", { count: blockingCount });

  return {
    severity,
    tone: toneOf(severity),
    label,
    detail,
    items,
    readyCount,
    total: scored.length,
    blockingCount,
    warningCount,
    canStartLive,
    startBlockedReason,
    canStartLiveAssist: canStartLive
  };
}

export function readinessMark(item: ReadinessItem): string {
  if (item.ready) return "✓";
  if (item.severity === "OPTIONAL") return "○";
  return "!";
}
