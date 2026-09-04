# Virtual camera feasibility — multi-account Windows

**Date:** 2026-09-05  
**Status:** Architecture + research. **No driver selected.**  
**Multi virtual camera: NOT proven on real Windows hardware in this repo.**

Khepree needs one independent webcam-class device per live account (TikTok Studio / Live Manager picks “Camera Khepree N”). Before virtual camera, SceneEngine already composes local preview frames. This document compares options and defines the provider + reservation architecture.

## Verdict (short)

| Option | Commercial fit | Multi-device | Feed from Khepree (non-Unity) | Recommendation |
|--------|----------------|--------------|-------------------------------|----------------|
| **UnityCapture** (filter MIT) | Strong (MIT filter) | Yes (`InstallMultipleDevices.bat`) | **Unproven** — needs SharedImageMemory sender bridge | **Primary candidate** after bridge spike PASS |
| **OBS built-in virtual cam** | OBS is GPL; shipping OBS inside Khepree is a license boundary | Typically **one** cam per OBS instance | Via OBS pipeline, not direct raw frames | Operator-side optional only; not core |
| **obs-virtualcam / multi plugins** | Usually **GPL-2.0** | Up to ~4 devices (plugin-dependent) | Through OBS, not Electron push | **External optional** only — do not link into proprietary core |
| **Custom DirectShow filter** | Full control if own code + counsel | Designed for N devices | Yes (own push API) | Highest cost (signing, maintenance); fallback if UnityCapture bridge fails |

**Do not claim multi-camera working until the Windows acceptance test PASS** (see below).

---

## Architecture (implemented in code)

### `VideoOutputProvider`

```
id
health()
listTargets()
open(targetId, format)
pushFrame(frame)
stop()
dispose()
```

| Provider | Role |
|----------|------|
| `LocalPreviewVideoOutput` | In-app preview sink (SceneCompositor path) |
| `MockVideoOutput` | Dual mock devices for CI — **Camera Khepree 1 / 2** |
| `NullVideoOutput` | No video route |
| `WindowsVirtualCameraOutput` | **Stub** — lists future names, refuses `open` until bridge exists |

Sales Brain / LiveOrchestrator never talk to drivers; they stay on `media.setScene` / compositor preview.

### Pipeline (target)

```
SceneCompositor → VideoOutputProvider.pushFrame → [bridge] → Virtual Camera #N
```

### `VideoDeviceReservationService`

One `targetId` cannot be claimed by two accounts. Mock providers enforce this; Windows provider must use the same service.

---

## Criteria matrix

Scores: **Yes** / **Partial** / **No** / **Unknown** (needs spike).

| Criterion | UnityCapture | OBS built-in VC | OBS multi plugins (e.g. obs-virtualcam) | Custom DirectShow |
|-----------|--------------|-----------------|----------------------------------------|-------------------|
| **Commercial license** | Filter **MIT**; Unity plugin **zlib** | OBS **GPL-2.0** — do not link into proprietary core | Typically **GPL-2.0** | Own code → counsel + redistribution terms |
| **Multiple devices** | **Yes** — register N filters | **No** (one VC per instance; multi via portable copies is ops-heavy) | **Partial** — often ≤4 cams | **Yes** (design for N) |
| **Windows 10/11** | **Yes** | **Yes** | **Yes** (Win10+) | **Yes** |
| **Signed driver/filter** | Upstream ships `regsvr32` user-mode DirectShow filter — **not** a kernel driver; SmartScreen / enterprise policy may still block unsigned DLLs | Bundled with OBS installer | Same class as OBS filter DLLs | Must plan Authenticode + install UX |
| **1080×1920 @ 25/30 fps** | Upstream claims strong 1080p60 in Unity path; **vertical 1080×1920 from Electron = Unknown** until bridge bench | Depends on OBS encode path | Depends on OBS | Design target; must measure |
| **Raw frames from non-Unity app** | **Unknown → spike** — shared memory protocol exists; Unity plugin is the reference sender | No direct Electron→filter push | No | **Yes** if you own the filter |
| **Installation UX** | Admin `Install.bat` / `InstallMultipleDevices.bat` | Install OBS | OBS + plugin + `regsvr32` | MSI/custom — highest polish cost |
| **Uninstall** | `Uninstall.bat` | OBS uninstall | Unregister DLL + OBS uninstall | Must provide clean unregister |
| **Device naming** | Default “Unity Video Capture” / “#2”… — **rename for product** needs filter branding work or operator docs mapping → “Camera Khepree N” | “OBS Virtual Camera” | “OBS-Camera” variants | Full control |
| **Crash behavior** | Filter can show standby patterns when sender stops; sender crash → stale/pattern (per upstream modes) | OBS crash → VC stops | Similar | Must define freeze vs black vs pattern |

---

## 1. UnityCapture

**Upstream:** https://github.com/schellingb/UnityCapture

### What we know

