import type { ApprovalItem, AutomationMode, ProductDNA, RuntimeHealth } from "./live-types";
import type { KhepreePublicState } from "./khepree-contracts";

export const IPC = {
  APP_SNAPSHOT: "app:snapshot",
  LIVE_START: "live:start",
  LIVE_STOP: "live:stop",
  LIVE_SET_MODE: "live:set-mode",
  APPROVAL_RESOLVE: "approval:resolve",
  GEMINI_HEALTH: "gemini:health",
  TIKTOK_CONNECT: "tiktok:connect",
  TIKTOK_DISCONNECT: "tiktok:disconnect",
  PRODUCT_SAVE: "product:save",
  KHEPREE_LOGIN: "khepree:login",
  KHEPREE_LOGOUT: "khepree:logout"
} as const;

export interface AppSnapshot {
  appVersion: string;
  liveRunning: boolean;
  automationMode: AutomationMode;
  liveState: string;
  approvals: ApprovalItem[];
  products: ProductDNA[];
  health: RuntimeHealth[];
  khepree: KhepreePublicState;
}

export interface RendererApi {
  snapshot(): Promise<AppSnapshot>;
  startLive(): Promise<void>;
  stopLive(): Promise<void>;
  setAutomationMode(mode: AutomationMode): Promise<void>;
  resolveApproval(id: string, decision: "approve" | "reject", editedSpeech?: string): Promise<void>;
  connectTikTok(uniqueId: string): Promise<void>;
  disconnectTikTok(): Promise<void>;
  saveProduct(product: ProductDNA): Promise<void>;
  startKhepreeLogin(): Promise<void>;
  logoutKhepree(): Promise<void>;
}
