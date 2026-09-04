/**
 * SceneCompositor — builds preview frames from scene + Product DNA + avatar hint.
 * No virtual camera. No fake order counts. Product media only from DNA paths.
 */
import type { ProductDNA } from "../../../shared/live-types";
import type {
  SceneDefinition,
  SceneFrame,
  SceneLayer,
  SceneLayoutId,
  SceneRect,
  SceneResolution
} from "../../../shared/scene-types";
import { getSceneDefinition } from "../../../shared/scene-types";

export type ComposeInput = {
  accountId: string;
  sceneId: SceneLayoutId;
  resolution: SceneResolution;
  product?: ProductDNA;
  /** Opaque avatar status label from AvatarProvider (no pixels required). */
  avatarLabel?: string;
  manualOverride: boolean;
  seq: number;
  /** Optional comment snippet for comment-reply layout — not order counts. */
  commentHint?: string;
};

function rect(x: number, y: number, w: number, h: number): SceneRect {
  return { x, y, w, h };
}

/** 1×1 PNG tinted by scene — mock output without canvas/GPU. */
export function mockPreviewDataUrl(bg: string): string {
  // Fixed tiny transparent PNG; UI paints layers on canvas. Color encoded in fragment for tests.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  return `data:image/png;base64,${png.toString("base64")}#${encodeURIComponent(bg)}`;
}

export function productImagePaths(product: ProductDNA | undefined): string[] {
  if (!product) return [];
  const paths = [
    ...(product.imagePaths ?? []),
    ...(product.videoPaths ?? [])
  ].filter((p) => typeof p === "string" && p.trim().length > 0);
  return paths.map((p) => p.trim());
}

export class SceneCompositor {
  compose(input: ComposeInput): SceneFrame {
    const def = getSceneDefinition(input.sceneId);
    const { width: W, height: H } = input.resolution;
    const layers: SceneLayer[] = [{ type: "background", color: def.background }];

    if (def.avatar) {
      layers.push({
        type: "avatar",
        label: input.avatarLabel?.trim() || "Avatar",
        rect: avatarRect(def, W, H)
      });
    }

    if (def.product) {
      const images = productImagePaths(input.product);
      if (images[0]) {
        layers.push({
          type: "product-image",
          path: images[0],
          rect: productRect(def, W, H)
        });
      }
      // Text overlays strictly from DNA — never invent price/title.
      for (const role of def.overlays) {
        const text = overlayText(role, input.product, input.commentHint);
        if (!text) continue;
        layers.push({
          type: "text",
          role: role === "comment-hint" ? "comment-hint" : role,
          text,
          rect: overlayRect(role, W, H)
        });
      }
    } else {
      for (const role of def.overlays) {
        if (role === "comment-hint") {
          const text = overlayText(role, input.product, input.commentHint);
          if (text) {
            layers.push({
              type: "text",
              role: "comment-hint",
              text,
              rect: overlayRect(role, W, H)
            });
          }
        }
      }
    }

    layers.push({
      type: "text",
      role: "scene-name",
      text: def.name,
      rect: rect(24, 24, W - 48, 40)
    });

    return {
      accountId: input.accountId,
      sceneId: def.id,
      width: W,
      height: H,
      seq: input.seq,
      producedAt: new Date().toISOString(),
      layers,
      manualOverride: input.manualOverride,
      previewDataUrl: mockPreviewDataUrl(def.background)
    };
  }
}

function overlayText(
  role: "title" | "price" | "cta" | "comment-hint",
  product: ProductDNA | undefined,
  commentHint?: string
): string | undefined {
  if (role === "comment-hint") {
    const t = commentHint?.trim();
    return t ? t.slice(0, 80) : undefined;
  }
  if (!product) return undefined;
  if (role === "title") return product.title?.trim() || undefined;
  if (role === "price") {
    const price = product.priceText?.trim();
    if (!price) return undefined;
    const cur = product.currency?.trim();
    return cur ? `${price} ${cur}` : price;
  }
  if (role === "cta") {
    // CTA from DNA claim/benefit — never fake scarcity/order count.
    const claim = product.allowedClaims.find((c) => c.trim())?.trim();
    const benefit = product.benefits.find((b) => b.trim())?.trim();
    return claim || benefit || undefined;
  }
  return undefined;
}

function avatarRect(def: SceneDefinition, W: number, H: number): SceneRect {
  if (def.layout === "host-product" || def.layout === "comment-reply" || def.layout === "offer") {
    return rect(Math.round(W * 0.08), Math.round(H * 0.12), Math.round(W * 0.84), Math.round(H * 0.45));
  }
  return rect(Math.round(W * 0.06), Math.round(H * 0.1), Math.round(W * 0.88), Math.round(H * 0.7));
}

function productRect(def: SceneDefinition, W: number, H: number): SceneRect {
  if (def.layout === "product-focus") {
    return rect(Math.round(W * 0.1), Math.round(H * 0.18), Math.round(W * 0.8), Math.round(H * 0.45));
  }
  return rect(Math.round(W * 0.55), Math.round(H * 0.58), Math.round(W * 0.38), Math.round(H * 0.22));
}

function overlayRect(
  role: "title" | "price" | "cta" | "comment-hint",
  W: number,
  H: number
): SceneRect {
  if (role === "title") return rect(Math.round(W * 0.08), Math.round(H * 0.78), Math.round(W * 0.84), 48);
  if (role === "price") return rect(Math.round(W * 0.08), Math.round(H * 0.84), Math.round(W * 0.5), 40);
  if (role === "cta") return rect(Math.round(W * 0.08), Math.round(H * 0.9), Math.round(W * 0.84), 40);
  return rect(Math.round(W * 0.08), Math.round(H * 0.62), Math.round(W * 0.84), 56);
}
