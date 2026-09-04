import path from "node:path";
import { app } from "electron";

/** Project root in dev; resources root when packaged (workers/ live beside app). */
export function resolveAppRoot(): string {
  if (app.isPackaged) return process.resourcesPath;
  return path.join(__dirname, "..", "..");
}
