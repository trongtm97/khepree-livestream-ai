/**
 * Scene compositor + engine — mock frames, no GPU.
 */
import { describe, expect, it } from "vitest";
import {
  SceneCompositor,
  productImagePaths
} from "../../src/main/live/scene/scene-compositor";
import { SceneEngine } from "../../src/main/live/scene/scene-engine";
import type { ProductDNA } from "../../src/shared/live-types";
import {
  DEFAULT_SCENE_RESOLUTION,
  normalizeSceneId
} from "../../src/shared/scene-types";

function product(partial?: Partial<ProductDNA>): ProductDNA {
  return {
    id: "p1",
    title: "Áo thun basic",
    priceText: "199.000",
    currency: "VND",
    facts: [],
    benefits: ["Thoáng mát"],
    sizes: ["M"],
    colors: ["Đen"],
    variants: [],
    faq: [],
    allowedClaims: ["Đặt ngay"],
    forbiddenClaims: [],
    imagePaths: partial?.imagePaths,
    videoPaths: partial?.videoPaths,
    updatedAt: new Date().toISOString(),
    ...partial
  };
}

describe("scene compositor", () => {
  it("uses Product DNA text only — no fake order layers", () => {
    const c = new SceneCompositor();
    const frame = c.compose({
      accountId: "acc_a",
      sceneId: "offer",
      resolution: DEFAULT_SCENE_RESOLUTION,
      product: product(),
      manualOverride: false,
      seq: 1
    });
    const texts = frame.layers
      .filter((l) => l.type === "text")
      .map((l) => (l.type === "text" ? l.text : ""));
    expect(texts.some((t) => /order|đơn|sold/i.test(t))).toBe(false);
    expect(texts).toContain("Áo thun basic");
    expect(texts.some((t) => t.includes("199.000"))).toBe(true);
  });

  it("only attaches product-image when DNA has a real path", () => {
    const c = new SceneCompositor();
    const without = c.compose({
      accountId: "a",
      sceneId: "product-focus",
      resolution: DEFAULT_SCENE_RESOLUTION,
      product: product({ imagePaths: [] }),
      manualOverride: false,
      seq: 1
    });
    expect(without.layers.some((l) => l.type === "product-image")).toBe(false);

    const withImg = c.compose({
      accountId: "a",
      sceneId: "product-focus",
      resolution: DEFAULT_SCENE_RESOLUTION,
      product: product({ imagePaths: ["D:/shop/ao.png"] }),
      manualOverride: false,
      seq: 2
    });
    const img = withImg.layers.find((l) => l.type === "product-image");
    expect(img && img.type === "product-image" && img.path).toBe("D:/shop/ao.png");
    expect(productImagePaths(product({ imagePaths: ["  x.jpg  "] }))).toEqual(["x.jpg"]);
  });
});

describe("scene engine", () => {
  it("manual override blocks AI scene until cleared", () => {
    const eng = new SceneEngine({ accountId: "acc_a" });
    eng.setManualScene("offer");
    expect(eng.effectiveSceneId()).toBe("offer");
    const ai = eng.applyAiScene("idle");
    expect(ai.applied).toBe(false);
    expect(eng.effectiveSceneId()).toBe("offer");
    eng.clearManualOverride();
    expect(eng.effectiveSceneId()).toBe("idle");
  });

  it("throttles hidden/card previews without regenerating every call", () => {
    const eng = new SceneEngine({
      accountId: "acc_a",
      focusedMinIntervalMs: 50,
      cardMinIntervalMs: 200
    });
    const a = eng.getPreviewFrame(product(), "focused");
    const b = eng.getPreviewFrame(product(), "focused");
    expect(a?.seq).toBe(b?.seq);
    const hidden = eng.getPreviewFrame(product(), "hidden");
    expect(hidden?.seq).toBe(a?.seq);
  });

  it("normalizes scene aliases", () => {
    expect(normalizeSceneId("Thank You")).toBe("thank-you");
    expect(normalizeSceneId("HOST_PRODUCT")).toBe("host-product");
  });
});
