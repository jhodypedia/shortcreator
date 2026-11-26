import { describe, expect, it } from "vitest";
import {
  buildCaptions,
  buildPauses,
  estimateLineDuration,
  validateScriptMetrics,
} from "../src/lib/timing";
import { ScriptLine } from "../src/lib/schemas";

describe("timing engine", () => {
  const sampleLines: ScriptLine[] = [
    {
      id: "l1",
      beat: "hook",
      speaker: "Bimo",
      text: "Jangan pernah sentuh kotak ini!",
      emotion: "kaget",
      durationSec: 2.0,
    },
    {
      id: "l2",
      beat: "twist",
      speaker: "Nara",
      text: "Isinya ternyata kunci desa!",
      emotion: "mikir",
      durationSec: 1.8,
    },
    {
      id: "l3",
      beat: "payoff",
      speaker: "Bimo",
      text: "Lanjut ke episode dua!",
      emotion: "senang",
      durationSec: 1.6,
    },
  ];

  it("mengestimasi durasi kata secara konsisten", () => {
    expect(estimateLineDuration("satu dua tiga empat")).toBe(1.6);
    expect(estimateLineDuration("")).toBe(0.8);
  });

  it("membuat jeda otomatis sebelum twist dan payoff", () => {
    const pauses = buildPauses(sampleLines, { l1: 2.0, l2: 2.0, l3: 2.0 }, 30);
    expect(pauses.length).toBe(2);
    expect(pauses[0].durationSec).toBe(0.8); // sebelum twist
    expect(pauses[1].durationSec).toBe(0.45); // sebelum payoff
  });

  it("membangun word-level captions proporsional tanpa frame tumpang tindih", () => {
    const res = buildCaptions(sampleLines, { l1: 2.0, l2: 2.0, l3: 2.0 }, 30);
    expect(res.captions.length).toBe(13);
    for (let i = 1; i < res.captions.length; i++) {
      expect(res.captions[i].startFrame).toBeGreaterThanOrEqual(
        res.captions[i - 1].endFrame
      );
    }
    expect(res.totalFrames).toBeGreaterThan(180);
  });

  it("memberi peringatan untuk baris lebih dari 12 kata atau durasi terlalu pendek", () => {
    const longLine: ScriptLine = {
      id: "l-long",
      beat: "konflik",
      speaker: "Bimo",
      text: "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas dua belas tiga belas",
      emotion: "netral",
      durationSec: 5.2,
    };
    const metrics = validateScriptMetrics([longLine]);
    expect(metrics.warnings.length).toBe(2);
  });
});
