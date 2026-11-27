export type AudioQuality = { durationSec: number; silenceRatio: number; peak: number };
export function assessAudioQuality(stats: AudioQuality, expectedSec: number) {
  const issues: string[] = [];
  if (!Number.isFinite(stats.durationSec) || stats.durationSec < Math.max(0.25, expectedSec * 0.35) || stats.durationSec > Math.max(expectedSec * 2.8, expectedSec + 4)) issues.push("durasi tidak wajar");
  if (stats.silenceRatio > 0.48) issues.push("rasio hening terlalu tinggi");
  if (stats.peak >= 0.999) issues.push("audio clipping");
  return { passed: issues.length === 0, issues };
}
