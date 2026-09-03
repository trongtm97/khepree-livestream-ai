import { spawnSync } from "node:child_process";

console.log("Khepree Livestream AI — development doctor");
console.log("Node", process.version);
console.log("Platform", process.platform, process.arch);

const py = process.env.KHEPREE_PYTHON || "python";
const pyResult = spawnSync(py, ["--version"], { encoding: "utf8" });
console.log("Python", (pyResult.stdout || pyResult.stderr || "not found").trim());

console.log("\nExternal dependencies to install for live connectors:");
console.log("  python -m pip install -r workers/gemini_worker/requirements.txt");
console.log("  python -m pip install -r workers/tiktok_worker/requirements.txt");
console.log("\nRun npm run test:foundation after install.");
