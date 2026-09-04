# Project state — Development milestone 0.4.x

> package.json vẫn `0.1.0`. Đây **không** phải claim production release.  
> Không bump version thành “release” khi chưa PASS real smoke (GATE A–F).

Rà theo **code** sau Prompt 01–12 (multi-live → media routing + avatar foundation).

## Milestone 0.4 focus

**Media routing + avatar foundation** on top of 0.3 multi-live hardening:

- Per-account live output modes (`ASSIST_ONLY` → `AVATAR_LIVE`)
- Windows audio endpoint / virtual-cable routing + setup wizard
- AvatarProvider ports (Mock, external LiveTalking, MuseTalk-local worker)
- Avatar library + creation wizard (schema v8)
- SceneEngine / SceneCompositor + throttled local preview (no virtual camera required)
- VideoOutputProvider architecture + mock dual-cam isolation; UnityCapture feasibility only
- GpuMediaScheduler (separate from Gemini AiRequestScheduler) + AVATAR_LIVE admission
- Media Readiness Center (checklist + dry-run + 3-account token test)

## Implemented (wired in `AppContainer`)

- Secure Electron split + typed preload + account-aware IPC (media / scene / avatar / readiness).
- SQLite multi-live schema through **v8** (`media_profiles`, `avatar_assets`, output modes, …).
- `MultiLiveRuntimeManager` / per-account `LiveRuntime` (SceneEngine, batch start/stop).
- `TikTokConnectorRegistry` + `LiveManagerRegistry` (per-account).
- Comment feed isolation + `LiveEventDeduplicator`.
- Approval Engine with session binding; session epoch + crash recovery (no auto-resume).
- `AiRequestScheduler` (Gemini) + **`GpuMediaScheduler`** (avatar GPU — separate).
- `MediaSessionFactory` → Voice / Composite; Windows SAPI TTS; endpoint or local preview audio.
- Avatar library service; LiveTalking / MuseTalk adapters (external / sidecar).
- `OperatorControlService` — takeover / emergency.
- `SystemResourceMonitor` + ResourceGovernor + capacity service.
- Live Center / Account Detail (scene preview + **Hình ảnh & âm thanh** tab) / Voice + avatar hub.
- Vitest suite + CI + smoke gate / demo.
- Operator checklists: `docs/REAL_SMOKE_TEST.md`, `docs/MEDIA_REAL_SMOKE_TEST.md`.

## Deliberately not claimed production-ready

- GATE A–F in `docs/MEDIA_REAL_SMOKE_TEST.md` — **not recorded PASS** in this repo.
- Real TikTok / LIVE Manager / Gemini account smoke.
- Production Khepree lease signing key pin + platform capacity seed.
- Multi virtual camera on Windows (architecture + mock only; no driver selected).
- Avatar realtime FPS ≥ target on real GPU.
- Windows clean-install installer smoke + code signing + auto-update.
- Script editor / full log viewer tabs (Coming Soon).

## How to verify (automated)

```bash
npm ci
npm run typecheck
npm test
npm run test:foundation
npm run test:smoke:gate
npm run test:smoke:demo
```

Manual real accounts / media:

```bash
KHEPREE_REAL_SMOKE=1 npm run test:smoke:real
```

See `docs/FEATURE_MATRIX.md`, `docs/MEDIA_REAL_SMOKE_TEST.md`, `docs/REVIEW_NEXT.md`.
