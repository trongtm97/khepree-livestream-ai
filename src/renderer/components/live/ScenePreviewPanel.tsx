/**
 * Local livestream scene preview — draws compositor layers on canvas.
 * Throttles when not visible (IntersectionObserver → hidden priority).
 */
import { useEffect, useRef, useState } from "react";
import type { SceneFrame, SceneLayoutId } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";

type Props = {
  accountId: string;
  /** When true, request focused (~10fps); else card (~2fps) if visible. */
  focused?: boolean;
};

export function ScenePreviewPanel({ accountId, focused = true }: Props) {
  const { t, loading, run, notify, refresh } = useAppShell();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);
  const [frame, setFrame] = useState<SceneFrame | null>(null);
  const [scenes, setScenes] = useState<Array<{ id: SceneLayoutId; name: string }>>([]);
  const [sceneId, setSceneId] = useState<string>("host-only");
  const [resolution, setResolution] = useState<"720x1280" | "1080x1920">("720x1280");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    void window.khepreeLivestreamAI.listScenes().then(setScenes).catch(() => setScenes([]));
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const priority = !visible ? "hidden" : focused ? "focused" : "card";
      try {
        const next = await window.khepreeLivestreamAI.getScenePreviewFrame(
          accountId,
          priority
        );
        if (!cancelled && next) setFrame(next);
        const st = await window.khepreeLivestreamAI.getSceneState(accountId);
        if (!cancelled) {
          setSceneId(st.sceneId);
          setManual(st.manualOverride);
          if (st.resolution.preset === "1080x1920" || st.resolution.preset === "720x1280") {
            setResolution(st.resolution.preset);
          }
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        const delay = !visible ? 2000 : focused ? 120 : 600;
        window.setTimeout(() => void tick(), delay);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [accountId, focused, visible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(1, 360 / frame.width);
    canvas.width = Math.round(frame.width * scale);
    canvas.height = Math.round(frame.height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const layer of frame.layers) {
      if (layer.type === "background") {
        ctx.fillStyle = layer.color;
        ctx.fillRect(0, 0, frame.width, frame.height);
      } else if (layer.type === "avatar") {
        ctx.fillStyle = "#243044";
        ctx.fillRect(layer.rect.x, layer.rect.y, layer.rect.w, layer.rect.h);
        ctx.fillStyle = "#9aa8c4";
        ctx.font = "28px sans-serif";
        ctx.fillText(layer.label, layer.rect.x + 16, layer.rect.y + 40);
      } else if (layer.type === "product-image") {
        ctx.fillStyle = "#1e2a3d";
        ctx.fillRect(layer.rect.x, layer.rect.y, layer.rect.w, layer.rect.h);
        ctx.fillStyle = "#7d8aa6";
        ctx.font = "18px sans-serif";
        ctx.fillText("Product DNA", layer.rect.x + 12, layer.rect.y + 28);
      } else if (layer.type === "text") {
        ctx.fillStyle =
          layer.role === "price"
            ? "#f0c674"
            : layer.role === "cta"
              ? "#6dcea0"
              : "#e8eefc";
        ctx.font =
          layer.role === "title" ? "bold 32px sans-serif" : "22px sans-serif";
        ctx.fillText(layer.text, layer.rect.x, layer.rect.y + 28, layer.rect.w);
      }
    }
  }, [frame]);

  const applyScene = (id: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.setSceneManual(accountId, id);
      notify({ tone: "success", title: t("scene.manualSet") });
      await refresh();
    });

  const clearOverride = () =>
    run(async () => {
      await window.khepreeLivestreamAI.clearSceneOverride(accountId);
      notify({ tone: "info", title: t("scene.overrideCleared") });
      await refresh();
    });

  const applyRes = (preset: "720x1280" | "1080x1920") =>
    run(async () => {
      await window.khepreeLivestreamAI.setSceneResolution(accountId, preset);
      setResolution(preset);
    });

  return (
    <div className="scenePreviewPanel" ref={rootRef}>
      <div className="panelHead">
        <div>
          <h3>{t("scene.previewTitle")}</h3>
          <p className="settingsHint">{t("scene.previewHint")}</p>
        </div>
      </div>
      <div className="scenePreviewStage">
        <canvas ref={canvasRef} className="scenePreviewCanvas" />
      </div>
      <label>
        {t("scene.picker")}
        <select
          value={sceneId}
          disabled={loading}
          onChange={(e) => void applyScene(e.target.value)}
        >
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("scene.resolution")}
        <select
          value={resolution}
          disabled={loading}
          onChange={(e) => void applyRes(e.target.value as "720x1280" | "1080x1920")}
        >
          <option value="720x1280">720×1280</option>
          <option value="1080x1920">1080×1920</option>
        </select>
      </label>
      {manual ? (
        <div className="rowActions">
          <span className="settingsHint warn">{t("scene.manualActive")}</span>
          <button type="button" className="ghost" disabled={loading} onClick={() => void clearOverride()}>
            {t("scene.clearOverride")}
          </button>
        </div>
      ) : (
        <p className="settingsHint">{t("scene.aiCanChange")}</p>
      )}
    </div>
  );
}
