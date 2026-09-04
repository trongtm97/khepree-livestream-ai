import { randomUUID } from "node:crypto";
import type { LiveState } from "../../shared/live-types";
import {
  LIVE_MEMORY_CAPS,
  SPEECH_SIMILARITY_THRESHOLD,
  isSpeechTooSimilar,
  looksLikeCtaSpeech,
  looksLikeCustomerQuestion,
  takeLast,
  type LiveMemoryPublicSnapshot,
  type MemoryComment
} from "../../shared/live-memory";

/**
 * In-memory short-term session memory.
 * Reset when a new live session starts. Not a vector store.
 */
export class LiveMemory {
  private sessionId?: string;
  private recentSpeech: string[] = [];
  private recentRespondedComments: MemoryComment[] = [];
  private recentCta: string[] = [];
  private recentComments: MemoryComment[] = [];
  private recentCustomerQuestions: MemoryComment[] = [];
  private currentProductId?: string;
  private lastState: LiveState = "IDLE";
  private lastScene?: string;

  get id(): string | undefined {
    return this.sessionId;
  }

  reset(sessionId = randomUUID()): void {
    this.sessionId = sessionId;
    this.recentSpeech = [];
    this.recentRespondedComments = [];
    this.recentCta = [];
    this.recentComments = [];
    this.recentCustomerQuestions = [];
    this.lastState = "IDLE";
    this.lastScene = undefined;
    // currentProductId refreshed from caller after reset
  }

  clearSession(): void {
    this.sessionId = undefined;
  }

  setCurrentProductId(id: string | undefined): void {
    this.currentProductId = id;
  }

  setLastState(state: LiveState): void {
    this.lastState = state;
  }

  setLastScene(scene: string | undefined): void {
    if (scene?.trim()) this.lastScene = scene.trim();
  }

  rememberComment(comment: MemoryComment): void {
    const text = comment.text.trim();
    if (!text) return;
    this.recentComments.push({ ...comment, text });
    this.recentComments = takeLast(this.recentComments, LIVE_MEMORY_CAPS.keepComments);
    if (looksLikeCustomerQuestion(text)) {
      this.recentCustomerQuestions.push({ ...comment, text });
      this.recentCustomerQuestions = takeLast(
        this.recentCustomerQuestions,
        LIVE_MEMORY_CAPS.keepQuestions
      );
    }
  }

  rememberRespondedComment(comment: MemoryComment): void {
    const text = comment.text.trim();
    if (!text) return;
    this.recentRespondedComments.push({ ...comment, text });
    this.recentRespondedComments = takeLast(
      this.recentRespondedComments,
      LIVE_MEMORY_CAPS.keepResponded
    );
  }

  rememberSpeech(speech: string, opts?: { isCta?: boolean; nextState?: LiveState }): void {
    const s = speech.trim();
    if (!s) return;
    this.recentSpeech.push(s);
    this.recentSpeech = takeLast(this.recentSpeech, LIVE_MEMORY_CAPS.keepSpeech);
    if (opts?.isCta || looksLikeCtaSpeech(s) || opts?.nextState === "CTA") {
      this.recentCta.push(s);
      this.recentCta = takeLast(this.recentCta, LIVE_MEMORY_CAPS.keepCta);
    }
  }

  isSpeechTooSimilar(candidate: string): boolean {
    return isSpeechTooSimilar(candidate, this.recentSpeech, SPEECH_SIMILARITY_THRESHOLD);
  }

  getCommentText(eventId: string): string | undefined {
    const pools = [
      this.recentComments,
      this.recentRespondedComments,
      this.recentCustomerQuestions
    ];
    for (const pool of pools) {
      const hit = pool.find((c) => c.eventId === eventId);
      if (hit?.text) return hit.text;
    }
    return undefined;
  }

  /** Compact context for Gemini — never full history. */
  toLlmSlices() {
    return {
      recentSpeech: takeLast(this.recentSpeech, LIVE_MEMORY_CAPS.sendSpeech),
      recentComments: takeLast(this.recentComments, LIVE_MEMORY_CAPS.sendComments),
      recentRespondedComments: takeLast(
        this.recentRespondedComments,
        LIVE_MEMORY_CAPS.sendResponded
      ),
      recentCta: takeLast(this.recentCta, LIVE_MEMORY_CAPS.sendCta),
      recentCustomerQuestions: takeLast(
        this.recentCustomerQuestions,
        LIVE_MEMORY_CAPS.sendQuestions
      ),
      currentProductId: this.currentProductId,
      lastState: this.lastState,
      lastScene: this.lastScene
    };
  }

  snapshot(): LiveMemoryPublicSnapshot {
    return {
      sessionId: this.sessionId,
      recentSpeech: [...this.recentSpeech],
      recentRespondedComments: [...this.recentRespondedComments],
      recentCta: [...this.recentCta],
      currentProductId: this.currentProductId,
      lastState: this.lastState,
      lastScene: this.lastScene,
      recentCustomerQuestions: [...this.recentCustomerQuestions]
    };
  }
}
