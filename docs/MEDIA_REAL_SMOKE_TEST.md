# Media real smoke test — GATE A–F (milestone 0.4.x)

**Purpose:** Prove media routing + avatar foundation on a real Windows operator machine **before** any production release claim.  
**Not a product feature.** Operator checklist + honest PASS/FAIL only.

**Related:** core multi-live smoke → `docs/REAL_SMOKE_TEST.md`.  
**Architecture notes:** `docs/VIRTUAL_CAMERA_FEASIBILITY.md`, `docs/FEATURE_MATRIX.md`.

---

## Hard rules

1. **No false claim.** Unit/mock PASS ≠ real smoke PASS.
2. Do **not** bump package.json to a production release version until gates you care about for that release are PASS (recommended: **all of A–F** for “media live” marketing).
3. Milestone label **0.4.x** means foundation in code — not “avatar livestream shipping.”
4. **Do not commit** secrets, cookies, filled results with PII, or “PASS” screenshots with customer data. Use gitignored `docs/smoke-results.local.md` / `docs/media-smoke-results.local.md`.
5. Default CI stays DEMO/MOCK only (`npm run test:smoke:demo`, `npm run test:smoke:gate`).

---

## Status vocabulary (per gate)

| Mark | Meaning |
| --- | --- |
| **PASS** | Observed on this machine with evidence (notes/local file) |
| **FAIL** | Attempted; broken or inconclusive |
| **NOT_RUN** | Default for this repository |

Current repo default for **all gates below: NOT_RUN** (do not invent PASS).

---

## GATE A — 3-account TikTok / Gemini REAL SMOKE

**Goal:** Three accounts concurrently healthy with AI proposals grounded in Product DNA (no invented price/stock).

| Step | Action | Pass criteria |
| --- | --- | --- |
| A1 | Follow `docs/REAL_SMOKE_TEST.md` for Account A/B/C | All required rows PASS there |
| A2 | Comments appear only on owning account feed | No cross-account comment bleed |
| A3 | Gemini (or acknowledged fallback) produces ActionProposal → Approval | No direct TikTok click / speak bypass |
| A4 | Stop one account; others keep running | Isolation holds |

**Automated:** none that prove live TikTok/Gemini.  
**Depends on:** Khepree access ACTIVE (fail-closed).

**Result (local only):** `NOT_RUN` | `PASS` | `FAIL`

---

## GATE B — 3-account audio routing isolation

**Goal:** Each account’s TTS goes to a **distinct** Windows playback endpoint (virtual cable / device). No audible bleed.

| Step | Action | Pass criteria |
| --- | --- | --- |
| B1 | Configure three accounts → Voice / audio routing wizard → three different endpoints | Profiles save distinct `audioOutputDeviceId` |
| B2 | Media Readiness → **Kiểm tra 3 tài khoản** (or dry-run per account) | Distinct spoken tokens per account |
| B3 | Listen on each cable / monitor input | Account A token only on cable A; same for B/C |
| B4 | Start VOICE_ONLY (or AVATAR_LIVE audio path) on A while B silent | B cable stays quiet |

**Automated (not sufficient alone):** `tests/media/audio-endpoint-routing.test.ts`, collision helpers.  
**Code status:** PARTIAL + **REAL_SMOKE_PENDING**.

**Result (local only):** `NOT_RUN` | `PASS` | `FAIL`

---

## GATE C — 2-account virtual camera isolation

**Goal:** Receiving app shows only A on Camera Khepree 1 and only B on Camera Khepree 2.

| Step | Action | Pass criteria |
| --- | --- | --- |
| C1 | Install chosen multi-device filter (candidate: UnityCapture multi install) — **after** bridge spike | Two devices visible in OS |
| C2 | Push test pattern **RED + TEXT A** → device 1; **BLUE + TEXT B** → device 2 | Patterns match docs/spike acceptance |
| C3 | Open OBS / Camera app on each device | No cross-talk; sustained run ≥ 5 min preferred |
| C4 | Target resolution path 720×1280 or 1080×1920 @ 25–30 fps | No filter crash; naming documented |

