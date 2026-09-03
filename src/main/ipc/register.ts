import { app, ipcMain } from "electron";
import { IPC, type AppSnapshot } from "../../shared/ipc";
import type { AutomationMode, ProductDNA } from "../../shared/live-types";
import { AppContainer } from "../app-container";

export function registerIpc(container: AppContainer): void {
  ipcMain.handle(IPC.APP_SNAPSHOT, async (): Promise<AppSnapshot> => ({
    appVersion: app.getVersion(),
    liveRunning: container.live.isRunning,
    automationMode: container.live.automationMode,
    liveState: container.live.state,
    approvals: container.live.listApprovals(),
    products: container.products.list(),
    health: [
      await container.llm.health(),
      await container.media.health()
    ],
    khepree: container.khepree.publicState
  }));

  ipcMain.handle(IPC.LIVE_START, async () => {
    container.khepree.assertProductAccess("supervised_auto");
    container.live.start();
  });

  ipcMain.handle(IPC.LIVE_STOP, async () => {
    container.live.stop();
  });

  ipcMain.handle(IPC.LIVE_SET_MODE, async (_event, mode: AutomationMode) => {
    if (mode === "FULL_AUTO") container.khepree.assertProductAccess("full_auto");
    container.live.setMode(mode);
  });

  ipcMain.handle(
    IPC.APPROVAL_RESOLVE,
    async (_event, id: string, decision: "approve" | "reject", editedSpeech?: string) => {
      await container.live.resolveApproval(id, decision, editedSpeech);
    }
  );

  ipcMain.handle(IPC.PRODUCT_SAVE, async (_event, product: ProductDNA) => {
    container.khepree.assertProductAccess();
    container.products.save(product);
    container.currentProductId = product.id;
  });

  ipcMain.handle(IPC.KHEPREE_LOGIN, async () => {
    await container.khepree.startLogin();
  });

  ipcMain.handle(IPC.KHEPREE_LOGOUT, async () => {
    await container.khepree.logout();
  });

  // TikTok handlers are intentionally not wired to a live connector in v0.1.
  // The concrete provider is present in connectors/tiktok and should be enabled
  // after a real-account smoke test.
  ipcMain.handle(IPC.TIKTOK_CONNECT, async (_event, uniqueId: string) => {
    if (!uniqueId.trim()) throw new Error("TikTok unique ID required");
    throw new Error("TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION");
  });

  ipcMain.handle(IPC.TIKTOK_DISCONNECT, async () => undefined);
}
