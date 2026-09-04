# Real smoke test — 3 TikTok accounts

**Purpose:** Prove multi-live + Gemini + TikTok + LIVE Manager + recovery on a real Windows operator machine.  
**Not a product feature.** This is an operator process + gate scripts.

---

## Modes (keep separate)

| Mode | What it is | When to run | Command |
| --- | --- | --- | --- |
| **DEMO / MOCK** | Automated Vitest + foundation checks. No real Gemini login, no live TikTok. | Default CI and every PR | `npm run test:smoke:demo` |
| **REAL SMOKE** | Manual checklist against real accounts / Gemini / profiles. | Before claiming production readiness | `KHEPREE_REAL_SMOKE=1 npm run test:smoke:real` |

**Hard rule:** REAL SMOKE must **not** run in default CI. The real-smoke script exits unless `KHEPREE_REAL_SMOKE=1`.

Gate self-check (safe for CI):

```bash
npm run test:smoke:gate
```

---

## Credentials & privacy

**Do not commit:**

- Cookies / session tokens / PSID
- Production Khepree secrets
- Real TikTok passwords
- Sensitive real usernames (use placeholders in shared notes)
- Screenshots that show customer comments, orders, or PII
- Filled results with secrets → use gitignored `docs/smoke-results.local.md`

Safe placeholders in this doc: `Account A`, `Account B`, `Account C`, markers `A_TEST_001` / `B_TEST_001` / `C_TEST_001`.

Local results template (created by the script, gitignored):

- `docs/smoke-results.local.md`
- Optional artifacts dir: `smoke-artifacts/` (gitignored)

---

## Preconditions

- [ ] Windows host (primary target)
- [ ] `npm install` + worker venvs for Gemini / TikTok
- [ ] Three TikTok accounts available for concurrent connect (test shops OK)
- [ ] Gemini Web session you can log in with (operator machine only)
- [ ] Product DNA bound per account (so Start AI is allowed)
- [ ] `npm run typecheck` and `npm run test:smoke:demo` already green

---

## How to run REAL SMOKE

1. Fill preconditions.
2. `KHEPREE_REAL_SMOKE=1 npm run test:smoke:real` — prints steps + ensures local results file exists.
3. Manually execute each checklist row in the running app (`npm start`).
4. Mark each row **PASS** / **FAIL** / **NOT TESTED** in `docs/smoke-results.local.md` (not in this committed file).
5. Summarize into the empty tables below only with non-sensitive notes (optional PR comment).

---

## Checklist

Copy status into your local results file. Legend: **PASS** · **FAIL** · **NOT TESTED**.

### 1. Gemini

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| G1 | Login thật (Gemini Web / session) | Phase READY (not DEMO mock) | |
| G2 | Model list | UI shows ≥1 model; can select | |
| G3 | Test prompt | `testGemini` / UI probe returns text | |
| G4 | Reconnect | Disconnect → connect again → READY | |

### 2. TikTok Account A

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| A1 | Connect TikTok worker for A | Connected / healthy | |
| A2 | Receive a live comment on A | Comment appears in A's feed only | |

### 3. Account B (concurrent)

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| B1 | Connect B while A stays connected | B connected; A still connected | |

### 4. Account C (concurrent)

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| C1 | Connect C while A+B connected | All three connected | |

### 5. Cross-account routing

Inject or post comments with these exact markers (test shops / operator posts):

| Marker | Account |
| --- | --- |
| `A_TEST_001` | A |
| `B_TEST_001` | B |
| `C_TEST_001` | C |

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| X1 | Post / inject `A_TEST_001` on A | Only A's feed / runtime sees it | |
| X2 | Post / inject `B_TEST_001` on B | Only B | |
| X3 | Post / inject `C_TEST_001` on C | Only C | |
| X4 | No cross-contamination | A never shows B/C markers (and symmetrically) | |

### 6. Stop B AI

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| S1 | Stop AI on B only | B live AI stopped | |
| S2 | A and C still running | A/C assistants still live | |
| S3 | TikTok B may stay connected | B connector can remain connected; browser not force-closed | |

### 7. LIVE Manager profiles

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| L1 | Open LIVE Manager for A | Profile A browser opens | |
| L2 | Open for B | Profile B separate | |
| L3 | Open for C | Profile C separate | |
| L4 | No cross-logout | Closing/logging one profile does not log out the others | |

### 8. Gemini fairness under load

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| Q1 | Flood ~20 AI jobs on A (comments / approvals while A live) | Queue accepts work for A | |
| Q2 | B and C still get responses | B/C not starved; scheduler fairness holds | |

### 9. Crash recovery

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| R1 | Start AI on ≥1 account so DB has open session(s) | Sessions RUNNING in DB | |
| R2 | Kill app process (Task Manager / force quit) — do not graceful stop | Process dead | |
| R3 | Restart app | Startup recovery marks stale sessions `CRASH_RECOVERED` | |
| R4 | No auto-resume | Lives do **not** auto-start; operator must Start again | |

### 10. Operator takeover (optional but recommended)

| # | Step | Expected | Status |
| --- | --- | --- | --- |
| T1 | Takeover on A (button or F8) | Banner; A TTS stops; B/C continue | |
| T2 | Return AI on A | No replay of old speech queue | |

---

## Aggregate results (committed template — leave blank or high-level)

Fill only with **non-sensitive** outcomes. Detailed logs stay local.

### PASS

| ID | Note (no secrets) |
| --- | --- |
| | |

### FAIL

| ID | Note (no secrets) | Follow-up |
| --- | --- | --- |
| | | |

### NOT TESTED

| ID | Reason |
| --- | --- |
| | |

---

## Related automated suites (DEMO / MOCK)

These replace REAL SMOKE in CI — they do **not** prove production accounts:

| Area | Automated coverage |
| --- | --- |
| Cross-account events | `tests/multi-live/cross-account-events.test.ts` |
| Stop one leave others | `tests/multi-live/stop-lifecycle.test.ts` |
| Session crash recovery | `tests/session-recovery/crash.test.ts` |
| AI scheduler fairness | `tests/llm-scheduler/fairness.test.ts` |
| Takeover mute | `tests/operator/takeover.test.ts` |
| Connector isolation (stub) | `tests/tiktok/connector-isolation.test.ts` |

---

## Sign-off

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| App version / commit | |
| REAL SMOKE overall | PASS / FAIL / PARTIAL |
