import { randomUUID } from "node:crypto";
import type {
  ActionProposal,
  ApprovalItem,
  AutomationMode,
  LiveEvent,
  ProductDNA
} from "../../shared/live-types";
import type { LlmContext, LlmProvider } from "../connectors/llm/types";
import type { MediaProvider } from "../connectors/media/types";
import type { SceneEngine } from "./scene/scene-engine";
import { LiveEventBus } from "../core/event-bus";
import { detectSalesCommentIntent } from "../../shared/sales-brain";
import { allowsSpeechOutput, type LiveOutputMode } from "../../shared/live-output-mode";
import { ApprovalEngine, type ApprovalEngineOptions } from "./approval-engine";
import { scoreComment } from "./comment-priority";
import { LiveMemory } from "./live-memory";
import { PolicyGuard } from "./policy-guard";
import { SalesStateMachine } from "./sales-state-machine";

export interface LiveOrchestratorDeps {
  eventBus: LiveEventBus;
  llm: LlmProvider;
  media: MediaProvider;
  getCurrentProduct: () => ProductDNA | undefined;
  /** TikTok account owning this orchestrator — stamped on every approval. */
  accountId: string;
  /** Livestream output mode — ASSIST_ONLY skips TTS playback. */
  getOutputMode?: () => LiveOutputMode;
  /** Scene engine for SET_SCENE (optional — tests may omit). */
  sceneEngine?: SceneEngine;
  onApprovalChanged?: (item: ApprovalItem) => void;
  /** Persist session row when live starts/stops. */
  onSessionStart?: (sessionId: string, mode: AutomationMode) => void;
  onSessionEnd?: (sessionId: string, finalState: string) => void;
  /** Test seam for ApprovalEngine timing/thresholds. */
  approvalOptions?: Partial<ApprovalEngineOptions>;
}

export class LiveOrchestrator {
  private mode: AutomationMode = "SUPERVISED_AUTO";
  private running = false;
  /** Bumped on start/stop so in-flight LLM work from a prior run cannot apply. */
  private runGeneration = 0;
  /** Operator mute — no speak / no new AI proposals. */
  private aiMuted = false;
  /** On exit takeover: ignore comment events with timestamp <= this. */
  private discardEventsBeforeMs = 0;
  private readonly stateMachine = new SalesStateMachine();
  private readonly approvals: ApprovalEngine;
  private readonly guard = new PolicyGuard();
  private readonly memory = new LiveMemory();
  private unsubscribe?: () => void;
  private timer?: NodeJS.Timeout;

  constructor(private readonly deps: LiveOrchestratorDeps) {
    this.approvals = new ApprovalEngine({
      supervisedDelayMs: deps.approvalOptions?.supervisedDelayMs ?? 3500,
      confidenceThreshold: deps.approvalOptions?.confidenceThreshold ?? 0.92
    });
  }

  get isRunning(): boolean {
    return this.running;
  }
  get automationMode(): AutomationMode {
    return this.mode;
  }
  get state(): string {
    return this.stateMachine.current;
  }
  get sessionId(): string | undefined {
    return this.memory.id;
  }
  getMemorySnapshot() {
    return this.memory.snapshot();
  }

  setMode(mode: AutomationMode): void {
    this.mode = mode;
  }

  listApprovals(): ApprovalItem[] {
    return this.approvals.listPending();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.runGeneration += 1;

    // New live → reset short-term memory (prompt 16).
    const product = this.deps.getCurrentProduct();
    this.memory.reset();
    this.memory.setCurrentProductId(product?.id);
    this.deps.onSessionStart?.(this.memory.id!, this.mode);

    this.stateMachine.start();
    this.memory.setLastState(this.stateMachine.current);

    this.unsubscribe = this.deps.eventBus.subscribe((event) => this.handleEvent(event));
    this.timer = setInterval(() => {
      if (this.aiMuted) return;
      const activeSessionId = this.sessionId;
      if (!activeSessionId) return;
      for (const item of this.approvals.collectTimedApprovals(activeSessionId)) {
        this.deps.onApprovalChanged?.(item);
        void this.execute(item);
      }
    }, 250);
  }

  stop(): void {
    const sessionId = this.memory.id;
    if (sessionId) {
      for (const item of this.approvals.expireSession(sessionId)) {
        this.deps.onApprovalChanged?.(item);
      }
      this.deps.onSessionEnd?.(sessionId, this.stateMachine.current);
    }
    this.running = false;
    this.runGeneration += 1;
    this.stateMachine.stop();
    this.memory.setLastState(this.stateMachine.current);
    this.memory.clearSession();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    void this.deps.media.stopSpeech();
  }

  async resolveApproval(
    id: string,
    decision: "approve" | "reject",
    editedSpeech?: string
  ): Promise<void> {
    const item = this.approvals.resolve(id, decision, editedSpeech, this.sessionId);
    this.deps.onApprovalChanged?.(item);
    if (item.status === "APPROVED") await this.execute(item);
  }

