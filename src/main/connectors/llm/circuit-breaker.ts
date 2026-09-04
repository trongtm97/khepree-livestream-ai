/** Simple consecutive-failure circuit for Gemini requests. */
export class CircuitBreaker {
  private failures = 0;
  private openUntilMs = 0;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 60_000
  ) {}

  get isOpen(): boolean {
    return Date.now() < this.openUntilMs;
  }

  get remainingMs(): number {
    return Math.max(0, this.openUntilMs - Date.now());
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntilMs = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntilMs = Date.now() + this.cooldownMs;
      this.failures = 0;
    }
  }

  reset(): void {
    this.failures = 0;
    this.openUntilMs = 0;
  }
}
