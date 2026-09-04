/**
 * Pick AudioOutput from MediaProfile. Never silent-fallback windows-endpoint → speakers.
 */
import type { MediaProfile } from "../../../../shared/media-contracts";
import { LocalPreviewOutput, MockAudioOutput } from "./local-preview-output";
import type { AudioOutput } from "./types";
import {
  StdioAudioBridge,
  type AudioBridgeClient,
  resolveAudioBridgeExe
} from "./windows-audio-bridge";
import {
  UnconfiguredEndpointOutput,
  WindowsEndpointOutput
} from "./windows-endpoint-output";

export type CreateAudioOutputOptions = {
  /** Force silent mock (tests / headless). */
  silent?: boolean;
  /** Injected bridge (tests). When omitted, spawn media_audio_bridge.exe. */
  bridgeFactory?: (deviceId: string) => AudioBridgeClient;
  /** App root for resolving bridge exe. */
  appRoot?: string;
};

export function createAudioOutput(
  profile: MediaProfile,
  opts: CreateAudioOutputOptions = {}
): AudioOutput {
  if (opts.silent) {
    return new MockAudioOutput({
      id: `mock:${profile.accountId}`,
      displayName: `Mock (${profile.accountId})`
    });
  }

  if (profile.audioOutputType === "windows-endpoint") {
    const deviceId = profile.audioOutputDeviceId?.trim();
    if (!deviceId) return new UnconfiguredEndpointOutput();

    if (opts.bridgeFactory) {
      return new WindowsEndpointOutput(deviceId, opts.bridgeFactory(deviceId));
    }

    const exe = opts.appRoot ? resolveAudioBridgeExe(opts.appRoot) : undefined;
    if (!exe) {
      // Fail closed: missing helper must not play on default speakers.
      return new WindowsEndpointOutput(deviceId, {
        async listDevices() {
          return [];
        },
        async play() {
          throw new Error("AUDIO_BRIDGE_MISSING");
        },
        async stop() {},
        async health() {
          return {
            status: "DOWN",
            message: "media_audio_bridge.exe chưa có — build workers/media_audio_bridge",
            devicePresent: false
          };
        },
        async dispose() {}
      });
    }
    return new WindowsEndpointOutput(deviceId, new StdioAudioBridge(exe));
  }

  return new LocalPreviewOutput();
}
