/**
 * Exclusive claim of a virtual-camera / mock target per account.
 * One targetId must not be held by two accounts at once.
 */
export class VideoDeviceReservationService {
  private readonly byTarget = new Map<string, string>();

  holder(targetId: string): string | undefined {
    return this.byTarget.get(targetId);
  }

  isHeldBy(targetId: string, accountId: string): boolean {
    return this.byTarget.get(targetId) === accountId;
  }

  /** Throws VIDEO_TARGET_CLAIMED if another account holds the device. */
  claim(targetId: string, accountId: string): void {
    const id = targetId.trim();
    const acc = accountId.trim();
    if (!id || !acc) throw new Error("VIDEO_TARGET_CLAIM_INVALID");
    const current = this.byTarget.get(id);
    if (current && current !== acc) {
      throw new Error(`VIDEO_TARGET_CLAIMED:${id}:by:${current}`);
    }
    this.byTarget.set(id, acc);
  }

  release(targetId: string, accountId: string): void {
    const current = this.byTarget.get(targetId);
    if (current === accountId) this.byTarget.delete(targetId);
  }

  releaseAll(accountId: string): void {
    for (const [targetId, holder] of this.byTarget) {
      if (holder === accountId) this.byTarget.delete(targetId);
    }
  }

  snapshot(): Array<{ targetId: string; accountId: string }> {
    return [...this.byTarget.entries()].map(([targetId, accountId]) => ({
      targetId,
      accountId
    }));
  }
}

/** Process-wide default for mock / future Windows providers. */
export const defaultVideoDeviceReservations = new VideoDeviceReservationService();
