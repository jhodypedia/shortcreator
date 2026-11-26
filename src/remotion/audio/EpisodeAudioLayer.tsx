import React from "react";
import { Audio, Loop, Sequence, staticFile } from "remotion";
import { VoiceTiming } from "../../lib/schemas";

interface AudioFileEntry {
  lineId: string;
  path: string;
  durationSec: number;
}

function resolveAudioSrc(rawPath: string, audioBaseUrl?: string): string {
  if (!rawPath) return "";
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    return rawPath;
  }
  if (audioBaseUrl) {
    return `${audioBaseUrl.replace(/\/$/, "")}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;
  }
  return rawPath;
}

export const EpisodeAudioLayer: React.FC<{
  voiceTiming?: VoiceTiming | null;
  audioFiles?: AudioFileEntry[];
  audioBaseUrl?: string;
  muted?: boolean;
  includeSfx?: boolean;
  actionCues?: Array<{ frame: number; action: string; sfx?: string }>;
  totalFrames?: number;
}> = ({
  voiceTiming,
  audioFiles = [],
  audioBaseUrl,
  muted = false,
  includeSfx = true,
  actionCues = [],
  totalFrames,
}) => {
  if (muted) return null;

  const lineTimings = voiceTiming?.lineTimings ?? [];
  const sfxMarkers = voiceTiming?.sfxMarkers ?? [];
  const bgm = voiceTiming?.bgm;

  const bgmSrc = bgm?.path ? resolveAudioSrc(bgm.path, audioBaseUrl) : "";
  const baseBgmVol = bgm?.volume ?? 0.3;
  const duckDb = bgm?.duckDb ?? -12;
  const duckFactor = Math.pow(10, duckDb / 20); // -12 dB ~= 0.251

  return (
    <>
      {bgmSrc && (
        <Loop durationInFrames={totalFrames ?? 900}>
          <Audio
            src={bgmSrc}
            volume={(f) => {
              const isSpeaking = lineTimings.some(
                (lt) => f >= lt.startFrame - 2 && f < lt.endFrame + 2
              );
              return isSpeaking ? baseBgmVol * duckFactor : baseBgmVol;
            }}
          />
        </Loop>
      )}

      {audioFiles.map((af) => {
        const timing = lineTimings.find((t) => t.lineId === af.lineId);
        const startFrame = timing?.startFrame ?? 0;
        const durationInFrames = Math.max(
          1,
          timing ? timing.endFrame - timing.startFrame : Math.round(af.durationSec * 30)
        );
        const src = resolveAudioSrc(af.path, audioBaseUrl);
        if (!src) return null;
        return (
          <Sequence
            key={`audio-${af.lineId}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <Audio src={src} volume={1} />
          </Sequence>
        );
      })}

      {includeSfx &&
        sfxMarkers.map((sfx) => {
          const src = resolveAudioSrc(sfx.path, audioBaseUrl);
          if (!src) return null;
          return (
            <Sequence key={`sfx-${sfx.id}`} from={Math.max(0, sfx.frame)}>
              <Audio src={src} volume={sfx.volume ?? 0.8} />
            </Sequence>
          );
        })}
      {includeSfx && actionCues.map((cue, idx) => {
        const src = cue.sfx ? resolveAudioSrc(cue.sfx, audioBaseUrl) : "";
        if (src) return <Sequence key={`action-sfx-${idx}`} from={Math.max(0, cue.frame)}><Audio src={src} volume={0.65} /></Sequence>;
        const tone = cue.sfx?.toLowerCase().includes("tink") ? 880 : cue.action === "slam_table" ? 90 : cue.action === "walk" ? 150 : cue.action === "drop_item" ? 240 : cue.action === "pick_up" || cue.action === "hand_over" ? 880 : cue.action === "laugh" ? 430 : 660;
        const asset = `/sfx/action-${tone}.wav`;
        return <Sequence key={`generated-action-sfx-${idx}`} from={Math.max(0, cue.frame)}><Audio src={staticFile(asset)} volume={cue.action === "slam_table" ? 0.42 : 0.18} /></Sequence>;
      })}
    </>
  );
};
