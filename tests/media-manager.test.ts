import { describe, expect, it } from "vitest";
import { clampSpeechLength, SystemTtsProvider } from "../src/main/connectors/media/system-tts-provider";
import { MediaManager } from "../src/main/connectors/media/media-manager";
import type { MediaPublicState } from "../src/shared/media-contracts";

/** Minimal in-memory stand-in for the settings-backed persistence. */
function makeMediaManager(opts: {
  tts?: SystemTtsProvider;
  voiceEnabled?: boolean;
  voice?: string;
} = {}) {
  let enabled = opts.voiceEnabled ?? true;
  let voice: string | undefined = opts.voice;
  const state: MediaPublicState[] = [];
  const manager = new MediaManager({
    getVoiceHint: () => voice,
    setVoiceHint: (v) => {
      voice = v;
    },
    getVoiceEnabled: () => enabled,
    setVoiceEnabled: (v) => {
      enabled = v;
    },
    ttsFactory: () =>
      opts.tts ??
      ({
        speak: async () => undefined,
        stopSpeech: async () => undefined,
        detect: async () => ({
          engine: "sapi",
          available: false,
          voices: [],
          message: "",
          hint: ""
        }),
        isSpeaking: false,
        pendingCount: 0,
        engineInfoCache: undefined
      } as unknown as SystemTtsProvider)
  });
  return { manager, getEnabled: () => enabled, getVoice: () => voice, state };
}

describe("clampSpeechLength", () => {
  it("leaves normal lines untouched", () => {
    expect(clampSpeechLength("Dạ cảm ơn bạn ạ")).toBe("Dạ cảm ơn bạn ạ");
  });

  it("truncates a runaway line instead of talking for minutes", () => {
    const long = "xin chào ".repeat(200);
    const clamped = clampSpeechLength(long, 200);
    expect(clamped.length).toBeLessThanOrEqual(201);
    expect(clamped.length).toBeLessThan(long.length);
  });

  it("prefers to cut on a sentence boundary", () => {
    const text = `${"Một câu ngắn. ".repeat(40)}còn dang dở`;
    const clamped = clampSpeechLength(text, 120);
    expect(clamped.endsWith(".")).toBe(true);
  });

  it("handles empty input", () => {
    expect(clampSpeechLength("   ")).toBe("");
  });
});

describe("SystemTtsProvider — voice selection", () => {
  it("matches the requested language hint", () => {
    const tts = new SystemTtsProvider({ voiceHint: "vietnamese" });
    const voices = ["Microsoft David - English (United States)", "Microsoft An - Vietnamese"];
    expect(tts.resolveVoice(voices, "vietnamese")).toBe("Microsoft An - Vietnamese");
  });

  it("prefers an exact match over a partial one", () => {
    const tts = new SystemTtsProvider();
    const voices = ["An Online (Natural) - Vietnamese", "An - Vietnamese"];
    expect(tts.resolveVoice(voices, "An - Vietnamese")).toBe("An - Vietnamese");
  });

  it("returns undefined when nothing matches", () => {
    const tts = new SystemTtsProvider({ voiceHint: "klingon" });
    expect(tts.resolveVoice(["English Voice"], "klingon")).toBeUndefined();
  });

  it("returns undefined for an empty voice list", () => {
    const tts = new SystemTtsProvider({ voiceHint: "vi" });
    expect(tts.resolveVoice([], "vi")).toBeUndefined();
  });
});

describe("MediaManager — human takeover", () => {
  it("stays silent while the operator has muted AI voice", async () => {
    const { manager } = makeMediaManager({ voiceEnabled: false });
    let spoke = false;
    manager.mock.speak = async () => {
      spoke = true;
    };

    await manager.speak("Dạ cảm ơn bạn");
    expect(spoke).toBe(false);
  });

  it("speaks again once voice is re-enabled", async () => {
    const { manager } = makeMediaManager({ voiceEnabled: false });
    let spoke = false;
    manager.mock.speak = async () => {
      spoke = true;
    };

    manager.setVoiceEnabled(true);
    await manager.speak("Dạ cảm ơn bạn");
    expect(spoke).toBe(true);
  });

  it("muting stops anything currently playing", async () => {
    const { manager, getEnabled } = makeMediaManager({ voiceEnabled: true });
    let stopped = false;
    manager.mock.stopSpeech = async () => {
      stopped = true;
    };

    manager.setVoiceEnabled(false);
    await new Promise((r) => setImmediate(r));
    expect(getEnabled()).toBe(false);
    expect(stopped).toBe(true);
  });

  it("never throws at the caller when the speaker fails", async () => {
    const { manager } = makeMediaManager();
    manager.mock.speak = async () => {
      throw new Error("TTS offline");
    };
    await expect(manager.speak("hello")).resolves.toBeUndefined();
  });

  it("caps runaway utterances before handing them to the engine", async () => {
    const { manager } = makeMediaManager();
    let received = "";
    manager.mock.speak = async (text: string) => {
      received = text;
    };
    await manager.speak("xin chào ".repeat(500));
    expect(received.length).toBeLessThanOrEqual(500);
  });

  it("ignores empty speech", async () => {
    const { manager } = makeMediaManager();
    let calls = 0;
    manager.mock.speak = async () => {
      calls += 1;
    };
    await manager.speak("   ");
    expect(calls).toBe(0);
  });
});

describe("MediaManager — persistent settings", () => {
  it("round-trips the chosen voice", () => {
    const { manager, getVoice } = makeMediaManager();
    manager.setVoice("Microsoft An - Vietnamese");
    expect(getVoice()).toBe("Microsoft An - Vietnamese");
    manager.setVoice(undefined);
    expect(getVoice()).toBeUndefined();
  });

  it("normalizes a blank voice to undefined", () => {
    const { manager, getVoice } = makeMediaManager();
    manager.setVoice("   ");
    expect(getVoice()).toBeUndefined();
  });
});
