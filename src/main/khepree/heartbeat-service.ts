import { powerMonitor } from "electron";
import { KhepreeAccessService } from "./khepree-access-service";

export class KhepreeHeartbeatService {
  private timer?: NodeJS.Timeout;

  constructor(private readonly access: KhepreeAccessService) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.access.heartbeat(), 60_000);
    powerMonitor.on("resume", this.onResume);
    powerMonitor.on("unlock-screen", this.onResume);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    powerMonitor.off("resume", this.onResume);
    powerMonitor.off("unlock-screen", this.onResume);
  }

  private readonly onResume = () => {
    void this.access.heartbeat();
  };
}
