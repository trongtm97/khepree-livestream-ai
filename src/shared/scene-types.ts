/**
 * Livestream scene definitions — TikTok vertical-first.
 * Overlay text must come from Product DNA; never invent order counts.
 */
export type SceneAspectRatio = "9:16";

export type SceneResolutionPreset = "720x1280" | "1080x1920" | "custom";

export type SceneResolution = {
  width: number;
  height: number;
  preset: SceneResolutionPreset;
};

export const SCENE_RESOLUTION_PRESETS: Record<
  Exclude<SceneResolutionPreset, "custom">,
  SceneResolution
> = {
  "720x1280": { width: 720, height: 1280, preset: "720x1280" },
  "1080x1920": { width: 1080, height: 1920, preset: "1080x1920" }
};

export const DEFAULT_SCENE_RESOLUTION = SCENE_RESOLUTION_PRESETS["720x1280"];

export type SceneLayoutId =
  | "host-only"
  | "host-product"
  | "product-focus"
  | "comment-reply"
  | "offer"
  | "thank-you"
  | "idle";

export type SceneTransition = "cut" | "fade";

export type SceneSlot =
  | "background"
  | "avatar"
  | "product"
  | "overlay-title"
  | "overlay-price"
  | "overlay-cta"
  | "overlay-comment";

export type SceneDefinition = {
  id: SceneLayoutId;
  name: string;
  aspectRatio: SceneAspectRatio;
  background: string;
  /** Whether avatar feed is shown. */
  avatar: boolean;
  /** Whether product media/text from DNA is shown. */
  product: boolean;
  overlays: Array<"title" | "price" | "cta" | "comment-hint">;
  layout: SceneLayoutId;
  transition: SceneTransition;
};

export const DEFAULT_SCENES: SceneDefinition[] = [
  {
    id: "host-only",
    name: "Host Only",
    aspectRatio: "9:16",
    background: "#0b1220",
    avatar: true,
    product: false,
    overlays: [],
    layout: "host-only",
    transition: "cut"
  },
  {
    id: "host-product",
    name: "Host + Product",
    aspectRatio: "9:16",
    background: "#101826",
    avatar: true,
    product: true,
    overlays: ["title", "price"],
    layout: "host-product",
    transition: "fade"
  },
  {
    id: "product-focus",
    name: "Product Focus",
    aspectRatio: "9:16",
    background: "#121a2a",
    avatar: false,
    product: true,
    overlays: ["title", "price", "cta"],
    layout: "product-focus",
    transition: "fade"
  },
  {
    id: "comment-reply",
    name: "Comment Reply",
    aspectRatio: "9:16",
    background: "#0f1624",
    avatar: true,
    product: true,
    overlays: ["title", "comment-hint"],
    layout: "comment-reply",
    transition: "cut"
  },
  {
    id: "offer",
    name: "Offer",
    aspectRatio: "9:16",
    background: "#1a1420",
    avatar: true,
    product: true,
    overlays: ["title", "price", "cta"],
    layout: "offer",
    transition: "fade"
  },
  {
    id: "thank-you",
    name: "Thank You",
    aspectRatio: "9:16",
    background: "#0e1a16",
    avatar: true,
    product: false,
    overlays: [],
    layout: "thank-you",
    transition: "fade"
  },
  {
    id: "idle",
    name: "Idle",
    aspectRatio: "9:16",
    background: "#0a0e16",
    avatar: true,
    product: false,
    overlays: [],
    layout: "idle",
    transition: "cut"
  }
];

export function normalizeSceneId(raw: string | null | undefined): SceneLayoutId {
  const s = (raw ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  const aliases: Record<string, SceneLayoutId> = {
    "host-only": "host-only",
    host: "host-only",
    default: "host-only",
    "host-product": "host-product",
    "host+product": "host-product",
    "product-focus": "product-focus",
    product: "product-focus",
    "comment-reply": "comment-reply",
    comment: "comment-reply",
    offer: "offer",
    "thank-you": "thank-you",
    thanks: "thank-you",
    idle: "idle"
  };
  return aliases[s] ?? "host-only";
}

export function getSceneDefinition(id: SceneLayoutId): SceneDefinition {
  return DEFAULT_SCENES.find((x) => x.id === id) ?? DEFAULT_SCENES[0]!;
}

export type SceneRect = { x: number; y: number; w: number; h: number };

export type SceneLayer =
  | { type: "background"; color: string }
  | { type: "avatar"; label: string; rect: SceneRect }
  | {
      type: "product-image";
      /** Absolute path from Product DNA only — never generated. */
      path: string;
      rect: SceneRect;
    }
  | {
      type: "text";
      role: "title" | "price" | "cta" | "comment-hint" | "scene-name";
      text: string;
      rect: SceneRect;
    };

export type SceneFrame = {
  accountId: string;
  sceneId: SceneLayoutId;
  width: number;
  height: number;
  seq: number;
  producedAt: string;
  layers: SceneLayer[];
  /** Operator override active — AI SET_SCENE deferred. */
  manualOverride: boolean;
  /** Tiny mock PNG for <img> without GPU. */
  previewDataUrl: string;
};

export type SceneEnginePublicState = {
  accountId: string;
  sceneId: SceneLayoutId;
  sceneName: string;
  resolution: SceneResolution;
  manualOverride: boolean;
  lastFrameAt?: string;
};
