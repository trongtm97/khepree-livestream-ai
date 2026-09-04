import React, { useState } from "react";
import type { AppSnapshot } from "../../shared/ipc";
import {
  ONBOARDING_STEP_COUNT,
  normalizeOnboardingStep,
  type OnboardingState
} from "../../shared/onboarding";
import type { ProductDNA } from "../../shared/live-types";
import { emptyProductDraft } from "../../shared/product-dna";
import { useAppShell } from "../app/AppShellContext";
import { buildReadiness, readinessMark } from "../app/readiness";
import { GeminiOnboardingWizard } from "../components/connections/GeminiOnboardingWizard";
import { TikTokConnectorPanel } from "../components/connections/TikTokConnectorPanel";

export function OnboardingWizard({
  snapshot,
  onFinished
}: {
  snapshot: AppSnapshot;
  onFinished: () => void;
}) {
  const { t, run, loading, refresh } = useAppShell();
  const [step, setStep] = useState(() => normalizeOnboardingStep(snapshot.onboarding.currentStep));
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [geminiSetup, setGeminiSetup] = useState(false);
  const readiness = buildReadiness(snapshot, t);

  const persist = async (next: OnboardingState) => {
    await window.khepreeLivestreamAI.setOnboarding(next);
    await refresh();
  };

  const goTo = async (nextStep: number) => {
    const currentStep = normalizeOnboardingStep(nextStep);
    setStep(currentStep);
    await persist({ completed: false, currentStep });
  };

  const finish = async () => {
    await persist({ completed: true, currentStep: ONBOARDING_STEP_COUNT });
    onFinished();
  };

  const skipAll = async () => {
    await persist({ completed: true, currentStep: step });
    onFinished();
  };

  const khepreeOk = snapshot.khepree.status === "ACTIVE";
  const geminiOk = readiness.items.find((x) => x.id === "gemini")?.ready ?? false;
  const tiktokOk = readiness.items.find((x) => x.id === "tiktok")?.ready ?? false;
  const voiceOk = readiness.items.find((x) => x.id === "voice")?.ready ?? false;
  const cameraOk = readiness.items.find((x) => x.id === "camera")?.ready ?? false;

  return (
    <div className="onboardingShell">
      <div className="onboardingCard">
        <div className="onboardingTop">
          <strong>Khepree Livestream AI</strong>
          <span>{t("onboarding.progress", { step, total: ONBOARDING_STEP_COUNT })}</span>
        </div>

        <div className="onboardingProgressTrack">
          <div
            className="onboardingProgressFill"
            style={{ width: `${(step / ONBOARDING_STEP_COUNT) * 100}%` }}
          />
        </div>

        {step === 1 && (
          <StepBody title={t("onboarding.step1.title")} body={t("onboarding.step1.body")}>
            <button type="button" className="primary" disabled={loading} onClick={() => void goTo(2)}>
              {t("onboarding.step1.cta")}
            </button>
          </StepBody>
        )}

        {step === 2 && (
          <StepBody title={t("onboarding.step2.title")} body={t("onboarding.step2.body")}>
            <StatusLine ok={khepreeOk} okText={t("onboarding.step2.statusOn")} offText={t("onboarding.step2.statusOff")} />
            <div className="row onboardingActions">
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() => void run(() => window.khepreeLivestreamAI.startKhepreeLogin())}
              >
                {t("onboarding.step2.cta")}
              </button>
              <button type="button" className="ghost" disabled={loading} onClick={() => void goTo(3)}>
                {t("onboarding.next")}
              </button>
            </div>
          </StepBody>
        )}

        {step === 3 && (
          <StepBody title={t("onboarding.step3.title")} body={t("onboarding.step3.body")}>
            <StatusLine ok={geminiOk} okText={t("onboarding.step3.statusOn")} offText={t("onboarding.step3.statusOff")} />
            {!geminiSetup ? (
              <div className="row onboardingActions">
                <button
                  type="button"
                  className="primary"
                  disabled={loading}
                  onClick={() => setGeminiSetup(true)}
                >
                  {t("onboarding.step3.cta")}
                </button>
                <button type="button" className="ghost" disabled={loading} onClick={() => void goTo(4)}>
                  {t("onboarding.later")}
                </button>
              </div>
            ) : (
              <GeminiOnboardingWizard
                gemini={snapshot.gemini}
                onDone={() => {
                  setGeminiSetup(false);
                  void goTo(4);
                }}
                onCancel={() => setGeminiSetup(false)}
              />
            )}
          </StepBody>
        )}

        {step === 4 && (
          <StepBody title={t("onboarding.step4.title")} body={t("onboarding.step4.body")}>
            <StatusLine ok={tiktokOk} okText={t("onboarding.step4.statusOn")} offText={t("onboarding.step4.statusOff")} />
            <TikTokConnectorPanel snapshot={snapshot} tiktok={snapshot.tiktok} />
            <p className="onboardingHonest">{t("onboarding.step4.honest")}</p>
            <div className="row onboardingActions">
              <button type="button" className="primary" disabled={loading} onClick={() => void goTo(5)}>
                {t("onboarding.next")}
              </button>
              <button type="button" className="ghost" disabled={loading} onClick={() => void goTo(5)}>
                {t("onboarding.later")}
              </button>
            </div>
          </StepBody>
        )}

        {step === 5 && (
          <StepBody title={t("onboarding.step5.title")} body={t("onboarding.step5.body")}>
            <p className="onboardingHonest">
              {snapshot.products.length > 0
                ? t("onboarding.step5.saved", { count: snapshot.products.length })
                : t("onboarding.step5.empty")}
            </p>
            {!khepreeOk ? (
              <p className="onboardingHonest">{t("onboarding.step2.statusOff")}</p>
            ) : null}
            <div className="form onboardingForm">
              <label>
                {t("onboarding.step5.titleLabel")}
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                {t("onboarding.step5.priceLabel")}
                <input value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
            </div>
            <div className="row onboardingActions">
              <button
                type="button"
                className="primary"
                disabled={loading || !title.trim() || !khepreeOk}
                onClick={() =>
                  void run(async () => {
                    const product: ProductDNA = emptyProductDraft({
                      title: title.trim(),
                      priceText: price.trim() || undefined
                    });
                    await window.khepreeLivestreamAI.saveProduct(product);
                    setTitle("");
                    setPrice("");
                    await goTo(6);
                  })
                }
              >
                {t("onboarding.step5.cta")}
              </button>
              <button type="button" className="ghost" disabled={loading} onClick={() => void goTo(6)}>
                {t("onboarding.later")}
              </button>
            </div>
          </StepBody>
        )}

        {step === 6 && (
          <StepBody title={t("onboarding.step6.title")} body={t("onboarding.step6.body")}>
            <div className="onboardingMediaStatus">
              <StatusLine
                ok={voiceOk}
                okText={t("onboarding.step6.voice")}
                offText={`${t("onboarding.step6.voice")}: ${t("onboarding.step6.notReady")}`}
              />
              <StatusLine
                ok={cameraOk}
                okText={t("onboarding.step6.camera")}
                offText={`${t("onboarding.step6.camera")}: ${t("onboarding.step6.notReady")}`}
              />
            </div>
            <button type="button" className="primary" disabled={loading} onClick={() => void goTo(7)}>
              {t("onboarding.next")}
            </button>
          </StepBody>
        )}

        {step === 7 && (
          <StepBody title={t("onboarding.step7.title")} body={t("onboarding.step7.body")}>
            <div className="onboardingChecklist">
              {readiness.items.map((item) => (
                <div key={item.id} className={`checkCard ${item.tone}`}>
                  <div className={`checkMark ${item.ready ? "yes" : item.severity === "OPTIONAL" ? "opt" : "no"}`}>
                    {readinessMark(item)}
                  </div>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="primary" disabled={loading} onClick={() => void finish()}>
              {t("onboarding.step7.cta")}
            </button>
          </StepBody>
        )}

        <div className="onboardingFooter">
          {step > 1 ? (
            <button type="button" className="ghost small" disabled={loading} onClick={() => void goTo(step - 1)}>
              {t("onboarding.back")}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="ghost small" disabled={loading} onClick={() => void skipAll()}>
            {t("onboarding.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepBody({
  title,
  body,
  children
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="onboardingStep">
      <h1>{title}</h1>
      {body.split("\n\n").map((para) => (
        <p key={para.slice(0, 32)}>{para}</p>
      ))}
      <div className="onboardingStepBody">{children}</div>
    </div>
  );
}

function StatusLine({
  ok,
  okText,
  offText
}: {
  ok: boolean;
  okText: string;
  offText: string;
}) {
  return (
    <div className={`onboardingStatus ${ok ? "ok" : "off"}`}>
      <span className="overallDot" />
      {ok ? okText : offText}
    </div>
  );
}
