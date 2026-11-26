import { describe, expect, it } from "vitest";
import { cameraZoomRatio, chooseBeatShot, punchInZoomRatio } from "../src/remotion/ShortComposition";

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
});
