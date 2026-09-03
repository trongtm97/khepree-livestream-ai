import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CircleDollarSign,
  KeyRound,
  MessageSquareText,
  Package,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Square,
  UserRoundCheck,
  Wifi
} from "lucide-react";
import type { AppSnapshot } from "../../shared/ipc";
import type { AutomationMode, ProductDNA } from "../../shared/live-types";

const MODES: AutomationMode[] = [
  "MANUAL_ASSIST",
  "ASSISTED",
  "SUPERVISED_AUTO",
  "FULL_AUTO"
];

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"operator" | "products" | "setup">("operator");

  const refresh = useCallback(async () => {
    setSnapshot(await window.khepreeLivestreamAI.snapshot());
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 1200);
    return () => clearInterval(timer);
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    setLoading(true);
    try { await fn(); await refresh(); }
    catch (error) { alert(String(error)); }
    finally { setLoading(false); }
  };

  if (!snapshot) {
    return <div className="splash">Khepree Livestream AI đang khởi động…</div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">K</div>
          <div>
            <strong>Khepree</strong>
            <span>Livestream AI</span>
          </div>
        </div>

        <nav>
          <button className={tab === "operator" ? "active" : ""} onClick={() => setTab("operator")}>
            <Radio size={18}/> Operator
          </button>
          <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
            <Package size={18}/> Product DNA
          </button>
          <button className={tab === "setup" ? "active" : ""} onClick={() => setTab("setup")}>
            <Bot size={18}/> Connectors
          </button>
        </nav>

        <div className="sidebarBottom">
          <div className={`licenseBadge ${snapshot.khepree.status === "ACTIVE" ? "ok" : "warn"}`}>
            <KeyRound size={16}/>
            <span>{snapshot.khepree.status}</span>
          </div>
          <small>v{snapshot.appVersion}</small>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <h1>{tab === "operator" ? "Live Operator Console" : tab === "products" ? "Product DNA" : "Connector Setup"}</h1>
            <p>Human-supervised autonomy · operator remains in control</p>
          </div>
          <button className="ghost" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={17}/> Refresh
          </button>
        </header>

        {tab === "operator" && (
          <OperatorTab snapshot={snapshot} run={run} />
        )}
        {tab === "products" && (
          <ProductsTab snapshot={snapshot} run={run} />
        )}
        {tab === "setup" && (
          <SetupTab snapshot={snapshot} run={run} />
        )}
      </main>
    </div>
  );
}

