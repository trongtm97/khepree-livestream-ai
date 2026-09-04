import { useState, type ReactNode } from "react";
import type {
  GeminiProbeResult,
  GeminiPublicState,
  GeminiTestResult
} from "../../../shared/gemini-contracts";
import { useAppShell } from "../../app/AppShellContext";
import type { MessageKey } from "../../i18n/types";

type Step =
  | "intro"
  | "worker"
  | "dependency"
  | "login"
  | "testConnect"
  | "models"
  | "testPrompt"
  | "done";

const STEPS: Step[] = [
  "intro",
  "worker",
  "dependency",
  "login",
  "testConnect",
  "models",
  "testPrompt",
  "done"
];

type Props = {
  gemini: GeminiPublicState;
  onDone: () => void;
  onCancel?: () => void;
};

export function GeminiOnboardingWizard({ gemini, onDone, onCancel }: Props) {
  const { t, run, refresh, notify } = useAppShell();
  const [step, setStep] = useState<Step>("intro");
  const [probe, setProbe] = useState<GeminiProbeResult | null>(null);
  const [testResult, setTestResult] = useState<GeminiTestResult | null>(null);
  const [promptResult, setPromptResult] = useState<GeminiTestResult | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(gemini.model ?? "");

  const stepIndex = STEPS.indexOf(step);
  const go = (next: Step) => setStep(next);

  const runProbe = () =>
    run(async () => {
      setGuide(null);
      const result = await window.khepreeLivestreamAI.probeGemini();
      setProbe(result);
      await refresh();
      if (!result.workerOk) {
        setGuide(guideForProbe(result.guideCode));
        return;
      }
      go("dependency");
    });

  const confirmDependency = () => {
    if (probe && !probe.dependencyInstalled) {
      setGuide("gemini.guide.dependency");
      return;
    }
    go("login");
  };

  const doLogin = () =>
    run(async () => {
      setGuide(null);
      try {
        await window.khepreeLivestreamAI.connectGemini();
        notify({ tone: "success", title: t("gemini.toast.connected") });
        await refresh();
        go("testConnect");
      } catch (error) {
        setGuide(guideForError(error));
        throw error;
      }
    });

  const doTestConnect = () =>
    run(async () => {
      setGuide(null);
      const result = await window.khepreeLivestreamAI.testGemini();
      setTestResult(result);
      await refresh();
      if (!result.ok) {
        setGuide("gemini.guide.testFailed");
        return;
      }
      const models = await window.khepreeLivestreamAI.listGeminiModels();
      const snap = await window.khepreeLivestreamAI.getGeminiState();
      setSelectedModel(snap.model ?? models[0] ?? "");
      go("models");
    });

  const saveModel = () =>
    run(async () => {
      if (!selectedModel.trim()) {
        setGuide("gemini.guide.pickModel");
        return;
      }
      await window.khepreeLivestreamAI.setGeminiModel(selectedModel.trim());
      notify({ tone: "success", title: t("gemini.toast.modelSaved") });
      await refresh();
      go("testPrompt");
    });

  const doTestPrompt = () =>
    run(async () => {
      setGuide(null);
      const result = await window.khepreeLivestreamAI.testGemini(
        "Bạn là trợ lý bán hàng. Trả lời đúng một câu ngắn: Gemini đã sẵn sàng."
      );
      setPromptResult(result);
      await refresh();
      if (!result.ok) {
        setGuide("gemini.guide.testFailed");
        return;
      }
      go("done");
    });

  return (
    <div className="geminiWizard">
      <div className="geminiWizardProgress" aria-hidden>
        <div style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
      </div>
      <p className="geminiWizardStepLabel">
        {t("gemini.wizard.progress", { step: stepIndex + 1, total: STEPS.length })}
      </p>

      {step === "intro" && (
        <WizardBody title={t("gemini.wizard.introTitle")} body={t("gemini.wizard.introBody")}>
          <button type="button" className="primary" onClick={() => go("worker")}>
            {t("gemini.wizard.start")}
          </button>
        </WizardBody>
      )}

      {step === "worker" && (
        <WizardBody title={t("gemini.wizard.workerTitle")} body={t("gemini.wizard.workerBody")}>
          {probe && !probe.workerOk ? (
            <p className="geminiGuide">{t(guideForProbe(probe.guideCode) as MessageKey)}</p>
          ) : null}
          <div className="row geminiActions">
            <button type="button" className="primary" onClick={() => void runProbe()}>
              {t("gemini.wizard.checkWorker")}
            </button>
            {probe?.workerOk ? (
              <button type="button" className="ghost" onClick={() => go("dependency")}>
                {t("gemini.wizard.continue")}
              </button>
            ) : null}
          </div>
        </WizardBody>
      )}

      {step === "dependency" && (
        <WizardBody
          title={t("gemini.wizard.depTitle")}
          body={t("gemini.wizard.depBody")}
        >
          <Status ok={Boolean(probe?.dependencyInstalled)}
            okText={t("gemini.wizard.depOk")}
            offText={t("gemini.wizard.depBad")}
          />
          {probe && !probe.dependencyInstalled ? (
            <p className="geminiGuide">{t("gemini.guide.dependency")}</p>
          ) : null}
          <div className="row geminiActions">
            <button type="button" className="ghost" onClick={() => void runProbe()}>
              {t("gemini.wizard.recheck")}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!probe?.dependencyInstalled}
              onClick={confirmDependency}
            >
              {t("gemini.wizard.continue")}
            </button>
          </div>
        </WizardBody>
      )}

      {step === "login" && (
        <WizardBody title={t("gemini.wizard.loginTitle")} body={t("gemini.wizard.loginBody")}>
          <ol className="geminiStepsList">
            <li>{t("gemini.wizard.loginStep1")}</li>
            <li>{t("gemini.wizard.loginStep2")}</li>
            <li>{t("gemini.wizard.loginStep3")}</li>
          </ol>
          {guide ? <p className="geminiGuide">{t(guide as MessageKey)}</p> : null}
          <div className="row geminiActions">
            <button type="button" className="primary" onClick={() => void doLogin()}>
              {t("gemini.connect")}
            </button>
          </div>
        </WizardBody>
      )}

      {step === "testConnect" && (
        <WizardBody title={t("gemini.wizard.testTitle")} body={t("gemini.wizard.testBody")}>
          {testResult ? (
            <p className={testResult.ok ? "geminiOkNote" : "geminiGuide"}>
              {testResult.ok
                ? t("gemini.wizard.testOk", { ms: testResult.latencyMs })
                : t("gemini.guide.testFailed")}
            </p>
          ) : null}
          {guide ? <p className="geminiGuide">{t(guide as MessageKey)}</p> : null}
          <div className="row geminiActions">
            <button type="button" className="primary" onClick={() => void doTestConnect()}>
              {t("gemini.wizard.runTest")}
            </button>
            {testResult?.ok ? (
              <button type="button" className="ghost" onClick={() => go("models")}>
                {t("gemini.wizard.continue")}
              </button>
            ) : null}
          </div>
        </WizardBody>
      )}

      {step === "models" && (
        <WizardBody title={t("gemini.wizard.modelTitle")} body={t("gemini.wizard.modelBody")}>
          <label className="geminiModelLabel">
            {t("gemini.model")}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {(gemini.models.length ? gemini.models : selectedModel ? [selectedModel] : []).map(
                (m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                )
              )}
            </select>
          </label>
          {guide ? <p className="geminiGuide">{t(guide as MessageKey)}</p> : null}
          <button type="button" className="primary" onClick={() => void saveModel()}>
            {t("gemini.wizard.saveModel")}
          </button>
        </WizardBody>
      )}

      {step === "testPrompt" && (
        <WizardBody
          title={t("gemini.wizard.promptTitle")}
          body={t("gemini.wizard.promptBody")}
        >
          {promptResult?.ok ? (
            <blockquote className="geminiSample">{promptResult.text}</blockquote>
          ) : null}
          {guide ? <p className="geminiGuide">{t(guide as MessageKey)}</p> : null}
          <div className="row geminiActions">
            <button type="button" className="primary" onClick={() => void doTestPrompt()}>
              {t("gemini.wizard.runPrompt")}
            </button>
            {promptResult?.ok ? (
              <button type="button" className="ghost" onClick={() => go("done")}>
                {t("gemini.wizard.continue")}
              </button>
            ) : null}
          </div>
        </WizardBody>
      )}

      {step === "done" && (
        <WizardBody title={t("gemini.wizard.doneTitle")} body={t("gemini.wizard.doneBody")}>
          <button
            type="button"
            className="primary"
            onClick={() => {
              notify({ tone: "success", title: t("gemini.toast.setupDone") });
              onDone();
            }}
          >
            {t("gemini.wizard.finish")}
          </button>
        </WizardBody>
      )}

      {onCancel && step !== "done" ? (
        <button type="button" className="ghost geminiWizardCancel" onClick={onCancel}>
          {t("products.cancel")}
        </button>
      ) : null}
    </div>
  );
}