**Automated today:** mock dual cameras in `tests/media/video-output-provider.test.ts` only.  
**Code status:** architecture + stub `WindowsVirtualCameraOutput` — **NOT** real cam.  
**Do not mark GATE C PASS** until Windows receiving-app proof exists.

**Result (local only):** `NOT_RUN` | `PASS` | `FAIL`

---

## GATE D — Avatar realtime ≥ target FPS

**Goal:** Chosen avatar engine sustains target FPS under multi-live policy (GpuMediaScheduler).

| Step | Action | Pass criteria |
| --- | --- | --- |
| D1 | Configure MuseTalk-local or LiveTalking for ≥1 account | Engine health READY |
| D2 | Measure infer/output FPS at agreed resolution (e.g. 720×1280) | Sustained **≥ target** (product target typically 25; stretch 30) for ≥ 5 min |
| D3 | Second avatar session while first speaking | Scheduler priority / degrade visible; no silent failure |
| D4 | Force overload | Operator sees FPS warning; Voice Only suggestion when admit fails |

**Automated:** GpuMediaScheduler mock capacity tests — not FPS.  
**Code status:** PARTIAL + **REAL_SMOKE_PENDING**.

**Result (local only):** `NOT_RUN` | `PASS` | `FAIL`

---

## GATE E — Human takeover stops only target account

**Goal:** Takeover / emergency on account B stops B’s AI speech/avatar; A and C continue.

| Step | Action | Pass criteria |
| --- | --- | --- |
| E1 | A/B/C running with speech or avatar preview/live as available | All three active |
| E2 | Enter human takeover on **B** only | B TTS/avatar stops; approvals for B blocked per product rules |
| E3 | Confirm A and C still speak / preview | No global mute |
| E4 | Exit takeover on B | B can resume under mode rules |
| E5 | Emergency stop (if used) | Document whether global vs per-account; match UI copy |

**Automated:** `tests/operator/takeover.test.ts` (logic). Media path on real devices = **REAL_SMOKE_PENDING**.

**Result (local only):** `NOT_RUN` | `PASS` | `FAIL`

---

## GATE F — Crash recovery with media processes

**Goal:** After hard kill / crash, stale sessions recover without auto-resume; media sidecars do not orphan indefinitely.

| Step | Action | Pass criteria |
| --- | --- | --- |
| F1 | Start live + TTS and/or avatar worker / audio bridge activity | Processes visible |
| F2 | Kill Electron (Task Manager) mid-live | Dirty shutdown |
| F3 | Relaunch app | Crash recovery notice; **no** auto-resume of AI live |
| F4 | Check Task Manager | No unbounded orphan `tiktok_worker` / `gemini_worker` / MuseTalk / audio bridge processes (or documented cleanup path) |
| F5 | Operator can start again cleanly | Media readiness / profiles intact |

**Automated:** `tests/session-recovery/crash.test.ts` (session rows). Full media process matrix = **REAL_SMOKE_PENDING**.

**Result (local only):** `NOT_RUN` | `PASS` | `FAIL`

---

## Suggested local results template

Copy to `docs/media-smoke-results.local.md` (gitignored if configured; otherwise keep local-only):

```markdown
# Media smoke results (LOCAL — do not commit secrets)

Date:
Machine:
GPU:

| Gate | Result | Notes |
|------|--------|-------|
| A | NOT_RUN | |
| B | NOT_RUN | |
| C | NOT_RUN | |
| D | NOT_RUN | |
| E | NOT_RUN | |
| F | NOT_RUN | |

Operator:
```

---

## Mapping to feature matrix

| Gate | Matrix area |
| --- | --- |
| A | TikTok / Gemini / multi-live REAL_SMOKE_PENDING |
| B | Virtual audio / endpoint routing REAL_SMOKE_PENDING |
| C | Virtual camera NOT_IMPLEMENTED until PASS |
| D | Avatar realtime REAL_SMOKE_PENDING |
| E | Human takeover + media REAL_SMOKE_PENDING |
| F | Crash recovery + media processes REAL_SMOKE_PENDING |

When a gate PASSes locally, update **your** local results file — do **not** change FEATURE_MATRIX to “production-ready” without an explicit release decision.