function OperatorTab({ snapshot, run }: { snapshot: AppSnapshot; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const pending = snapshot.approvals;
  const healthOk = snapshot.health.filter((x) => x.status === "OK").length;

  return (
    <>
      <section className="metricGrid">
        <Metric icon={<Radio/>} label="LIVE" value={snapshot.liveRunning ? "RUNNING" : "STOPPED"} tone={snapshot.liveRunning ? "green" : "neutral"}/>
        <Metric icon={<ShieldCheck/>} label="Khepree" value={snapshot.khepree.status} tone={snapshot.khepree.status === "ACTIVE" ? "green" : "amber"}/>
        <Metric icon={<MessageSquareText/>} label="Approval queue" value={String(pending.length)} tone={pending.length ? "amber" : "green"}/>
        <Metric icon={<Activity/>} label="Health" value={`${healthOk}/${snapshot.health.length}`} tone={healthOk === snapshot.health.length ? "green" : "amber"}/>
      </section>

      <section className="controlStrip">
        <div className="modeSelect">
          <label>Automation mode</label>
          <select value={snapshot.automationMode} onChange={(e) => void run(() => window.khepreeLivestreamAI.setAutomationMode(e.target.value as AutomationMode))}>
            {MODES.map((mode) => <option key={mode}>{mode}</option>)}
          </select>
        </div>
        <div className="statePill">State: <strong>{snapshot.liveState}</strong></div>
        <div className="grow"/>
        {!snapshot.liveRunning ? (
          <button className="primary" onClick={() => void run(() => window.khepreeLivestreamAI.startLive())}>
            <Play size={18}/> Start AI
          </button>
        ) : (
          <button className="danger" onClick={() => void run(() => window.khepreeLivestreamAI.stopLive())}>
            <Square size={18}/> Stop AI
          </button>
        )}
      </section>

      <section className="twoCol">
        <div className="panel">
          <div className="panelHead">
            <div><h2>Operator approval queue</h2><p>Safe actions can auto-approve after a cancellable delay.</p></div>
            <UserRoundCheck/>
          </div>
          <div className="queue">
            {pending.length === 0 ? (
              <Empty text="No actions waiting for operator."/>
            ) : pending.map((item) => (
              <div className="approvalCard" key={item.id}>
                <div className="approvalMeta">
                  <span>{item.proposal.kind}</span>
                  <span>{Math.round(item.proposal.confidence * 100)}% confidence</span>
                </div>
                <strong>{item.proposal.speech ?? item.proposal.reason}</strong>
                <p>{item.proposal.reason}</p>
                {item.autoApproveAt && <small>Auto approve: {new Date(item.autoApproveAt).toLocaleTimeString()}</small>}
                <div className="row">
                  <button className="primary small" onClick={() => void run(() => window.khepreeLivestreamAI.resolveApproval(item.id, "approve"))}>Approve</button>
                  <button className="ghost small" onClick={() => void run(() => window.khepreeLivestreamAI.resolveApproval(item.id, "reject"))}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelHead">
            <div><h2>Runtime health</h2><p>Every replaceable component reports its own state.</p></div>
            <Wifi/>
          </div>
          <div className="healthList">
            {snapshot.health.map((item) => (
              <div className="healthRow" key={item.component}>
                <span className={`dot ${item.status.toLowerCase()}`}/>
                <div><strong>{item.component}</strong><small>{item.message}</small></div>
                <b>{item.status}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ProductsTab({ snapshot, run }: { snapshot: AppSnapshot; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");

  const save = () => {
    const product: ProductDNA = {
      id: crypto.randomUUID(),
      title: title.trim(),
      priceText: price.trim() || undefined,
      variants: [],
      facts: [],
      benefits: [],
      allowedClaims: [],
      forbiddenClaims: [],
      faq: [],
      updatedAt: new Date().toISOString()
    };
    return run(() => window.khepreeLivestreamAI.saveProduct(product));
  };

  return (
    <section className="twoCol">
      <div className="panel">
        <div className="panelHead">
          <div><h2>Create foundation Product DNA</h2><p>Importers and AI enrichment are next-phase adapters.</p></div>
          <Package/>
        </div>
        <div className="form">
          <label>Product title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Áo thun cotton..." /></label>
          <label>Price text<input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$19.99 / 299.000đ" /></label>
          <button className="primary" disabled={!title.trim()} onClick={() => void save()}>Save product</button>
        </div>
      </div>
      <div className="panel">
        <div className="panelHead"><div><h2>Local products</h2><p>Source of truth for grounded sales answers.</p></div><CircleDollarSign/></div>
        <div className="queue">
          {snapshot.products.length === 0 ? <Empty text="No product imported yet."/> :
            snapshot.products.map((p) => <div className="productRow" key={p.id}><strong>{p.title}</strong><span>{p.priceText || "No price"}</span></div>)}
        </div>
      </div>
    </section>
  );
}

function SetupTab({ snapshot, run }: { snapshot: AppSnapshot; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  return (
    <section className="setupGrid">
      <div className="panel">
        <div className="panelHead"><div><h2>Khepree License</h2><p>PKCE + signed lease + heartbeat boundary.</p></div><ShieldCheck/></div>
        <div className="statusBox">
          <strong>{snapshot.khepree.status}</strong>
          <span>{snapshot.khepree.user ? `${snapshot.khepree.user.name} · ${snapshot.khepree.user.email}` : snapshot.khepree.message ?? "No account session"}</span>
        </div>
        {snapshot.khepree.status !== "ACTIVE" ? (
          <button className="primary" onClick={() => void run(() => window.khepreeLivestreamAI.startKhepreeLogin())}>Connect Khepree</button>
        ) : (
          <button className="ghost" onClick={() => void run(() => window.khepreeLivestreamAI.logoutKhepree())}>Sign out</button>
        )}
      </div>

      <div className="panel">
        <div className="panelHead"><div><h2>Gemini Web</h2><p>Python sidecar prepared; UI onboarding comes next.</p></div><Bot/></div>
        <div className="statusBox"><strong>ADAPTER READY</strong><span>gemini_webapi is not bundled into proprietary core.</span></div>
      </div>

      <div className="panel">
        <div className="panelHead"><div><h2>TikTok LIVE</h2><p>Unofficial Webcast worker + LIVE Manager observer.</p></div><Radio/></div>
        <div className="statusBox"><strong>SMOKE REQUIRED</strong><span>Connector intentionally feature-gated in foundation build.</span></div>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <div className={`metric ${tone}`}><div className="metricIcon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>;
}
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
