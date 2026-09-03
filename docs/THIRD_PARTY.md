# Third-party dependency boundary

This proprietary foundation does **not** copy source code from the two reverse-engineered projects below.

| Dependency | Usage | Boundary |
|---|---|---|
| HanaokaYuzu/Gemini-API (`gemini_webapi`) | user-installed Python package in separate worker | local HTTP sidecar |
| isaackogan/TikTokLive | user-installed Python package in separate worker | local HTTP sidecar |
| Playwright | browser automation | npm dependency |
| Electron | desktop shell | npm dependency |
| better-sqlite3 | local database | npm dependency |

Both Gemini-API and current TikTokLive repositories should be license-reviewed before commercial redistribution/bundling. The foundation keeps them replaceable and out of proprietary core source.
