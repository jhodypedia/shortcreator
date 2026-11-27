import { describe, expect, it } from "vitest";
import { cameraZoomRatio, chooseBeatShot, directedShotWins, frameSpeakerCamera, isSpeakerFramed, punchInZoomRatio } from "../src/remotion/ShortComposition";

describe("beat camera direction", () => {
  it("chooses wide for movement, dialog reverse angles, and closeups for reaction/twist", () => {
    expect(chooseBeatShot({ action: "walk", beat: "konflik" } as never, 0)).toBe("wide");
    expect(chooseBeatShot({ action: "talk", beat: "setup" } as never, 0)).toBe("medium");
    expect(chooseBeatShot({ action: "talk", beat: "setup" } as never, 1)).toBe("over-shoulder");
    expect(chooseBeatShot({ action: "surprised", beat: "konflik" } as never, 2)).toBe("close-up");
    expect(chooseBeatShot({ action: "talk", beat: "twist" } as never, 3)).toBe("close-up");
  });

  it("limits punch-in movement to 12% and never exceeds the 15% zoom ceiling", () => {
    expect(punchInZoomRatio([0, 2, 5], [0, 1.4, 0])).toBe(0.12);
    expect(cameraZoomRatio([0, 2, 5], [0, 2, 5])).toBe(0);
    expect(punchInZoomRatio([0, 2, 5], [0, 1.4, 0])).toBeLessThanOrEqual(0.15);
  });

  it("prefers editor shots and uses directed shots only when the editor has none", () => {
    const edited = { shot: "wide" } as never;
    const directed = { shot: "close-up" } as never;
    expect(directedShotWins(edited, directed)).toBe(edited);
    expect(directedShotWins(undefined, directed)).toBe(directed);
  });

  it("keeps the speaker head and body inside the 9:16 frame for four stage marks and four shot types", () => {
    const marks: [number, number, number][] = [[-1.35, 0, 0], [1.35, 0, -0.3], [0, 0, 0.35], [-0.75, 0, -0.85]];
    const types = ["wide", "medium", "over-shoulder", "close-up"] as const;
    for (const mark of marks) {
      for (const [shotIndex, type] of types.entries()) {
        const shot = frameSpeakerCamera({ shot: type, startFrame: 0, endFrame: 30, camera: {
          position: [shotIndex % 2 ? 1.7 : -1.7, type === "wide" ? 4.2 : 2.2, type === "wide" ? 9.5 : 5.2],
          lookAt: [0, 1.4, 0], fov: type === "close-up" ? 42 : 48,
        }, transition: "cut", note: "test" }, mark);
        expect(isSpeakerFramed(shot.camera!.position, shot.camera!.lookAt, mark, shot.camera!.fov)).toBe(true);
      }
    }
  });
});