- Windows **DirectShow** virtual capture filter.
- **Multiple devices:** `InstallMultipleDevices.bat` → `regsvr32 … /i:UnityCaptureDevices=N`.
- Device indices map to shared objects like `UnityCapture_Data0`, mutex/events per cap number (see upstream `Source/shared.inl`).
- Filter license **MIT**; Unity-side plugin **zlib**.
- Documented path is **Unity → D3D11 texture → native plugin → shared memory → filter**.

### What we must not assume

Khepree is **Electron + SceneCompositor**, not Unity. Multi-device registration ≠ “Khepree can push frames today.”

### Data bridge (required proof)

```
SceneCompositor RGBA/BGRA
  → optional convert / stride align (width % 4)
  → SharedImageMemory sender (cap index N)
  → UnityCaptureFilter instance N
  → TikTok / OBS as webcam
```

Spike home: [`spikes/unitycapture-bridge/README.md`](../spikes/unitycapture-bridge/README.md).

**Gate:** only after dual RED/BLUE receiving-app PASS + FPS bench, promote `WindowsVirtualCameraOutput` off DISABLED.

---

## 2. OBS virtual camera / multi-camera plugins

### Built-in OBS Virtual Camera

- One primary virtual camera in current OBS Studio.
- Fine for **operator** routing one composed feed through OBS.
- Poor fit for **N independent Khepree accounts** without N OBS instances (heavy UX).

### Multi virtual-cam plugins (e.g. forks of obs-virtualcam)

- Often register multiple DirectShow sources (commonly up to 4).
- License: **GPL-2.0** on common forks — **license boundary** below.
- Still OBS-centric: frames flow through OBS, not a clean `pushFrame` from Electron.

**Product stance:** document as optional operator tooling; never `require()` / statically link GPL plugin code into Khepree’s proprietary main process.

---

## 3. Custom DirectShow approach

Build and sign your own virtual cam filter + installer.

| Pros | Cons |
|------|------|
| Exact naming (“Camera Khepree 1”) | Engineering + security review |
| Own push API | Windows filter quirks, app compatibility |
| Clear commercial ownership | Authenticode, support, antivirus false positives |
| Multi-device by design | Longest time-to-first-cam |

Use if UnityCapture bridge fails FPS, naming, or stability gates.

---

## GPL / license boundary

```
┌─────────────────────────────────────────────┐
│  Khepree proprietary core (Electron main)   │
│  VideoOutputProvider · SceneCompositor      │
│  VideoDeviceReservationService              │
└──────────────────┬──────────────────────────┘
                   │ process / HTTP / named pipe only
                   ▼
┌─────────────────────────────────────────────┐
│  Optional external components               │
│  • MIT UnityCapture filter (operator install)│
│  • Our bridge helper (preferred MIT/own)    │
│  • OBS + GPL plugins (operator-owned box)   │
└─────────────────────────────────────────────┘
```

Rules:

1. **Do not copy or link GPL** OBS plugin sources into `src/` or ship them inside the Khepree installer without a deliberate open-source compliance program.
2. **External optional integration** is OK: docs tell the operator to install OBS/plugin; Khepree only opens the resulting device name if ever supported.
3. Prefer **MIT UnityCapture filter + separate bridge** over GPL in-process code.
4. Keep third-party notices in `docs/` (same pattern as LiveTalking / MuseTalk).

---

## Installation / naming / crash (product requirements)

Regardless of candidate:

| Topic | Requirement |
|-------|-------------|
| Install | Clear admin elevation; show device count; fail closed if registration fails |
| Uninstall | Remove all “Camera Khepree N” / registered filters; no orphaned devices |
| Naming | Prefer “Camera Khepree 1…N”; if stuck with “Unity Video Capture #N”, map in UI |
| Crash | Sender death → defined pattern or last frame timeout; never silent cross-account bleed |
| Claim | `VideoDeviceReservationService` — one account per target |

---

## Acceptance tests

### A. Mock (CI — implemented)

- Two `MockVideoOutput` instances: A → RED/TEXT A, B → BLUE/TEXT B.
- Receiving mock bus: camera 1 only A; camera 2 only B.
- Second account cannot claim the same target.

**Status: PASS in unit tests** (`tests/media/video-output-provider.test.ts`).

### B. Real Windows (not run in this change)

1. Install multi devices (candidate filter).
2. Bridge pushes RED/TEXT A → device 1; BLUE/TEXT B → device 2.
3. Receiving app (OBS or Camera): verify isolation.
4. Hold **1080×1920 @ 25fps** (goal 30) for sustained run.

**Status: NOT RUN — multi-camera must not be marketed as working until PASS.**

---

## Decision log (open)

1. **Do not pick a driver yet.**
2. Next engineering step if multi-cam remains a goal: implement UnityCapture **sender bridge** spike only.
3. Keep local SceneEngine preview as the supported path until B PASSes.

## Related code

- `src/main/connectors/media/video/types.ts` — `VideoOutputProvider`
- `src/main/connectors/media/video/mock-video-output.ts`
- `src/main/connectors/media/video/local-preview-video-output.ts`
- `src/main/connectors/media/video/windows-virtual-camera-output.ts`
- `src/main/connectors/media/video/video-device-reservation.ts`
- `spikes/unitycapture-bridge/README.md`
