import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: "KhepreeLivestreamAI",
    protocols: [
      { name: "Khepree Livestream AI", schemes: ["khepreelivestreamai"] }
    ],
    extraResource: [
      "workers",
      "resources"
    ]
  },
  // better-sqlite3@13 ships N-API prebuilds that work across Electron ABIs.
  // Skipping native rebuild avoids requiring Visual Studio C++ on Windows.
  rebuildConfig: {
    ignoreModules: ["better-sqlite3"]
  },
  makers: [
    new MakerSquirrel({
      name: "khepree_livestream_ai",
      setupExe: "Khepree-Livestream-AI-Setup.exe"
    }),
    new MakerZIP({}, ["win32"])
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        { entry: "src/main/index.ts", config: "vite.main.config.ts", target: "main" },
        { entry: "src/preload/index.ts", config: "vite.preload.config.ts", target: "preload" }
      ],
      renderer: [
        { name: "main_window", config: "vite.renderer.config.ts" }
      ]
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};

export default config;
