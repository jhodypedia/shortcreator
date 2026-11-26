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
    const blocking = directStage(script, 30, [], [], { counter: [-1.35, 0, 0], pintu: [1.35, 0, -0.3], tengah_jalan: [0, 0, 0.35], belakang_warung: [-0.75, 0, -0.85] });
    expect(blocking).toHaveLength(5);
    expect(assertStageMovement(blocking)).toBe(true);
    expect(blocking.every((beat) => beat.characters.some((actor) => actor.moving || actor.action !== "idle"))).toBe(true);
    const firstActor = blocking[0].characters[0];
    expect(evaluateStagePosition(blocking[0], firstActor.character, blocking[0].startFrame)).toEqual(firstActor.from);
    expect(evaluateStagePosition(blocking[0], firstActor.character, blocking[0].endFrame)).toEqual(firstActor.to);
  });

  it("keeps a speaker on their last position and does not assign an index-rotating gesture", () => {
    const script = EpisodeScriptSchema.parse({ lines: [
      { id: "a", speaker: "Raka", text: "Halo semua", emotion: "netral", durationSec: 2, moveTo: "counter" },
      { id: "b", speaker: "Bimo", text: "Iya, aku dengar", emotion: "netral", durationSec: 2 },
      { id: "c", speaker: "Raka", text: "Begitu ceritanya", emotion: "netral", durationSec: 2 },
    ] });
    const beats = directStage(script, 30, [], ["Raka", "Bimo"], { counter: [-1.35, 0, 0], pintu: [1.35, 0, -0.3] });
    expect(beats[0].characters[0].action).toBe("talk");
    expect(beats[2].characters[0].from).toEqual(beats[0].characters[0].to);
    expect(beats[2].characters[0].to).toEqual(beats[0].characters[0].to);
    expect(evaluateStagePosition(beats[2], "Raka", beats[2].startFrame + 1)).toEqual(beats[0].characters[0].to);
  });
});
