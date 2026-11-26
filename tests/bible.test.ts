import { describe, expect, it } from "vitest";
import { createDefaultBible, validateAndBumpBible, validateShotList } from "../src/lib/bible";

describe("bible & shot validation", () => {
  it("menaikkan versi Bible saat disimpan", () => {
    const bible = createDefaultBible({
      name: "Desa Blok",
      theme: "Komedi",
      tone: "lucu",
      visualStyle: "voxel-3d",
    });
    const res = validateAndBumpBible({
      nextBible: bible,
      currentVersion: 1,
      changeNote: "Tambah warna baru",
      reason: "Konsistensi",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.nextVersion).toBe(2);
      expect(res.bible.changelog[0].version).toBe(2);
    }
  });

  it("menolak Bible bila karakter tidak punya voiceId", () => {
    const bible = createDefaultBible({
      name: "Desa Blok",
      theme: "Komedi",
      tone: "lucu",
      visualStyle: "voxel-3d",
    });
    bible.characters.push({ id: "character-test", name: "Karakter uji", role: "Uji", traits: ["uji"], colorPrimary: "#112233", colorSkin: "#F5C6A5", colorPants: "#334155", colorHair: "#1E293B", proportions: { headScale: 1, bodyHeight: 1, limbLength: 1 }, voiceId: "", voicePitch: 0, voiceSpeed: 1, expression: "netral", accessory: "none", catchphrase: "", forbidden: "" });
    const res = validateAndBumpBible({
      nextBible: bible,
      currentVersion: 1,
    });
    expect(res.ok).toBe(false);
  });

  it("memberi peringatan shot list tanpa close-up dan shot kembar", () => {
    const warnings = validateShotList([
      {
        shot: "wide",
        startFrame: 0,
        endFrame: 90,
        camera: { position: [0, 4, 9], lookAt: [0, 1, 0], fov: 50 },
        transition: "cut",
        note: "",
      },
      {
        shot: "wide",
        startFrame: 90,
        endFrame: 180,
        camera: { position: [0, 4, 9], lookAt: [0, 1, 0], fov: 50 },
        transition: "cut",
        note: "",
      },
    ]);
    expect(warnings.some((w) => w.includes("sama persis"))).toBe(true);
    expect(warnings.some((w) => w.includes("close-up"))).toBe(true);
  });
});
