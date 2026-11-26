import { PauseMarker, ScriptLine, VoiceTiming, WordCaption } from "./schemas";

export const DEFAULT_FPS = 30;

export function countWords(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export function estimateLineDuration(text: string, secPerWord = 0.4): number {
  const words = countWords(text);
  if (words === 0) return 0.8;
  return Math.max(0.8, Number((words * secPerWord).toFixed(2)));
}

export function buildPauses(
  lines: ScriptLine[],
  lineAudioDurationsSec?: Record<string, number>,
  fps = DEFAULT_FPS
): PauseMarker[] {
  const pauses: PauseMarker[] = [];
  let cursorFrame = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const durSec =
      lineAudioDurationsSec?.[line.id] ??
      line.durationSec ??
      estimateLineDuration(line.text);
    const lineFrames = Math.max(1, Math.round(durSec * fps));
    cursorFrame += lineFrames;

    const nextLine = lines[i + 1];
    if (!nextLine) continue;

    let pauseSec = 0;
    let reason = "";
    if (nextLine.beat === "twist") {
      pauseSec = 0.8;
      reason = "Jeda dramatis sebelum twist";
    } else if (nextLine.beat === "payoff") {
      pauseSec = 0.45;
      reason = "Jeda punchline sebelum payoff";
    }

    if (pauseSec > 0) {
      const pauseFrames = Math.round(pauseSec * fps);
      pauses.push({
        id: `pause-${line.id}`,
        afterLineId: line.id,
        durationSec: pauseSec,
        startFrame: cursorFrame,
        endFrame: cursorFrame + pauseFrames,
        reason,
      });
      cursorFrame += pauseFrames;
    }
  }

  return pauses;
}

export function buildCaptions(
  lines: ScriptLine[],
  audioDurations: Record<string, number>,
  fps = DEFAULT_FPS,
  pauses?: PauseMarker[]
): {
  captions: WordCaption[];
  pauses: PauseMarker[];
  lineTimings: Array<{
    lineId: string;
    startFrame: number;
    endFrame: number;
    durationSec: number;
  }>;
  totalFrames: number;
  durationSec: number;
} {
  const effectivePauses = pauses ?? buildPauses(lines, audioDurations, fps);
  const pauseAfterMap = new Map<string, number>();
  for (const p of effectivePauses) {
    pauseAfterMap.set(p.afterLineId, p.durationSec);
  }

  const captions: WordCaption[] = [];
  const resolvedPauses: PauseMarker[] = [];
  const lineTimings: Array<{
    lineId: string;
    startFrame: number;
    endFrame: number;
    durationSec: number;
  }> = [];

  let currentFrame = 0;

  for (const line of lines) {
    const durationSec = Math.max(
      0.4,
      audioDurations[line.id] ?? line.durationSec ?? estimateLineDuration(line.text)
    );
    const lineFrames = Math.max(1, Math.round(durationSec * fps));
    const lineStart = currentFrame;
    const lineEnd = lineStart + lineFrames;

    lineTimings.push({
      lineId: line.id,
      startFrame: lineStart,
      endFrame: lineEnd,
      durationSec,
    });

    const words = line.text.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const weights = words.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length));
      const totalWeight = weights.reduce((acc, n) => acc + n, 0);

      let wordCursor = lineStart;
      for (let idx = 0; idx < words.length; idx++) {
        const isLast = idx === words.length - 1;
        const rawSpan = Math.max(
          1,
          Math.round((weights[idx] / totalWeight) * lineFrames)
        );
        const startFrame = wordCursor;
        const endFrame = isLast
          ? lineEnd
          : Math.min(lineEnd - (words.length - 1 - idx), startFrame + rawSpan);

        captions.push({
          word: words[idx],
          lineId: line.id,
          speaker: line.speaker,
          startFrame,
          endFrame: Math.max(startFrame + 1, endFrame),
        });
        wordCursor = Math.max(startFrame + 1, endFrame);
      }
    }

    currentFrame = lineEnd;

    const pauseSec = pauseAfterMap.get(line.id) ?? 0;
    if (pauseSec > 0) {
      const pauseFrames = Math.round(pauseSec * fps);
      const existing = effectivePauses.find((p) => p.afterLineId === line.id);
      resolvedPauses.push({
        id: existing?.id ?? `pause-${line.id}`,
        afterLineId: line.id,
        durationSec: pauseSec,
        startFrame: currentFrame,
        endFrame: currentFrame + pauseFrames,
        reason: existing?.reason ?? "Jeda timing",
      });
      currentFrame += pauseFrames;
    }
  }

  const totalFrames = Math.max(fps, currentFrame);
  return {
    captions,
    pauses: resolvedPauses,
    lineTimings,
    totalFrames,
    durationSec: Number((totalFrames / fps).toFixed(2)),
  };
}

export function validateScriptMetrics(lines: ScriptLine[]) {
  const totalWords = lines.reduce((sum, l) => sum + countWords(l.text), 0);
  const estimatedDurationSec = Number(
    lines.reduce((sum, l) => sum + (l.durationSec || estimateLineDuration(l.text)), 0).toFixed(1)
  );
  const warnings: string[] = [];

  if (estimatedDurationSec < 15) {
    warnings.push(
      `Estimasi durasi ${estimatedDurationSec} dtk masih di bawah target minimum 15 dtk.`
    );
  }
  if (estimatedDurationSec > 60) {
    warnings.push(
      `Estimasi durasi ${estimatedDurationSec} dtk melebihi batas 60 dtk Shorts. Potong kata agar lebih padat.`
    );
  }

  lines.forEach((line, idx) => {
    const wc = countWords(line.text);
    if (wc > 12) {
      warnings.push(
        `Baris #${idx + 1} ("${line.speaker}") berisi ${wc} kata (>12 kata). Pecah menjadi beberapa beat agar mudah diikuti.`
      );
    }
  });

  return { totalWords, estimatedDurationSec, warnings };
}

export function buildVoiceTimingObject(params: {
  lines: ScriptLine[];
  audioDurations: Record<string, number>;
  fps?: number;
  pauses?: PauseMarker[];
  existing?: Partial<VoiceTiming> | null;
}): { voiceTiming: VoiceTiming; totalFrames: number; durationSec: number } {
  const fps = params.fps ?? DEFAULT_FPS;
  const computed = buildCaptions(params.lines, params.audioDurations, fps, params.pauses);
  const voiceTiming: VoiceTiming = {
    fps,
    captions: computed.captions,
    pauses: computed.pauses,
    lineTimings: computed.lineTimings,
    sfxMarkers: params.existing?.sfxMarkers ?? [],
    bgm: params.existing?.bgm,
    captionStyle: params.existing?.captionStyle ?? {
      fontFamily: "Inter",
      fontSize: 56,
      activeColor: "#FACC15",
      textColor: "#FFFFFF",
      bgColor: "rgba(0,0,0,0.68)",
      position: "tengah-bawah",
    },
  };
  return {
    voiceTiming,
    totalFrames: computed.totalFrames,
    durationSec: computed.durationSec,
  };
}
