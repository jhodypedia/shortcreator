import { describe, expect, it } from "vitest";
import { buildContinuityFromData, validateSequelEpisode } from "../src/lib/continuity";
import { createDefaultBible } from "../src/lib/bible";

describe("continuity engine", () => {
  const bible = createDefaultBible({
    name: "Test Series",
    theme: "Petualangan",
    tone: "lucu",
    visualStyle: "voxel-3d",
  });
  bible.continuity = {
    summary: "Bimo membuka kotak merah di alun-alun.",
    activeCliffhanger: "Portal kristal di gua mulai menyala ungu",
    threads: ["Portal kristal di gua mulai menyala ungu"],
    characterStates: { Bimo: "penasaran" },
  };

  it("membangun ringkasan continuity 3 baris", () => {
    const snap = buildContinuityFromData({
      seriesId: "s1",
      seriesName: "Test Series",
      bible,
      lastEpisode: {
        number: 1,
        title: "Kotak Aneh",
        hook: "Ada apa?",
        twist: "Ternyata ayam",
        cliffhanger: "Portal kristal di gua mulai menyala ungu",
        status: "done",
      },
    });
    expect(snap.threeLineSummary).toHaveLength(3);
    expect(snap.activeCliffhanger).toContain("Portal kristal");
    expect(snap.lastEpisodeNumber).toBe(1);
  });

  it("menolak episode lanjutan tanpa cliffhanger baru", () => {
    const res = validateSequelEpisode({
      activeCliffhanger: "Portal kristal di gua mulai menyala ungu",
      hook: "Portal kristal ternyata membuka jalan baru",
      scriptTexts: ["Ayo masuk ke gua"],
      nextCliffhanger: "",
    });
    expect(res.ok).toBe(false);
  });

  it("menolak episode lanjutan yang mengabaikan cliffhanger lama tanpa konfirmasi", () => {
    const res = validateSequelEpisode({
      activeCliffhanger: "Portal kristal di gua mulai menyala ungu",
      hook: "Hari ini cerah banget di pasar",
      scriptTexts: ["Ayo beli roti"],
      nextCliffhanger: "Dompet Bimo hilang di pasar",
      continuityConfirmed: false,
    });
    expect(res.ok).toBe(false);
  });

  it("menerima episode lanjutan yang menjawab cliffhanger lama dan menyisakan cliffhanger baru", () => {
    const res = validateSequelEpisode({
      activeCliffhanger: "Portal kristal di gua mulai menyala ungu",
      hook: "Portal kristal ungu itu akhirnya terbuka lebar!",
      scriptTexts: ["Kita harus cek isi portal ini."],
      nextCliffhanger: "Ada bayangan asing melangkah keluar dari portal",
    });
    expect(res.ok).toBe(true);
  });
});