  get supervisedDelayMs(): number {
    return this.approvals.supervisedDelayMs;
  }

  cancelAutoApproval(id: string): ApprovalItem {
    const item = this.approvals.cancelAutoApprove(id);
    this.deps.onApprovalChanged?.(item);
    return item;
  }

  cancelNearestAutoApproval(): ApprovalItem | undefined {
    const item = this.approvals.cancelNearestAutoApprove();
    if (item) this.deps.onApprovalChanged?.(item);
    return item;
  }

  /** Operator "Dừng tự động": clear countdowns and drop to manual assist. */
  stopAutomation(): void {
    for (const item of this.approvals.cancelAllAutoApprovals()) {
      this.deps.onApprovalChanged?.(item);
    }
    this.mode = "MANUAL_ASSIST";
  }

  /**
   * Human takeover: mute AI speak path, kill TTS queue, expire pending approvals.
   * Live session stays running (TikTok / browser untouched by caller).
   */
  enterTakeover(): void {
    this.aiMuted = true;
    this.runGeneration += 1;
    for (const item of this.approvals.expireAllPending()) {
      this.deps.onApprovalChanged?.(item);
    }
    void this.deps.media.stopSpeech();
  }

  /**
   * Return AI control: do not replay old speech; discard events older than now.
   */
  exitTakeover(): void {
    this.discardEventsBeforeMs = Date.now();
    for (const item of this.approvals.expireAllPending()) {
      this.deps.onApprovalChanged?.(item);
    }
    void this.deps.media.stopSpeech();
    this.aiMuted = false;
  }

  /** Emergency / pause mute without ending the live session. */
  muteAi(): void {
    this.aiMuted = true;
    this.runGeneration += 1;
    for (const item of this.approvals.expireAllPending()) {
      this.deps.onApprovalChanged?.(item);
    }
    void this.deps.media.stopSpeech();
  }

  get isAiMuted(): boolean {
    return this.aiMuted;
  }

  private isCurrentGeneration(generation: number, sessionId: string | undefined): boolean {
    return (
      this.running &&
      generation === this.runGeneration &&
      sessionId !== undefined &&
      sessionId === this.sessionId
    );
  }

  private dropStaleAiResult(
    event: LiveEvent,
    generation: number,
    sessionId: string | undefined
  ): void {
    console.info("[AI_STALE_RESULT_DROPPED]", {
      accountId: event.accountId,
      oldSessionId: sessionId,
      currentSessionId: this.sessionId,
      generation,
      currentGeneration: this.runGeneration
    });
  }

  private async handleEvent(event: LiveEvent): Promise<void> {
    if (!this.running) return;
    this.stateMachine.onEvent(event);
    this.memory.setLastState(this.stateMachine.current);
    this.memory.setCurrentProductId(this.deps.getCurrentProduct()?.id);

    if (event.type === "COMMENT" && event.text) {
      this.memory.rememberComment({
        eventId: event.id,
        username: event.username,
        displayName: event.displayName,
        text: event.text,
        timestamp: event.timestamp
      });
    }

    if (this.aiMuted) return;

    const eventTs = event.timestamp ? Date.parse(event.timestamp) : Number.NaN;
    if (
      this.discardEventsBeforeMs > 0 &&
      Number.isFinite(eventTs) &&
      eventTs <= this.discardEventsBeforeMs
    ) {
      return;
    }

    if (event.type === "COMMENT" && scoreComment(event) < 45) {
      return;
    }

    if (!["COMMENT", "ORDER_ACTIVITY"].includes(event.type)) return;

    const generation = this.runGeneration;
    const sessionId = this.sessionId;

    let proposal = await this.generateProposal(event, generation, sessionId);
    if (!this.isCurrentGeneration(generation, sessionId)) {
      this.dropStaleAiResult(event, generation, sessionId);
      return;
    }

    const guarded = this.guard.validate(proposal, this.deps.getCurrentProduct());
    if (!guarded.allowed) {
      proposal = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        eventId: event.id,
        kind: "ASK_OPERATOR",
        confidence: 1,
        reason: `Policy guard blocked proposal: ${guarded.reasons.join("; ")}`,
        riskTags: guarded.proposal.riskTags
      };
    } else {
      proposal = guarded.proposal;
    }

    if (!this.isCurrentGeneration(generation, sessionId)) {
      this.dropStaleAiResult(event, generation, sessionId);
      return;
    }

    if (!sessionId) return;
    const accountId = this.deps.accountId.trim() || event.accountId?.trim();
    if (!accountId) {
      console.error("[LiveOrchestrator] approval enqueue missing accountId");
      return;
    }

