/**
 * Mock dual virtual cameras + reservation — no GPU, no Windows driver.
 * Real Windows RED/BLUE PASS is tracked separately; do not claim multi-cam until then.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  clearMockCameraBus,
  isTestPattern,
  MockVideoOutput,
  readMockCameraFrame
} from "../../src/main/connectors/media/video/mock-video-output";
import { LocalPreviewVideoOutput } from "../../src/main/connectors/media/video/local-preview-video-output";
import { WindowsVirtualCameraOutput } from "../../src/main/connectors/media/video/windows-virtual-camera-output";
import { VideoDeviceReservationService } from "../../src/main/connectors/media/video/video-device-reservation";
import type { VideoFramePayload } from "../../src/main/connectors/media/video/types";

const format = { width: 720, height: 1280, pixelFormat: "rgba" as const, fps: 25 };

function pattern(color: string, label: string): VideoFramePayload {
  return {
    width: 720,
    height: 1280,
    pixelFormat: "rgba",
    data: { kind: "test-pattern", color, label },
    timestampMs: Date.now()
  };
}

afterEach(() => {
  clearMockCameraBus();
});

describe("VideoDeviceReservationService", () => {
  it("blocks two accounts from claiming the same target", () => {
    const r = new VideoDeviceReservationService();
    r.claim("mock:khepree-1", "acc_a");
    expect(() => r.claim("mock:khepree-1", "acc_b")).toThrow(/VIDEO_TARGET_CLAIMED/);
    r.release("mock:khepree-1", "acc_a");
    r.claim("mock:khepree-1", "acc_b");
    expect(r.holder("mock:khepree-1")).toBe("acc_b");
  });
});

describe("MockVideoOutput dual cameras", () => {
  it("A gets RED/TEXT A and B gets BLUE/TEXT B — no cross-talk", async () => {
    const reservations = new VideoDeviceReservationService();
    const camA = new MockVideoOutput({ accountId: "acc_a", reservations });
    const camB = new MockVideoOutput({ accountId: "acc_b", reservations });

    await camA.open("mock:khepree-1", format);
    await camB.open("mock:khepree-2", format);

    await camA.pushFrame(pattern("RED", "TEXT A"));
    await camB.pushFrame(pattern("BLUE", "TEXT B"));

    const recvA = readMockCameraFrame("mock:khepree-1");
    const recvB = readMockCameraFrame("mock:khepree-2");
    expect(recvA && isTestPattern(recvA.data)).toBe(true);
    expect(recvB && isTestPattern(recvB.data)).toBe(true);
    if (!recvA || !isTestPattern(recvA.data) || !recvB || !isTestPattern(recvB.data)) {
      throw new Error("expected test patterns");
    }
    expect(recvA.data.color).toBe("RED");
    expect(recvA.data.label).toBe("TEXT A");
    expect(recvB.data.color).toBe("BLUE");
    expect(recvB.data.label).toBe("TEXT B");

    await camA.dispose();
    await camB.dispose();
  });

  it("second account cannot open the same mock target", async () => {
    const reservations = new VideoDeviceReservationService();
    const camA = new MockVideoOutput({ accountId: "acc_a", reservations });
    const camB = new MockVideoOutput({ accountId: "acc_b", reservations });
    await camA.open("mock:khepree-1", format);
    await expect(camB.open("mock:khepree-1", format)).rejects.toThrow(/VIDEO_TARGET_CLAIMED/);
    await camA.dispose();
    await camB.dispose();
  });
});

describe("LocalPreviewVideoOutput", () => {
  it("stores last frame for in-app preview", async () => {
    const preview = new LocalPreviewVideoOutput({ accountId: "acc_a" });
    const [t] = await preview.listTargets();
    await preview.open(t!.id, format);
    await preview.pushFrame(pattern("#112233", "preview"));
    const last = preview.getLastFrame();
    expect(last && isTestPattern(last.data) && last.data.label).toBe("preview");
    await preview.dispose();
  });
});

describe("WindowsVirtualCameraOutput stub", () => {
  it("lists future device names but refuses open until bridge exists", async () => {
    const win = new WindowsVirtualCameraOutput({ accountId: "acc_a" });
    const targets = await win.listTargets();
    expect(targets.map((t) => t.name)).toEqual(["Camera Khepree 1", "Camera Khepree 2"]);
    await expect(win.open("win-vcam:khepree-1", format)).rejects.toThrow(
      /WINDOWS_VIRTUAL_CAMERA_NOT_IMPLEMENTED/
    );
    const h = await win.health();
    expect(h.status).toBe("DISABLED");
  });
});
