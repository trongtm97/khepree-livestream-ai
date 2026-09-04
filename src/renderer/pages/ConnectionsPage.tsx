import type { AppSnapshot } from "../../shared/ipc";
import { ConnectorStubs } from "../components/connections/ConnectorStubs";
import { KhepreeLicensePanel } from "../components/connections/KhepreeLicensePanel";
import { TikTokAccountsPanel } from "../components/connections/TikTokAccountsPanel";

export function ConnectionsPage({ snapshot }: { snapshot: AppSnapshot }) {
  return (
    <section className="setupStack">
      <TikTokAccountsPanel snapshot={snapshot} />
      <div className="setupGrid">
        <KhepreeLicensePanel snapshot={snapshot} />
        <ConnectorStubs snapshot={snapshot} />
      </div>
    </section>
  );
}
