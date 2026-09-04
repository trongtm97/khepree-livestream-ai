/**
 * Gather media readiness facts + dry-run (no TikTok).
 */
import type { LiveOutputMode } from "../../shared/live-output-mode";
import { normalizeLiveOutputMode } from "../../shared/live-output-mode";
import {
  evaluateMediaReadiness,
  mediaDryRunPhrase,
  mediaDryRunToken,
  verifyMediaMultiIsolation,
  type MediaDryRunResult,
  type MediaMultiDryRunResult,
  type MediaReadinessFacts,
  type MediaReadinessReport
} from "../../shared/media-readiness";
import {
  isAvatarEngineConfigured,
  isLiveTalkingEngineConfigured,
  isMuseTalkEngineConfigured
} from "../../shared/media-contracts";
import type { AppContainer } from "../app-container";

export async function gatherMediaReadinessFacts(
  container: AppContainer,
  accountId: string
): Promise<MediaReadinessFacts> {
  const profile = container.mediaProfiles.getByAccount(accountId);
  const tts = container.mediaFactory.getTts();
  let ttsOk = false;
  let ttsError: string | undefined;
  let voiceCount = 0;
  try {
    const h = await tts.health();
    ttsOk = h.status === "OK" || h.status === "DEGRADED";
    if (!ttsOk) ttsError = h.message;
    voiceCount = (await tts.listVoices()).length;
  } catch (e) {
    ttsOk = false;
    ttsError = e instanceof Error ? e.message : String(e);
  }

  const voiceSelected = Boolean(profile?.voiceId?.trim()) || voiceCount > 0;
  const outputType = profile?.audioOutputType ?? "local-preview";
  const deviceId = profile?.audioOutputDeviceId?.trim();
  const virtualCableOk = outputType === "windows-endpoint" && Boolean(deviceId);
  const audioOutputOk =
    outputType === "local-preview" || virtualCableOk;

  const engine = profile?.avatarEngine;
  const avatarEngineConfigured = isAvatarEngineConfigured(engine);
  // Checklist stays fast — configured counts as healthy; dry-run surfaces real failures.
  const avatarEngineHealthy = avatarEngineConfigured;
  const avatarEngineError: string | undefined = undefined;

  const avatarProfileSelected =
    Boolean(profile?.selectedAvatarId?.trim()) ||
    (isLiveTalkingEngineConfigured(engine) && Boolean(engine?.avatarId?.trim())) ||
    isMuseTalkEngineConfigured(engine);

  let sceneOk = false;
  let videoOutputOk = false;
  try {
    const runtime = container.multiLive.ensureRuntime(accountId);
    const state = runtime.getSceneState();
    sceneOk = Boolean(state?.sceneId);
    const frame = runtime.getScenePreview("hidden");
    videoOutputOk = Boolean(frame?.layers?.length);
  } catch {
    sceneOk = false;
    videoOutputOk = false;
  }

  const virtualCameraOk =
    isLiveTalkingEngineConfigured(engine) && engine?.transport === "virtualcam";

  const gpuSnap = container.gpuMediaScheduler.getPublicState();
  const res = container.capacity.resourceSnapshot({
    activeRuntimes: container.multiLive.getAllSnapshots().filter((l) => l.isRunning).length,
    activeTikTokWorkers: 0,
    activeBrowserContexts: 0,
    aiQueueLength: 0,
    accountCount: container.tiktokAccounts.list().length
  });
  let gpuOk: boolean | "unknown" = "unknown";
  let gpuDetail: string | undefined;
  if (res.gpu === "UNKNOWN") {
    gpuOk = "unknown";
    gpuDetail = "GPU metrics unavailable";
  } else if (!res.gpu.available) {
    gpuOk = false;
    gpuDetail = "GPU unavailable";
  } else {
    gpuOk = true;
    const free = res.gpu.vramFreeMb;
    gpuDetail =
      typeof free === "number"
        ? `VRAM free ~${free} MB · avatar slots ${gpuSnap.usedSlots}${
            gpuSnap.maxAvatarSlots != null ? `/${gpuSnap.maxAvatarSlots}` : ""
          }`
        : `GPU ok · avatar slots ${gpuSnap.usedSlots}`;
  }

  return {
    ttsOk,
    ttsError,
    voiceSelected,
    voiceCount,
    audioOutputOk,
    virtualCableOk,
    avatarEngineConfigured,
    avatarEngineHealthy,
    avatarEngineError,
    avatarProfileSelected,
    sceneOk,
    videoOutputOk,
    virtualCameraOk,
    gpuOk,
    gpuDetail
  };
}

export async function getMediaReadinessReport(
  container: AppContainer,
  accountId: string
): Promise<MediaReadinessReport> {
  const settings = container.accountLiveSettings.ensure(accountId);
  const mode = normalizeLiveOutputMode(settings.outputMode);
  const facts = await gatherMediaReadinessFacts(container, accountId);
  return evaluateMediaReadiness(accountId, mode, facts);
}

export async function runMediaDryRun(
  container: AppContainer,
  accountId: string,
  index = 0
): Promise<MediaDryRunResult> {
  const token = mediaDryRunToken(accountId, index);
  const phrase = mediaDryRunPhrase(token);
  const result: MediaDryRunResult = {
    accountId,
    phrase,
    token,
    audioPlayed: false,
    scenePreviewOk: false
  };
  try {
    await container.mediaFactory.preview(accountId, phrase);
    result.audioPlayed = true;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  try {
    const runtime = container.multiLive.ensureRuntime(accountId);
    runtime.sceneEngine.setCommentHint(token);
    const frame = runtime.getScenePreview("focused");
    result.scenePreviewOk = Boolean(frame);
    if (frame) result.videoToken = token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.error = result.error ? `${result.error}; ${msg}` : msg;
  }
  return result;
}

export async function runMediaMultiDryRun(
  container: AppContainer,
  accountIds: string[]
): Promise<MediaMultiDryRunResult> {
  const ids = accountIds.map((id) => id.trim()).filter(Boolean).slice(0, 3);
  const results: MediaDryRunResult[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    results.push(await runMediaDryRun(container, ids[i]!, i));
  }
  return {
    results,
    isolationOk: verifyMediaMultiIsolation(results)
  };
}

export function outputModeOf(container: AppContainer, accountId: string): LiveOutputMode {
  return normalizeLiveOutputMode(container.accountLiveSettings.ensure(accountId).outputMode);
}
