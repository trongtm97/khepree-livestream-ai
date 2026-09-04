/**
 * Detect when two accounts would share the same Windows audio endpoint.
 * Shared cable = voices can bleed across livestreams.
 */
import type { MediaProfile } from "./media-contracts";

export type AudioDeviceCollision = {
  deviceId: string;
  otherAccountId: string;
};

export function findAudioDeviceCollision(
  accountId: string,
  deviceId: string | undefined,
  profiles: Array<Pick<MediaProfile, "accountId" | "audioOutputType" | "audioOutputDeviceId">>
): AudioDeviceCollision | undefined {
  const id = deviceId?.trim();
  if (!id) return undefined;
  for (const p of profiles) {
    if (p.accountId === accountId) continue;
    if (p.audioOutputType !== "windows-endpoint") continue;
    if (p.audioOutputDeviceId !== id) continue;
    return { deviceId: id, otherAccountId: p.accountId };
  }
  return undefined;
}

/** Voice-stream mode needs a concrete endpoint; assistant-only does not. */
export function isVoiceStreamAudioReady(
  profile: Pick<MediaProfile, "audioOutputType" | "audioOutputDeviceId"> | undefined
): boolean {
  if (!profile) return true; // no profile yet → treat as assistant-only default
  if (profile.audioOutputType !== "windows-endpoint") return true;
  return Boolean(profile.audioOutputDeviceId?.trim());
}

export function isVoiceStreamMode(
  profile: Pick<MediaProfile, "audioOutputType"> | undefined
): boolean {
  return profile?.audioOutputType === "windows-endpoint";
}
