import { contextBridge, ipcRenderer } from "electron";
import { IPC, type RendererApi } from "../shared/ipc";
import type { AutomationMode, ProductDNA } from "../shared/live-types";

const api: RendererApi = {
  snapshot: () => ipcRenderer.invoke(IPC.APP_SNAPSHOT),
  startLive: () => ipcRenderer.invoke(IPC.LIVE_START),
  stopLive: () => ipcRenderer.invoke(IPC.LIVE_STOP),
  setAutomationMode: (mode: AutomationMode) =>
    ipcRenderer.invoke(IPC.LIVE_SET_MODE, mode),
  resolveApproval: (id, decision, editedSpeech) =>
    ipcRenderer.invoke(IPC.APPROVAL_RESOLVE, id, decision, editedSpeech),
  connectTikTok: (uniqueId: string) =>
    ipcRenderer.invoke(IPC.TIKTOK_CONNECT, uniqueId),
  disconnectTikTok: () => ipcRenderer.invoke(IPC.TIKTOK_DISCONNECT),
  saveProduct: (product: ProductDNA) =>
    ipcRenderer.invoke(IPC.PRODUCT_SAVE, product),
  startKhepreeLogin: () => ipcRenderer.invoke(IPC.KHEPREE_LOGIN),
  logoutKhepree: () => ipcRenderer.invoke(IPC.KHEPREE_LOGOUT)
};

contextBridge.exposeInMainWorld("khepreeLivestreamAI", api);
