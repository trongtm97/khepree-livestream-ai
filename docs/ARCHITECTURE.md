# Khepree Livestream AI — Architecture

## Core goal

One operator supervises a livestream while AI performs most repetitive work: reading comments, prioritizing buyer intent, drafting replies, choosing sales states/scenes, and proposing speech/actions.

## Process model

```text
Electron Main
├─ Khepree licensing boundary
├─ SQLite repositories
├─ Event Bus
├─ Live Orchestrator
├─ Approval Engine
├─ Sales State Machine
├─ Product DNA
├─ Connector managers
│  ├─ Gemini Web sidecar (Python)
│  ├─ TikTokLive sidecar (Python)
│  └─ TikTok LIVE Manager Playwright observer
└─ Media adapter
   └─ future LiveTalking / MuseTalk / TTS / virtual camera

Preload
└─ typed/sanitized IPC only

Renderer
└─ React operator console — no DB, secrets, Playwright, child_process, or raw tokens
```

## Event flow

```text
TikTok comment
  -> TikTok connector
  -> normalized LiveEvent
  -> EventBus
  -> CommentPriority
  -> LiveOrchestrator
  -> Product context + Sales state
  -> LLM ActionProposal
  -> Rule/claim guard
  -> ApprovalEngine
     -> manual approve / timed auto approve / reject
  -> Media/TTS action
  -> telemetry + state transition
```

## Automation modes

- `MANUAL_ASSIST`: AI drafts; operator always triggers.
- `ASSISTED`: AI prepares actions; operator approves.
- `SUPERVISED_AUTO`: safe/high-confidence actions auto execute after cancellable countdown.
- `FULL_AUTO`: architecture-supported but should remain feature-gated and market-policy-gated.

## Stable interfaces

### LLMProvider
- health
- listModels
- generateActionProposal

### TikTokProvider
- connect
- disconnect
- status
- drainEvents

### MediaProvider
- health
- speak
- stop
- setScene

### KhepreeAccess
- public access state only in renderer
- protected main-process actions call `assertProductAccess`

## Reliability

Upstream reverse engineering must never be a single point of failure. If Gemini is down, the future Fallback Script Engine can keep the session alive. If TikTokLive breaks, LIVE Manager DOM observation can be a secondary event source.

## Security

- Electron `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`.
- `safeStorage` protects refresh token/device key.
- Khepree access token stays memory-only.
- Workers bind to `127.0.0.1` and require a random bearer token.
- Browser profiles are dedicated app profiles, never the user's default Chrome profile.
