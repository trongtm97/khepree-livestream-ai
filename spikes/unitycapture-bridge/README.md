# UnityCapture bridge spike (NOT production)

**Status:** Scaffold only. **Multi virtual camera is NOT claimed working.**

This folder is the planned home for a **separate** Windows helper that proves:

```
SceneCompositor frame → bridge → UnityCapture SharedImageMemory → DirectShow device
```

without assuming Unity can feed Khepree frames.

## Why a separate process

- UnityCapture’s filter (`UnityCaptureFilter`) is **MIT**; the Unity plugin is **zlib**.
- The filter consumes frames via **named shared memory / mutex / events** (`UnityCapture_DataN`, etc.) — historically written by the Unity native plugin, **not** by Electron.
- Khepree must **prove a non-Unity sender** before selecting this stack for multi-account TikTok.

## Intended devices

| Logical name       | Cap index | Shared memory suffix |
|--------------------|-----------|----------------------|
| Camera Khepree 1   | 0         | `…0`                 |
| Camera Khepree 2   | 1         | `…1`                 |

Operator installs upstream filter via `InstallMultipleDevices.bat` (admin). Khepree does **not** ship unsigned filter binaries in the proprietary core until legal + signing review.

## Acceptance for this spike (future)

1. Push solid **RED** + text **A** to device 1; **BLUE** + text **B** to device 2.
2. Receiving app (OBS / Camera app): device 1 shows only A; device 2 only B.
3. Sustained **1080×1920 @ 25fps** (stretch goal 30) for 5 minutes without filter crash.
4. Uninstall via upstream `Uninstall.bat` leaves no orphaned devices.

Until those PASS on a real Windows machine, `WindowsVirtualCameraOutput` stays DISABLED and docs say **not proven**.

## License boundary

- Do **not** copy GPL OBS plugins into `src/main`.
- Optional external installers may be documented; process-boundary only.
- Prefer MIT UnityCapture filter + own MIT/proprietary bridge sender.

## Next code (when greenlit)

- Native helper (C++/C#) implementing SharedImageMemory **sender** side.
- Node IPC from Electron: `open(capIndex)`, `pushBgra(width,height,buffer)`, `stop`.
- Wire `WindowsVirtualCameraOutput` → helper; keep `VideoDeviceReservationService` claims.
