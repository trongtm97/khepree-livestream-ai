import "electron-squirrel-startup";
import { app } from "electron";
import { AppContainer } from "./app-container";
import { registerIpc } from "./ipc/register";
import { createMainWindow } from "./window";

let container: AppContainer | undefined;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((x) => x.startsWith("khepreelivestreamai://"));
    if (deepLink) void container?.khepree.handleCallback(deepLink);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (url.startsWith("khepreelivestreamai://")) {
      void container?.khepree.handleCallback(url);
    }
  });

  void app.whenReady().then(async () => {
    app.setAsDefaultProtocolClient("khepreelivestreamai");
    container = new AppContainer();
    registerIpc(container);
    await container.initialize();
    createMainWindow();

    const deepLink = process.argv.find((x) => x.startsWith("khepreelivestreamai://"));
    if (deepLink) await container.khepree.handleCallback(deepLink);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    container?.dispose();
  });
}
