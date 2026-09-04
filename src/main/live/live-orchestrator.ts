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
import { LiveEventBus } from "../core/event-bus";
import { detectSalesCommentIntent } from "../../shared/sales-brain";
import { ApprovalEngine } from "./approval-engine";
import { scoreComment } from "./comment-priority";
import { LiveMemory } from "./live-memory";
import { PolicyGuard } from "./policy-guard";
import { SalesStateMachine } from "./sales-state-machine";

export interface LiveOrchestratorDeps {
  eventBus: LiveEventBus;
  llm: LlmProvider;
  media: MediaProvider;
  getCurrentProduct: () => ProductDNA | undefined;
  onApprovalChanged?: (item: ApprovalItem) => void;
  /** Persist session row when live starts/stops. */
  onSessionStart?: (sessionId: string, mode: AutomationMode) => void;
  onSessionEnd?: (sessionId: string, finalState: string) => void;
}

export class LiveOrchestrator {
  private mode: AutomationMode = "SUPERVISED_AUTO";
  private running = false;
  private readonly stateMachine = new SalesStateMachine();
  private readonly approvals = new ApprovalEngine({
    supervisedDelayMs: 3500,
    confidenceThreshold: 0.92
  });
  private readonly guard = new PolicyGuard();
  private readonly memory = new LiveMemory();
  private unsubscribe?: () => void;
  private timer?: NodeJS.Timeout;

  constructor(private readonly deps: LiveOrchestratorDeps) {}

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

    // New live → reset short-term memory (prompt 16).
    const product = this.deps.getCurrentProduct();
    this.memory.reset();
    this.memory.setCurrentProductId(product?.id);
    this.deps.onSessionStart?.(this.memory.id!, this.mode);

    this.stateMachine.start();
    this.memory.setLastState(this.stateMachine.current);

    this.unsubscribe = this.deps.eventBus.subscribe((event) => this.handleEvent(event));
    this.timer = setInterval(() => {
      for (const item of this.approvals.collectTimedApprovals()) {
        this.deps.onApprovalChanged?.(item);
        void this.execute(item);
      }
    }, 250);
  }

  stop(): void {
    if (this.memory.id) {
      this.deps.onSessionEnd?.(this.memory.id, this.stateMachine.current);
    }
    this.running = false;
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
    const item = this.approvals.resolve(id, decision, editedSpeech);
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
    this.approvals.cancelAllAutoApprovals();
    this.mode = "MANUAL_ASSIST";
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

    if (event.type === "COMMENT" && scoreComment(event) < 45) {
      return;
    }

    if (!["COMMENT", "ORDER_ACTIVITY"].includes(event.type)) return;

    let proposal = await this.generateProposal(event);
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
      this.mode
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

  private async generateProposal(event: LiveEvent): Promise<ActionProposal> {
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
    try {
      switch (item.proposal.kind) {
        case "SPEAK":
        case "THANK_USER":
          if (item.proposal.speech) {
            await this.deps.media.speak(item.proposal.speech);
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
            await this.deps.media.setScene(item.proposal.scene);
            this.memory.setLastScene(item.proposal.scene);
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