    const item = this.approvals.enqueue(
      {
        ...proposal,
        metadata: {
          ...(proposal.metadata ?? {}),
          viewerUsername: event.username,
          viewerDisplayName: event.displayName,
          viewerText: event.text,
          eventType: event.type
        }
      },
      this.mode,
      { accountId, sessionId }
    );
    this.deps.onApprovalChanged?.(item);
  }

  private buildLlmContext(event: LiveEvent, antiRepetitionHint?: string): LlmContext {
    const product = this.deps.getCurrentProduct();
    const slices = this.memory.toLlmSlices();
    return {
      event,
      currentState: this.stateMachine.current,
      product,
      recentSpeech: slices.recentSpeech,
      recentComments: slices.recentComments,
      recentRespondedComments: slices.recentRespondedComments,
      recentCta: slices.recentCta,
      recentCustomerQuestions: slices.recentCustomerQuestions,
      lastScene: slices.lastScene,
      antiRepetitionHint,
      policyContext: product
        ? {
            forbiddenClaims: product.forbiddenClaims,
            allowedClaims: product.allowedClaims,
            notes: product.aiNotes ? [product.aiNotes] : []
          }
        : undefined,
      detectedIntent: detectSalesCommentIntent(event)
    };
  }

  private async generateProposal(
    event: LiveEvent,
    generation: number,
    sessionId: string | undefined
  ): Promise<ActionProposal> {
    const staleIgnore = (): ActionProposal => ({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: event.id,
      kind: "IGNORE",
      confidence: 1,
      reason: "Stale AI result after session epoch change",
      riskTags: ["scheduler_stale", "session_ended"]
    });

    const fail = (error: unknown): ActionProposal => ({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: event.id,
      kind: "ASK_OPERATOR",
      confidence: 1,
      reason: `LLM provider error: ${String(error)}`,
      riskTags: ["llm_error"]
    });

    let proposal = await this.deps.llm
      .generateActionProposal(this.buildLlmContext(event))
      .catch(fail);

    if (!this.isCurrentGeneration(generation, sessionId)) {
      return staleIgnore();
    }

    if (
      proposal.speech &&
      (proposal.kind === "SPEAK" || proposal.kind === "THANK_USER") &&
      this.memory.isSpeechTooSimilar(proposal.speech)
    ) {
      // One regenerate with anti-repetition hint — no vector DB.
      const regenerated = await this.deps.llm
        .generateActionProposal(
          this.buildLlmContext(
            event,
            "Previous draft repeated recent speech. Write a clearly different phrasing. Do not copy RECENT_SPEECH or RECENT_CTA."
          )
        )
        .catch(fail);

      if (!this.isCurrentGeneration(generation, sessionId)) {
        return staleIgnore();
      }

      if (
        regenerated.speech &&
        (regenerated.kind === "SPEAK" || regenerated.kind === "THANK_USER") &&
        this.memory.isSpeechTooSimilar(regenerated.speech)
      ) {
        return {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          eventId: event.id,
          kind: "ASK_OPERATOR",
          confidence: 1,
          reason: "Anti-repetition: regenerated speech still too similar to recent lines.",
          riskTags: ["anti_repetition", "ask_operator_fallback"],
          nextState: "COMMENT_REPLY",
          metadata: { fallback: "anti_repetition" }
        };
      }
      proposal = regenerated;
    }

    return proposal;
  }

  private async execute(item: ApprovalItem): Promise<void> {
    if (!this.running || this.aiMuted) return;
    try {
      switch (item.proposal.kind) {
        case "SPEAK":
        case "THANK_USER":
          if (this.aiMuted) return;
          if (item.proposal.speech) {
            const outputMode = this.deps.getOutputMode?.() ?? "VOICE_ONLY";
            if (allowsSpeechOutput(outputMode)) {
              await this.deps.media.speak(item.proposal.speech);
            }
            this.memory.rememberSpeech(item.proposal.speech, {
              nextState: item.proposal.nextState
            });
            if (item.proposal.eventId) {
              const fromEvent = this.memory.getCommentText(item.proposal.eventId);
              if (fromEvent) {
                this.memory.rememberRespondedComment({
                  eventId: item.proposal.eventId,
                  text: fromEvent
                });
              }
            }
          }
          break;
        case "SET_SCENE":
          if (item.proposal.scene) {
            const scene = this.deps.sceneEngine?.applyAiScene(item.proposal.scene);
            const sceneId = scene?.sceneId ?? item.proposal.scene;
            await this.deps.media.setScene(sceneId);
            this.memory.setLastScene(sceneId);
          }
          break;
        case "ASK_OPERATOR":
        case "PIN_PRODUCT":
        case "IGNORE":
          break;
      }
      if (item.proposal.nextState) {
        this.stateMachine.transition(item.proposal.nextState);
        this.memory.setLastState(this.stateMachine.current);
      }
      this.approvals.markExecuted(item.id, true);
    } catch (error) {
      console.error("Failed to execute approval", item.id, error);
      this.approvals.markExecuted(item.id, false);
    }
    this.deps.onApprovalChanged?.(item);
  }
}