function WizardBody({
  title,
  body,
  children
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="geminiWizardBody">
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}

function Status({
  ok,
  okText,
  offText
}: {
  ok: boolean;
  okText: string;
  offText: string;
}) {
  return <p className={ok ? "geminiOkNote" : "geminiGuide"}>{ok ? okText : offText}</p>;
}

function guideForProbe(code: GeminiProbeResult["guideCode"] | undefined): MessageKey {
  switch (code) {
    case "PYTHON_MISSING":
      return "gemini.guide.python";
    case "WORKER_SCRIPT_MISSING":
      return "gemini.guide.script";
    case "WORKER_TIMEOUT":
      return "gemini.guide.timeout";
    case "DEPENDENCY_MISSING":
      return "gemini.guide.dependency";
    default:
      return "gemini.guide.worker";
  }
}

function guideForError(error: unknown): MessageKey {
  const msg = String(error instanceof Error ? error.message : error);
  if (msg.includes("DEPENDENCY")) return "gemini.guide.dependency";
  if (msg.includes("BROWSER")) return "gemini.guide.browser";
  if (msg.includes("REAUTH")) return "gemini.guide.reauth";
  if (msg.includes("PYTHON_WORKER_STARTUP")) return "gemini.guide.timeout";
  if (msg.includes("PYTHON_WORKER_SCRIPT")) return "gemini.guide.script";
  if (msg.includes("PYTHON_WORKER")) return "gemini.guide.python";
  return "gemini.guide.init";
}
