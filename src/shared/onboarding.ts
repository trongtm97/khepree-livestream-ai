export const ONBOARDING_STEP_COUNT = 7;

export interface OnboardingState {
  completed: boolean;
  /** 1-based step index, inclusive range 1..ONBOARDING_STEP_COUNT */
  currentStep: number;
}

export function normalizeOnboardingStep(step: unknown): number {
  const n = typeof step === "number" ? step : Number(step);
  if (!Number.isFinite(n)) return 1;
  return Math.min(ONBOARDING_STEP_COUNT, Math.max(1, Math.floor(n)));
}

export function normalizeOnboardingState(raw?: Partial<OnboardingState> | null): OnboardingState {
  return {
    completed: Boolean(raw?.completed),
    currentStep: normalizeOnboardingStep(raw?.currentStep ?? 1)
  };
}
