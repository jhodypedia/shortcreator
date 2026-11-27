import { describe, expect, it } from "vitest";
import { applyJsonPatches, validateDirectedEpisode } from "./workflow";

describe("AI editor patches and deterministic validators", () => {
  it("applies set/update/delete patches without mutating input and supports undo snapshots", () => {
    const original = { bible: { tone: "lucu", unwanted: true } };
    const changed = applyJsonPatches(original, [
      { op: "update", path: "bible.tone", value: "hangat" },
      { op: "set", path: "bible.neverDo.0", value: "jangan berbahaya" },
      { op: "delete", path: "bible.unwanted" },
    ]);
    expect(original.bible.tone).toBe("lucu");
    expect(changed).toEqual({ bible: { tone: "hangat", neverDo: { 0: "jangan berbahaya" } } });
    expect(applyJsonPatches(changed, [{ op: "set", path: "bible.tone", value: original.bible.tone }]).bible.tone).toBe("lucu");
  });
  it("rejects unsafe patch paths and invalid directed references", () => {
    expect(() => applyJsonPatches({}, [{ op: "set", path: "__proto__.polluted", value: true }])).toThrow();
    expect(validateDirectedEpisode({ beats: [{ speaker: "missing", setId: "bad", action: "teleport", moveTo: "invalid" }] }, [{ name: "A" }], [{ id: "set" }]).valid).toBe(false);
  });
  it("validates AI script and director schemas for output test coverage", async () => {
    const { ROLE_DEFINITIONS } = await import("./roles");
    const script = { beats: [{ speaker: "A", text: "Hook", emotion: "kaget" }] };
    expect(ROLE_DEFINITIONS.scriptwriter.output.safeParse(script).success).toBe(true);
    expect(ROLE_DEFINITIONS.director.output.safeParse({ beats: [{ ...script.beats[0], action: "talk", moveTo: null, lookAt: "B", prop: null, sfx: null, reactions: [], shot: "wide", setId: "set-id" }] }).success).toBe(true);
    expect(ROLE_DEFINITIONS.critic.output.safeParse({ score: 8, durationSec: 30, hasHook: true, hasTwist: true, safe: true, notes: [], improvements: [] }).success).toBe(true);
    expect(ROLE_DEFINITIONS.editor.output.safeParse({ operations: [{ op: "update", target: "bible", path: "tone", value: "lucu" }] }).success).toBe(true);
  });
});
