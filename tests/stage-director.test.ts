import { describe, expect, it } from "vitest";
import { EpisodeScriptSchema } from "../src/lib/schemas";
import { assertStageMovement, directStage, evaluateStagePosition } from "../src/lib/stageDirector";

describe("stage director", () => {
  it("keeps old script data valid and blocks each Korek Sepuluh Biji beat with movement/action", () => {
    const script = EpisodeScriptSchema.parse({
      lines: [
        { id: "k1", beat: "hook", speaker: "Raka", text: "Sepuluh biji korek jatuh!", emotion: "kaget", action: "drop_item", prop: "kotak korek", moveTo: "counter", durationSec: 2 },
        { id: "k2", beat: "setup", speaker: "Bimo", text: "Aku ambil satu saja!", emotion: "mikir", action: "pick_up", actionTarget: "kotak korek", moveTo: "pintu", reactions: [{ character: "Raka", action: "point", delayFrames: 2 }], durationSec: 2 },
        { id: "k3", beat: "konflik", speaker: "Raka", text: "Jangan dibanting, bisa menyala!", emotion: "marah", action: "point", moveTo: "tengah_jalan", lookAt: "Bimo", reactions: [{ character: "Bimo", action: "surprised", delayFrames: 4 }], durationSec: 2 },
        { id: "k4", beat: "twist", speaker: "Bimo", text: "Waduh, koreknya jatuh lagi!", emotion: "kaget", action: "surprised", moveTo: "belakang_warung", durationSec: 2 },
        { id: "k5", beat: "payoff", speaker: "Raka", text: "Kita hitung bareng, lengkap sepuluh!", emotion: "senang", action: "wave", moveTo: "counter", durationSec: 2 },
      ],
    });
    const blocking = directStage(script, 30);
    expect(blocking).toHaveLength(5);
    expect(assertStageMovement(blocking)).toBe(true);
    expect(blocking.every((beat) => beat.characters.some((actor) => actor.moving || actor.action !== "idle"))).toBe(true);
    const firstActor = blocking[0].characters[0];
    expect(evaluateStagePosition(blocking[0], firstActor.character, blocking[0].startFrame)).toEqual(firstActor.from);
    expect(evaluateStagePosition(blocking[0], firstActor.character, blocking[0].endFrame)).toEqual(firstActor.to);
  });
});
