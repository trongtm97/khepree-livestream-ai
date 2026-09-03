import { randomUUID } from "node:crypto";
import type {
  ActionProposal,
  ApprovalItem,
  AutomationMode,
  LiveEvent,
  ProductDNA
} from "../../shared/live-types";
import type { LlmProvider } from "../connectors/llm/types";
import type { MediaProvider } from "../connectors/media/types";
import { LiveEventBus } from "../core/event-bus";
import { ApprovalEngine } from "./approval-engine";
import { scoreComment } from "./comment-priority";
import { PolicyGuard } from "./policy-guard";
import { SalesStateMachine } from "./sales-state-machine";

export interface LiveOrchestratorDeps {
  eventBus: LiveEventBus;
  llm: LlmProvider;
  media: MediaProvider;
  getCurrentProduct: () => ProductDNA | undefined;
  onApprovalChanged?: (item: ApprovalItem) => void;
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
  private recentSpeech: string[] = [];
  private unsubscribe?: () => void;
  private timer?: NodeJS.Timeout;

  constructor(private readonly deps: LiveOrchestratorDeps) {}

  get isRunning(): boolean { return this.running; }
  get automationMode(): AutomationMode { return this.mode; }
  get state(): string { return this.stateMachine.current; }

  setMode(mode: AutomationMode): void {
    this.mode = mode;
  }

  listApprovals(): ApprovalItem[] {
    return this.approvals.listPending();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stateMachine.start();
    this.unsubscribe = this.deps.eventBus.subscribe((event) => this.handleEvent(event));
    this.timer = setInterval(() => {
      for (const item of this.approvals.collectTimedApprovals()) {
        this.deps.onApprovalChanged?.(item);
        void this.execute(item);
      }
    }, 250);
  }

  stop(): void {
    this.running = false;
    this.stateMachine.stop();
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

  private async handleEvent(event: LiveEvent): Promise<void> {
    if (!this.running) return;
    this.stateMachine.onEvent(event);

    if (event.type === "COMMENT" && scoreComment(event) < 45) {
      return;
    }

    if (!["COMMENT", "ORDER_ACTIVITY"].includes(event.type)) return;

    let proposal = await this.deps.llm.generateActionProposal({
      event,
      currentState: this.stateMachine.current,
      product: this.deps.getCurrentProduct(),
      recentSpeech: this.recentSpeech
    });

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

    const item = this.approvals.enqueue(proposal, this.mode);
    this.deps.onApprovalChanged?.(item);

    if (this.mode === "FULL_AUTO" && item.autoApproveAt) {
      // Timer still gives a short emergency-cancel window.
    }
  }

  private async execute(item: ApprovalItem): Promise<void> {
    try {
      switch (item.proposal.kind) {
        case "SPEAK":
        case "THANK_USER":
          if (item.proposal.speech) {
            await this.deps.media.speak(item.proposal.speech);
            this.recentSpeech.push(item.proposal.speech);
            this.recentSpeech = this.recentSpeech.slice(-20);
          }
          break;
        case "SET_SCENE":
          if (item.proposal.scene) await this.deps.media.setScene(item.proposal.scene);
          break;
        case "ASK_OPERATOR":
        case "PIN_PRODUCT":
        case "IGNORE":
          // PIN_PRODUCT requires a separate browser action executor.
          break;
      }
      if (item.proposal.nextState) this.stateMachine.transition(item.proposal.nextState);
      this.approvals.markExecuted(item.id, true);
    } catch (error) {
      console.error("Failed to execute approval", item.id, error);
      this.approvals.markExecuted(item.id, false);
    }
    this.deps.onApprovalChanged?.(item);
  }
}
