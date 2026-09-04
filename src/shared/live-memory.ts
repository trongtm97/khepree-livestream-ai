/**
 * Short-term live memory helpers — no vector DB in V1.
 * Runtime state lives in main; these helpers are shared for tests + caps.
 */

export const LIVE_MEMORY_CAPS = {
  keepSpeech: 20,
  keepResponded: 15,
  keepCta: 8,
  keepQuestions: 15,
  keepComments: 20,
  /** Slices sent to the model — deliberately smaller than keep*. */
  sendSpeech: 6,
  sendResponded: 6,
  sendCta: 4,
  sendQuestions: 6,
  sendComments: 8
} as const;

/** Similarity threshold for anti-repetition (Jaccard on tokens). */
export const SPEECH_SIMILARITY_THRESHOLD = 0.72;

export type MemoryComment = {
  eventId?: string;
  username?: string;
  displayName?: string;
  text: string;
  timestamp?: string;
};

export type LiveMemoryPublicSnapshot = {
  sessionId?: string;
  recentSpeech: string[];
  recentComments: MemoryComment[];
  recentRespondedComments: MemoryComment[];
  recentCta: string[];
  currentProductId?: string;
  lastState: string;
  lastScene?: string;
  recentCustomerQuestions: MemoryComment[];
};

export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  const norm = normalizeSpeech(text);
  if (!norm) return new Set();
  return new Set(norm.split(" ").filter((t) => t.length > 1));
}

/** Jaccard similarity on word tokens — cheap anti-repetition for V1. */
export function speechSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function isSpeechTooSimilar(
  candidate: string,
  recentSpeech: string[],
  threshold = SPEECH_SIMILARITY_THRESHOLD
): boolean {
  const c = candidate.trim();
  if (!c) return false;
  return recentSpeech.some((prev) => speechSimilarity(c, prev) >= threshold);
}

export function looksLikeCtaSpeech(speech: string): boolean {
  return /\b(mua ngay|chốt đơn|đặt ngay|add to cart|checkout|link giỏ|giỏ hàng|order now|buy now|cta)\b/i.test(
    speech
  );
}

export function looksLikeCustomerQuestion(text: string): boolean {
  return (
    /\?/.test(text) ||
    /\b(giá|price|size|ship|shipping|bảo hành|warranty|còn hàng|stock|màu|color)\b/i.test(text)
  );
}

export function takeLast<T>(items: T[], n: number): T[] {
  if (n <= 0) return [];
  return items.length <= n ? [...items] : items.slice(-n);
}

// ponytail: self-check
export function assertLiveMemoryHelpers(): void {
  if (speechSimilarity("xin chào mọi người", "xin chào mọi người") < 0.99) {
    throw new Error("identical speech should be ~1");
  }
  if (isSpeechTooSimilar("Giá hiện tại là 299k nhé", ["Giá hiện tại là 299k nhé các bạn"])) {
    // ok similar
  } else {
    throw new Error("near-duplicate speech should flag too-similar");
  }
  if (isSpeechTooSimilar("Cảm ơn bạn đã follow", ["Giá áo thun là 299000 VND"])) {
    throw new Error("unrelated speech should not flag too-similar");
  }
  if (!looksLikeCtaSpeech("Mua ngay trong giỏ hàng nhé")) {
    throw new Error("CTA detector failed");
  }
  if (takeLast([1, 2, 3, 4], 2).join(",") !== "3,4") {
    throw new Error("takeLast failed");
  }
}
