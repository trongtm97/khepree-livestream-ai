import { spawn, type ChildProcess } from "node:child_process";

/** spawn() with `stdio: ["ignore","pipe","pipe"]` yields this shape. */
type TtsChildProcess = ChildProcess & { stdin: null; stdout: NonNullable<ChildProcess["stdout"]>; stderr: NonNullable<ChildProcess["stderr"]> };

/**
 * Offline text-to-speech using the operating system's own speech engine.
 *
 * Why OS-native rather than a cloud TTS: the product is local-first
 * (see "Nguyên tắc local-first"), so voice output must work with no API key,
 * no per-character billing, and no internet dependency. Windows SAPI, macOS
 * `say`, and Linux eSpeak cover the target platforms with zero extra installs
 * on Windows and macOS.
 *
 * Security: user/AI text is NEVER interpolated into a command string. It is
 * passed as an argv element (macOS/Linux) or through an environment variable
 * consumed by a static PowerShell script (Windows), so model output can never
 * escape into a shell.
 */

export type TtsEngine = "sapi" | "say" | "espeak" | "none";

export interface TtsEngineInfo {
  engine: TtsEngine;
  available: boolean;
  message: string;
  voices: string[];
  /** Human-readable platform hint shown in the Voice settings panel. */
  hint: string;
}

export interface SystemTtsOptions {
  /** Substring of the desired voice name, e.g. "Vietnamese" or "An". */
  voiceHint?: string;
  /** Speaking rate. Windows/macOS: relative rate. Linux: words per minute. */
  rate?: number;
  volume?: number;
  /** Kill runaway utterances (a stuck child must not block the queue). */
  speakTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Static PowerShell script — contains no user data.
 * Text arrives via environment variables, so it is never parsed as script.
 */
const SAPI_SPEAK_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -AssemblyName System.Speech",
  "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
  "if ($env:KHEPREE_TTS_VOICE) { try { $s.SelectVoice($env:KHEPREE_TTS_VOICE) } catch { } }",
  "if ($env:KHEPREE_TTS_RATE) { try { $s.Rate = [int]$env:KHEPREE_TTS_RATE } catch { } }",
  "if ($env:KHEPREE_TTS_VOLUME) { try { $s.Volume = [int]$env:KHEPREE_TTS_VOLUME } catch { } }",
  "$s.Speak($env:KHEPREE_TTS_TEXT)"
].join("; ");

const SAPI_LIST_VOICES_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -AssemblyName System.Speech",
  "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
  "$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }"
].join("; ");

/** PowerShell -EncodedCommand expects UTF-16LE base64. */
function encodePowerShell(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function runCommand(
  command: string,
  args: string[],
  opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child: TtsChildProcess;
    try {
      child = spawn(command, args, {
        env: { ...process.env, ...(opts.env ?? {}) },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      finish(() => reject(new Error(`TTS_TIMEOUT:${command}`)));
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (d: Buffer) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += String(d);
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) =>
      finish(() => resolve({ code: code ?? 0, stdout, stderr }))
    );
  });
}

export class SystemTtsProvider {
  private engineInfo?: TtsEngineInfo;
  private detectPromise?: Promise<TtsEngineInfo>;
  private currentProcess?: TtsChildProcess;
  private queue: Array<{ text: string; resolve: () => void; reject: (e: unknown) => void }> =
    [];
  private draining = false;

  constructor(private readonly opts: SystemTtsOptions = {}) {}

  /** Last successful probe result, if any. Never triggers a new probe. */
  get engineInfoCache(): TtsEngineInfo | undefined {
    return this.engineInfo;
  }

  /** Cached engine probe. Safe to call repeatedly. */
  async detect(cached = true): Promise<TtsEngineInfo> {
    if (cached && this.engineInfo) return this.engineInfo;
    if (this.detectPromise) return this.detectPromise;
    this.detectPromise = this.probeEngine()
      .then((info) => {
        this.engineInfo = info;
        return info;
      })
      .finally(() => {
        this.detectPromise = undefined;
      });
    return this.detectPromise;
  }

  private async probeEngine(): Promise<TtsEngineInfo> {
    if (process.platform === "win32") {
      try {
        const res = await runCommand(
          "powershell",
          ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodePowerShell(SAPI_LIST_VOICES_SCRIPT)],
          { timeoutMs: 20_000 }
        );
        const voices = res.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (res.code === 0 && voices.length > 0) {
          return {
            engine: "sapi",
            available: true,
            voices,
            message: `${voices.length} giọng hệ thống (Windows SAPI)`,
            hint: "Dùng giọng đọc có sẵn trong Windows. Cài thêm gói giọng Việt trong Cài đặt Windows nếu cần."
          };
        }
        return {
          engine: "none",
          available: false,
          voices: [],
          message: "Windows Speech không khả dụng",
          hint: "Bật tính năng Speech trong Windows hoặc cài gói giọng đọc."
        };
      } catch (error) {
        return {
          engine: "none",
          available: false,
          voices: [],
          message: `Không kiểm tra được Windows Speech: ${String(error)}`,
          hint: "Kiểm tra lại quyền chạy PowerShell."
        };
      }
    }

