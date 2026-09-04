import type { AppSnapshot } from "../../../shared/ipc";
import { GeminiConnectorPanel } from "./GeminiConnectorPanel";
import { LiveManagerPanel } from "./LiveManagerPanel";
import { TikTokConnectorPanel } from "./TikTokConnectorPanel";

export function ConnectorStubs({ snapshot }: { snapshot: AppSnapshot }) {
  return (
    <>
      <GeminiConnectorPanel gemini={snapshot.gemini} />
      <TikTokConnectorPanel snapshot={snapshot} tiktok={snapshot.tiktok} />
      <LiveManagerPanel snapshot={snapshot} liveManager={snapshot.liveManager} />
    </>
  );
}
