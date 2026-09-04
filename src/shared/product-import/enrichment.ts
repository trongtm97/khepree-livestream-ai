import type { ProductEnrichmentProvider, ProductEnrichmentRequest, ProductEnrichmentResult } from "./types";

/** Default V1 enrichment — no Gemini wire; never invents facts. */
export class NoopProductEnrichmentProvider implements ProductEnrichmentProvider {
  readonly id = "noop";

  async available(): Promise<boolean> {
    return false;
  }

  async enrich(_request: ProductEnrichmentRequest): Promise<ProductEnrichmentResult> {
    return {
      provider: this.id,
      patch: {},
      notes: ["Enrichment unavailable — fill Product DNA manually or connect Gemini later."]
    };
  }
}

/**
 * Placeholder for Gemini-backed enrichment.
 * Does not call the worker until Gemini is wired into AppContainer.
 */
export class GeminiProductEnrichmentProvider implements ProductEnrichmentProvider {
  readonly id = "gemini";

  async available(): Promise<boolean> {
    return false;
  }

  async enrich(_request: ProductEnrichmentRequest): Promise<ProductEnrichmentResult> {
    return {
      provider: this.id,
      patch: {},
      notes: [
        "Gemini enrichment hook is reserved. Connect GeminiWorkerProvider before enabling auto-fill.",
        "Never invent price, stock, size, shipping, warranty, or regulated claims."
      ]
    };
  }
}

let enrichmentProvider: ProductEnrichmentProvider = new NoopProductEnrichmentProvider();

/** App/main can swap in a real provider later without changing UI call sites. */
export function setProductEnrichmentProvider(provider: ProductEnrichmentProvider): void {
  enrichmentProvider = provider;
}

export function getProductEnrichmentProvider(): ProductEnrichmentProvider {
  return enrichmentProvider;
}

export async function enrichProductDraft(
  request: ProductEnrichmentRequest
): Promise<ProductEnrichmentResult> {
  const provider = getProductEnrichmentProvider();
  if (!(await provider.available())) {
    return {
      provider: provider.id,
      patch: {},
      notes: ["Enrichment provider not available."]
    };
  }
  return provider.enrich(request);
}
