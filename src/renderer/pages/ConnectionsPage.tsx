import type { AppSnapshot } from "../../shared/ipc";
import { ConnectorStubs } from "../components/connections/ConnectorStubs";
import { KhepreeLicensePanel } from "../components/connections/KhepreeLicensePanel";

export function ConnectionsPage({ snapshot }: { snapshot: AppSnapshot }) {
  return (
    <section className="setupGrid">
      <KhepreeLicensePanel snapshot={snapshot} />
      <ConnectorStubs snapshot={snapshot} />
    </section>
  );
}