    if (process.platform === "darwin") {
      try {
        const res = await runCommand("say", ["-v", "?"], { timeoutMs: 15_000 });
        const voices = res.stdout
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s{2,}/)[0] ?? "")
          .filter(Boolean);
        return {
          engine: "say",
          available: res.code === 0 && voices.length > 0,
          voices,
          message: voices.length ? `${voices.length} giọng hệ thống (macOS)` : "macOS say không có giọng",
          hint: "Thêm giọng trong Cài đặt → Trợ năng → Nội dung đọc."
        };
      } catch {
        return {
          engine: "none",
          available: false,
          voices: [],
          message: "macOS say không khả dụng",
          hint: "Cần macOS để dùng giọng hệ thống."
        };
      }
    }

    for (const bin of ["espeak-ng", "espeak"]) {
      try {
        const res = await runCommand(bin, ["--version"], { timeoutMs: 10_000 });
        if (res.code === 0) {
          const list = await runCommand(bin, ["--voices"], { timeoutMs: 10_000 }).catch(
            () => ({ code: 1, stdout: "", stderr: "" })
          );
          const voices = list.stdout
            .split(/\r?\n/)
            .slice(1)
            .map((line) => line.trim().split(/\s+/)[4] ?? line.trim().split(/\s+/)[1] ?? "")
            .filter(Boolean)
            .slice(0, 200);
          return {
            engine: "espeak",
            available: true,
            voices,
            message: `Giọng ${bin} (Linux)`,
            hint: `Cài đặt: sudo apt install ${bin}`
          };
        }
      } catch {
        // try next binary
      }
    }
    return {
      engine: "none",
      available: false,
      voices: [],
      message: "Không tìm thấy engine đọc giọng trên máy này",
      hint: "Cài espeak-ng (Linux) hoặc dùng máy Windows/macOS."
    };
  }

  /** Pick the best installed voice for the requested language hint. */
  resolveVoice(voices: string[], hint?: string): string | undefined {
    if (!voices.length) return undefined;
    const wanted = (hint ?? this.opts.voiceHint ?? "").trim().toLowerCase();
    if (!wanted) return undefined;
    const exact = voices.find((v) => v.toLowerCase() === wanted);
    if (exact) return exact;
    return voices.find((v) => v.toLowerCase().includes(wanted));
  }

  /**
   * Speak text. Calls are serialized: AI output arriving faster than the
   * speaker would otherwise stack on top of itself and garble the stream.
   */
  async speak(text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) return;
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ text: clean, resolve, reject });
      void this.drain();
    });
  }

  /** Stop current utterance and drop everything still queued. */
  async stopSpeech(): Promise<void> {
    this.queue.forEach((item) => item.resolve());
    this.queue = [];
    if (this.currentProcess && !this.currentProcess.killed) {
      try {
        this.currentProcess.kill();
      } catch {
        /* ignore */
      }
    }
    this.currentProcess = undefined;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get isSpeaking(): boolean {
    return Boolean(this.currentProcess && !this.currentProcess.killed);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) break;
        try {
          await this.speakOnce(next.text);
          next.resolve();
        } catch (error) {
          next.reject(error);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private speakOnce(text: string): Promise<void> {
    const info = this.engineInfo;
    const engine = info?.engine ?? "sapi";
    const voice = this.resolveVoice(info?.voices ?? [], this.opts.voiceHint);

    if (engine === "say") {
      return this.spawnAndWait("say", voice ? ["-v", voice, text] : [text]);
    }
    if (engine === "espeak") {
      const args: string[] = [];
      if (voice) args.push("-v", voice);
      if (typeof this.opts.rate === "number") args.push("-s", String(this.opts.rate));
      args.push(text);
      return this.spawnAndWait("espeak-ng", args).catch(() =>
        this.spawnAndWait("espeak", args)
      );
    }
    // Windows SAPI
    const env: NodeJS.ProcessEnv = { KHEPREE_TTS_TEXT: text };
    if (voice) env.KHEPREE_TTS_VOICE = voice;
    if (typeof this.opts.rate === "number") env.KHEPREE_TTS_RATE = String(this.opts.rate);
    if (typeof this.opts.volume === "number") {
      env.KHEPREE_TTS_VOLUME = String(Math.max(0, Math.min(100, this.opts.volume)));
    }
    return this.spawnAndWait(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodePowerShell(SAPI_SPEAK_SCRIPT)],
      env
    );
  }

  private spawnAndWait(
    command: string,
    args: string[],
    env?: NodeJS.ProcessEnv
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let child: TtsChildProcess;
      try {
        child = spawn(command, args, {
          env: { ...process.env, ...(env ?? {}) },
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        reject(new Error(`TTS_UNAVAILABLE:${String(error)}`));
        return;
      }
      this.currentProcess = child;

      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.currentProcess === child) this.currentProcess = undefined;
        fn();
      };

      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
        finish(() => reject(new Error("TTS_TIMEOUT")));
      }, this.opts.speakTimeoutMs ?? DEFAULT_TIMEOUT_MS);

      child.on("error", (error) => finish(() => reject(new Error(`TTS_UNAVAILABLE:${error.message}`))));
      child.on("close", (code) => {
        // Non-zero exit usually means no voice/engine; surface as unavailable.
        if (code === 0 || code === null) finish(() => resolve());
        else finish(() => reject(new Error(`TTS_ENGINE_EXIT_${code}`)));
      });
    });
  }
}

/** Pure helper: keep synthesized speech inside a sane on-air length. */
export function clampSpeechLength(text: string, maxChars = 500): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;

  const cut = clean.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > maxChars * 0.5) return cut.slice(0, lastStop + 1).trimEnd();
  // Reserve one character for the ellipsis so the result never exceeds maxChars.
  return `${cut.slice(0, maxChars - 1).trimEnd()}…`;
}
