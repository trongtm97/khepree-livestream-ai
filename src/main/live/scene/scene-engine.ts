/**
 * SceneEngine — per-account scene state + throttled preview frames.
 * Manual operator override beats AI SET_SCENE until cleared.
 */
import type { ProductDNA } from "../../../shared/live-types";
import type {
  SceneEnginePublicState,
  SceneFrame,
  SceneLayoutId,
  SceneResolution
} from "../../../shared/scene-types";
import {
  DEFAULT_SCENE_RESOLUTION,
  DEFAULT_SCENES,
  getSceneDefinition,
  normalizeSceneId,
  SCENE_RESOLUTION_PRESETS
} from "../../../shared/scene-types";
import { SceneCompositor } from "./scene-compositor";

export type PreviewPriority = "focused" | "card" | "hidden";

export type SceneEngineOptions = {
  accountId: string;
  /** Min ms between frames for focused preview. */
  focusedMinIntervalMs?: number;
  /** Min ms between frames for off-focus cards. */
  cardMinIntervalMs?: number;
};

export class SceneEngine {
  readonly accountId: string;
  private sceneId: SceneLayoutId = "host-only";
  private resolution: SceneResolution = { ...DEFAULT_SCENE_RESOLUTION };
  private manualOverride = false;
  private manualSceneId: SceneLayoutId | undefined;
  private seq = 0;
  private lastFrame: SceneFrame | undefined;
  private lastProduceAt = 0;
  private readonly compositor = new SceneCompositor();
  private readonly focusedMinIntervalMs: number;
  private readonly cardMinIntervalMs: number;
  private avatarLabel = "Avatar";
  private commentHint: string | undefined;

  constructor(opts: SceneEngineOptions) {
    this.accountId = opts.accountId;
    this.focusedMinIntervalMs = opts.focusedMinIntervalMs ?? 100; // ~10 FPS cap
    this.cardMinIntervalMs = opts.cardMinIntervalMs ?? 500; // ~2 FPS
  }

  listScenes() {
    return DEFAULT_SCENES.map((s) => ({ id: s.id, name: s.name }));
  }

  getPublicState(): SceneEnginePublicState {
    const id = this.effectiveSceneId();
    return {
      accountId: this.accountId,
      sceneId: id,
      sceneName: getSceneDefinition(id).name,
      resolution: { ...this.resolution },
      manualOverride: this.manualOverride,
      lastFrameAt: this.lastFrame?.producedAt
    };
  }

  effectiveSceneId(): SceneLayoutId {
    if (this.manualOverride && this.manualSceneId) return this.manualSceneId;
    return this.sceneId;
  }

  /** AI SET_SCENE — deferred while operator override is on. */
  applyAiScene(raw: string): { applied: boolean; sceneId: SceneLayoutId } {
    const id = normalizeSceneId(raw);
    this.sceneId = id;
    if (this.manualOverride) {
      return { applied: false, sceneId: this.effectiveSceneId() };
    }
    return { applied: true, sceneId: id };
  }

  /** Operator manual scene — always wins. */
  setManualScene(raw: string): SceneLayoutId {
    const id = normalizeSceneId(raw);
    this.manualOverride = true;
    this.manualSceneId = id;
    this.sceneId = id;
    return id;
  }

  clearManualOverride(): void {
    this.manualOverride = false;
    this.manualSceneId = undefined;
  }

  setResolution(preset: "720x1280" | "1080x1920"): SceneResolution {
    this.resolution = { ...SCENE_RESOLUTION_PRESETS[preset] };
    return this.resolution;
  }

  setCustomResolution(width: number, height: number): SceneResolution {
    const w = Math.max(360, Math.min(2160, Math.floor(width)));
    const h = Math.max(640, Math.min(3840, Math.floor(height)));
    this.resolution = { width: w, height: h, preset: "custom" };
    return this.resolution;
  }

  setAvatarLabel(label: string): void {
    this.avatarLabel = label.trim() || "Avatar";
  }

  setCommentHint(text: string | undefined): void {
    this.commentHint = text?.trim() || undefined;
  }

  /**
   * Resource-conscious preview: hidden → cached/null; card → low FPS; focused → higher.
   */
  getPreviewFrame(
    product: ProductDNA | undefined,
    priority: PreviewPriority
  ): SceneFrame | null {
    if (priority === "hidden") {
      return this.lastFrame ?? null;
    }
    const minInterval =
      priority === "focused" ? this.focusedMinIntervalMs : this.cardMinIntervalMs;
    const now = Date.now();
    if (this.lastFrame && now - this.lastProduceAt < minInterval) {
      return this.lastFrame;
    }
    this.seq += 1;
    this.lastFrame = this.compositor.compose({
      accountId: this.accountId,
      sceneId: this.effectiveSceneId(),
      resolution: this.resolution,
      product,
      avatarLabel: this.avatarLabel,
      manualOverride: this.manualOverride,
      seq: this.seq,
      commentHint: this.commentHint
    });
    this.lastProduceAt = now;
    return this.lastFrame;
  }
}
