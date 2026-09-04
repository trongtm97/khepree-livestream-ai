import type { AppSnapshot } from "../../shared/ipc";
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

function isVoiceReady(snapshot: AppSnapshot): boolean {
  const media = snapshot.health.find((h) => h.component.startsWith("media:"));
  return Boolean(media && media.status === "OK" && !media.component.includes("mock"));
}

function isVirtualCameraReady(_snapshot: AppSnapshot): boolean {
  return false;
}

function isAvatarReady(_snapshot: AppSnapshot): boolean {
  return false;
}

function isMicReady(_snapshot: AppSnapshot): boolean {
  return false;
}

function item(
  partial: Omit<ReadinessItem, "tone"> & { severity: ReadinessSeverity }
): ReadinessItem {
  return { ...partial, tone: toneOf(partial.severity) };
}

export function buildReadiness(snapshot: AppSnapshot, t: TranslateFn): OverallReadiness {
  const productCount = snapshot.products.length;
  const khepreeOk = isKhepreeReady(snapshot);
  const geminiOk = isGeminiReady(snapshot);
  const geminiStartOk = isGeminiStartAllowed(snapshot);
  const tiktokOk = isTikTokReady(snapshot);
  const productsOk = productCount > 0;
  const voiceOk = isVoiceReady(snapshot);
  const avatarOk = isAvatarReady(snapshot);
  const cameraOk = isVirtualCameraReady(snapshot);
  const micOk = isMicReady(snapshot);

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
      id: "voice",
      label: t("overview.check.voice"),
      detail: voiceOk ? t("overview.check.voice.ok") : t("overview.check.voice.no"),
      severity: voiceOk ? "READY" : "WARNING",
      ready: voiceOk,
      cta: voiceOk ? undefined : { label: t("overview.cta.setup"), tab: "avatar" }
    }),
    item({
      id: "avatar",
      label: t("overview.check.avatar"),
      detail: avatarOk ? t("overview.check.avatar.ok") : t("overview.check.avatar.optional"),
      severity: avatarOk ? "READY" : "OPTIONAL",
      ready: avatarOk,
      cta: avatarOk ? undefined : { label: t("overview.cta.setup"), tab: "avatar" }
    }),
    item({
      id: "camera",
      label: t("overview.check.camera"),
      detail: cameraOk ? t("overview.check.camera.ok") : t("overview.check.camera.no"),
      severity: cameraOk ? "READY" : "WARNING",
      ready: cameraOk,
      cta: cameraOk ? undefined : { label: t("overview.cta.setup"), tab: "avatar" }
    }),
    item({
      id: "microphone",
      label: t("overview.check.microphone"),
      detail: micOk ? t("overview.check.microphone.ok") : t("overview.check.microphone.no"),
      severity: micOk ? "READY" : "WARNING",
      ready: micOk,
      cta: micOk ? undefined : { label: t("overview.cta.setup"), tab: "settings" }
    })
  ];

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
