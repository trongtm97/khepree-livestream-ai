import type { vi } from "./vi";

export type MessageKey = keyof typeof vi;

export type TranslateFn = (
  key: MessageKey,
  vars?: Record<string, string | number>
) => string;
