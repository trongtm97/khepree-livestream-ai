#!/usr/bin/env node
/**
 * Smoke mode gate — DEMO/MOCK vs REAL SMOKE.
 * Real mode never runs in default CI: requires KHEPREE_REAL_SMOKE=1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const RESULTS_LOCAL = path.join(root, "docs", "smoke-results.local.md");
const CHECKLIST = path.join(root, "docs", "REAL_SMOKE_TEST.md");

export function resolveSmokeMode(env = process.env, argv = process.argv.slice(2)) {
  if (argv.includes("--self-check")) return "self-check";
  if (argv.includes("--mode=demo") || env.KHEPREE_SMOKE_MODE === "demo") return "demo";
  if (argv.includes("--mode=real") || env.KHEPREE_REAL_SMOKE === "1") return "real";
  return "refuse";
}

function ensureLocalResults() {
  if (fs.existsSync(RESULTS_LOCAL)) {
    console.log(`[real-smoke] Local results already exist: ${RESULTS_LOCAL}`);
    return;
  }
  const stub = `# Smoke results (LOCAL ONLY — do not commit)

Copy rows from docs/REAL_SMOKE_TEST.md and mark PASS / FAIL / NOT TESTED.

Date:
Operator:
Commit:

## PASS
-

## FAIL
-

## NOT TESTED
-
`;
  fs.writeFileSync(RESULTS_LOCAL, stub, "utf8");
  console.log(`[real-smoke] Created ${RESULTS_LOCAL}`);
}

function runDemo() {
  console.log("[smoke] DEMO/MOCK — Vitest multi-live harness (no real Gemini/TikTok).");
  const r = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    [
      "test",
      "--",
      "tests/multi-live",
      "tests/tiktok",
      "tests/comments",
      "tests/llm-scheduler",
      "tests/approval",
      "tests/session-recovery",
      "tests/session-epoch",
      "tests/operator",
      "tests/media",
      "tests/events",
      "tests/resources"
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
  );
  process.exit(r.status ?? 1);
}

function runReal() {
  if (process.env.KHEPREE_REAL_SMOKE !== "1") {
    console.error(
      "[real-smoke] Refused. Set KHEPREE_REAL_SMOKE=1 to acknowledge manual real-account smoke."
    );
    console.error("  Demo/mock instead: npm run test:smoke:demo");
    process.exit(1);
  }
  if (!fs.existsSync(CHECKLIST)) {
    console.error(`[real-smoke] Missing checklist: ${CHECKLIST}`);
    process.exit(1);
  }
  ensureLocalResults();
  console.log("");
  console.log("=== REAL SMOKE (manual) ===");
  console.log(`Checklist: ${CHECKLIST}`);
  console.log(`Record results in: ${RESULTS_LOCAL}`);
  console.log("");
  console.log("This script does NOT call Gemini/TikTok/LIVE Manager APIs.");
  console.log("Operator steps:");
  console.log("  1. npm start");
  console.log("  2. Execute sections in docs/REAL_SMOKE_TEST.md");
  console.log("  3. Markers: A_TEST_001 / B_TEST_001 / C_TEST_001");
  console.log("  4. Fill PASS / FAIL / NOT TESTED in smoke-results.local.md");
  console.log("  5. Do not commit cookies, tokens, or customer screenshots");
  console.log("");
  process.exit(0);
}

function selfCheck() {
  // 1) refuse without flag
  const refuse = resolveSmokeMode({ ...process.env, KHEPREE_REAL_SMOKE: undefined }, [
    "--mode=real"
  ]);
  // --mode=real alone should still require env for runReal; resolveSmokeMode treats --mode=real as real
  // Gate for CI: without env, invoking script with no args must refuse.
  const noArgs = resolveSmokeMode({ KHEPREE_REAL_SMOKE: undefined, KHEPREE_SMOKE_MODE: undefined }, []);
  if (noArgs !== "refuse") {
    console.error("self-check FAIL: default mode must be refuse");
    process.exit(1);
  }
  const demo = resolveSmokeMode({}, ["--mode=demo"]);
  if (demo !== "demo") {
    console.error("self-check FAIL: --mode=demo");
    process.exit(1);
  }
  const realEnv = resolveSmokeMode({ KHEPREE_REAL_SMOKE: "1" }, ["--mode=real"]);
  if (realEnv !== "real") {
    console.error("self-check FAIL: KHEPREE_REAL_SMOKE=1");
    process.exit(1);
  }
  // Real runner must refuse when env missing even if someone calls runReal logic:
  if (process.env.KHEPREE_REAL_SMOKE === "1") {
    console.error("self-check FAIL: unset KHEPREE_REAL_SMOKE before gate check");
    process.exit(1);
  }
  const blocked = spawnSync(process.execPath, [path.join(__dirname, "real-smoke.mjs"), "--mode=real"], {
    cwd: root,
    env: { ...process.env, KHEPREE_REAL_SMOKE: "" },
    encoding: "utf8"
  });
  if ((blocked.status ?? 0) === 0) {
    console.error("self-check FAIL: real mode must exit non-zero without KHEPREE_REAL_SMOKE=1");
    process.exit(1);
  }
  if (!fs.existsSync(CHECKLIST)) {
    console.error("self-check FAIL: docs/REAL_SMOKE_TEST.md missing");
    process.exit(1);
  }
  void refuse;
  console.log("smoke-gate self-check PASS (demo/real separated; real blocked without env)");
  process.exit(0);
}

const mode = resolveSmokeMode();
if (mode === "self-check") selfCheck();
else if (mode === "demo") runDemo();
else if (mode === "real") runReal();
else {
  console.error("[smoke] Refused. Choose a mode:");
  console.error("  npm run test:smoke:demo     # MOCK / Vitest (CI-safe)");
  console.error("  KHEPREE_REAL_SMOKE=1 npm run test:smoke:real");
  console.error("  npm run test:smoke:gate     # assert gate");
  process.exit(1);
}
