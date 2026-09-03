import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "src/main/index.ts",
  "src/main/live/live-orchestrator.ts",
  "src/main/khepree/khepree-access-service.ts",
  "src/main/connectors/llm/gemini-worker-provider.ts",
  "src/main/connectors/tiktok/tiktok-worker-provider.ts",
  "src/preload/index.ts",
  "src/renderer/ui/App.tsx",
  "workers/gemini_worker/app.py",
  "workers/tiktok_worker/app.py",
  "docs/ARCHITECTURE.md"
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.productName !== "Khepree Livestream AI") {
  console.error("Unexpected productName");
  failed = true;
}
if (!pkg.protocols?.[0]?.schemes?.includes("khepreelivestreamai")) {
  console.error("Missing custom protocol");
  failed = true;
}

const main = fs.readFileSync(path.join(root, "src/main/index.ts"), "utf8");
if (!main.includes("requestSingleInstanceLock")) {
  console.error("Single-instance boundary missing");
  failed = true;
}

const preload = fs.readFileSync(path.join(root, "src/preload/index.ts"), "utf8");
if (!preload.includes("contextBridge.exposeInMainWorld")) {
  console.error("Preload bridge missing");
  failed = true;
}

if (failed) process.exit(1);
console.log(`Foundation check PASS (${required.length} critical files).`);
