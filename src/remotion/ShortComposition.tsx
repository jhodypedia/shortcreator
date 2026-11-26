import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import {
  EpisodeScript,
  SeriesBible,
  ShotItem,
  VoiceTiming,
} from "../lib/schemas";
import { VoxelCharacter } from "./characters/VoxelCharacter";
import { VoxelSetScene } from "./scenes/VoxelSetScene";
import { SafeAreaGuide, WordCaptions } from "./captions/WordCaptions";
import { EpisodeAudioLayer } from "./audio/EpisodeAudioLayer";
import { directStage, evaluateStagePosition, DirectedBeat } from "../lib/stageDirector";
import { CartoonEffects } from "./CartoonEffects";
import { ActionTypeSchema } from "../lib/schemas";

export interface ShortCompositionProps {
  episode: {
    id: string;
    number: number;
    title: string;
    hook: string;
    script: EpisodeScript;
    voiceTiming?: VoiceTiming | null;
    shots: { shots: ShotItem[] };
    audioFiles?: Array<{ lineId: string; path: string; durationSec: number }>;
    totalFrames?: number;
  };
  bible: SeriesBible;
  visualStyle?: "voxel-3d" | "cartoon-3d";
  showSafeArea?: boolean;
  showCaptions?: boolean;
  muteAudio?: boolean;
  includeSfx?: boolean;
  audioOnly?: boolean;
  audioBaseUrl?: string;
  qualityScale?: number;
}

export function chooseBeatShot(line: EpisodeScript["lines"][number], index: number): ShotItem["shot"] {
  if (line.beat === "payoff") return "dolly-in";
  if (line.beat === "twist" || line.emotion === "kaget" || line.action === "surprised") return "close-up";
  if (line.action === "walk" || line.action === "drop_item" || line.action === "pick_up") return "wide";
  return index % 2 === 0 ? "medium" : "over-shoulder";
}

export function cameraZoomRatio(start: number[], end: number[]) {
  const a = Math.hypot(start[0], start[1] - 1.4, start[2]);
  const b = Math.hypot(end[0], end[1] - 1.4, end[2]);
  return a === 0 ? 0 : Math.abs(a - b) / a;
}

export function punchInZoomRatio(start: number[], lookAt: number[]) {
  const distance = Math.hypot(...start.map((v, index) => v - lookAt[index]));
  return distance > 0 ? 0.12 : 0;
}

const CameraController: React.FC<{
  activeShot?: ShotItem;
  frame: number;
  punchIn?: boolean;
}> = ({ activeShot, frame, punchIn = false }) => {
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);

  const pos = activeShot?.camera?.position ?? [0, 2.2, 5.2];
  const look = activeShot?.camera?.lookAt ?? [0, 1.4, 0];
  const fov = activeShot?.camera?.fov ?? 45;

  const start = activeShot?.startFrame ?? 0;
  const end = Math.max(start + 1, activeShot?.endFrame ?? start + 60);
  const progress = Math.min(1, Math.max(0, (frame - start) / (end - start)));

  let cx = pos[0];
  let cy = pos[1];
  let cz = pos[2];

  if (activeShot?.shot === "dolly-in" && punchIn) {
    // A single quick punch-in only; clamp camera travel to 12% of the original distance.
    const push = Math.min(1, progress * 4) * 0.12;
    cx = THREE.MathUtils.lerp(pos[0], look[0] + (pos[0] - look[0]) * (1 - push), progress < 0.25 ? progress / 0.25 : 1);
    cy = THREE.MathUtils.lerp(pos[1], look[1] + (pos[1] - look[1]) * (1 - push), progress < 0.25 ? progress / 0.25 : 1);
    cz = THREE.MathUtils.lerp(pos[2], look[2] + (pos[2] - look[2]) * (1 - push), progress < 0.25 ? progress / 0.25 : 1);
  } else if (activeShot?.shot === "pan") {
    cx = pos[0] + Math.sin(progress * Math.PI * 2) * Math.max(0.03, Math.abs(pos[0]) * 0.03);
  } else {
    cx += Math.sin(frame * 0.035) * Math.max(0.015, Math.abs(pos[0]) * 0.02);
    cy += Math.sin(frame * 0.027) * 0.025;
  }

  return (
    <PerspectiveCamera
      ref={(node) => {
        camRef.current = node;
        if (node) {
          node.lookAt(look[0], look[1], look[2]);
        }
      }}
      makeDefault
      position={[cx, cy, cz]}
      fov={fov}
    />
  );
};

export const ShortComposition: React.FC<ShortCompositionProps> = ({
  episode,
  bible,
  visualStyle = "voxel-3d",
  showSafeArea = false,
  showCaptions = true,
  muteAudio = false,
  includeSfx = true,
  audioOnly = false,
  audioBaseUrl,
  qualityScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const lines = useMemo(() => episode.script?.lines ?? [], [episode.script?.lines]);
  const lineTimings = useMemo(
    () => episode.voiceTiming?.lineTimings ?? [],
    [episode.voiceTiming?.lineTimings]
  );
  const shots = useMemo(() => episode.shots?.shots ?? [], [episode.shots?.shots]);
  const directedShots = useMemo(() => lines.map((line, idx): ShotItem => {
    const type = chooseBeatShot(line, idx);
    const position: Record<ShotItem["shot"], [number, number, number]> = {
      wide: [0, 4.2, 9.5], medium: [idx % 2 ? -1.1 : 1.1, 2.2, 5.2],
      "over-shoulder": [idx % 2 ? 1.7 : -1.7, 2.1, 3.8], "close-up": [idx % 2 ? -0.3 : 0.3, 1.85, 2.8],
      "low-angle": [0.4, 0.75, 3.8], "high-angle": [0, 4, 4], "dolly-in": [0, 2, 5], pan: [0, 2, 5],
    };
    const timing = lineTimings.find((item) => item.lineId === line.id);
    const startFrame = timing?.startFrame ?? idx * 60;
    const endFrame = timing?.endFrame ?? startFrame + 60;
    return { id: `directed-${line.id}`, lineId: line.id, shot: type, startFrame, endFrame,
      camera: { position: position[type], lookAt: [0, 1.45, 0], fov: type === "close-up" ? 42 : 48 }, transition: "cut", note: line.action ?? line.beat ?? "dialog" };
  }), [lines, lineTimings]);
  const directedBeats = useMemo(
    () => directStage(episode.script, fps, lineTimings, bible.characters.map((character) => character.name)),
    [episode.script, fps, lineTimings, bible.characters],
  );
  const effectCues = useMemo(() => directedBeats.map((beat) => ({
    frame: beat.startFrame,
    action: ActionTypeSchema.parse(beat.characters[0]?.action ?? "talk"),
    prop: beat.characters[0]?.prop,
    sfx: beat.characters[0]?.sfx,
  })), [directedBeats]);

  const activeLineTiming = useMemo(
    () => lineTimings.find((lt) => frame >= lt.startFrame && frame < lt.endFrame),
    [lineTimings, frame]
  );

  const activeLine = useMemo(() => {
    if (activeLineTiming) {
      return lines.find((l) => l.id === activeLineTiming.lineId) ?? lines[0];
    }
    const activeCaption = episode.voiceTiming?.captions?.find(
      (c) => frame >= c.startFrame && frame < c.endFrame
    );
    if (activeCaption?.lineId) {
      return lines.find((l) => l.id === activeCaption.lineId) ?? lines[0];
    }
    return lines[0];
  }, [activeLineTiming, episode.voiceTiming?.captions, frame, lines]);

  const activeShot = useMemo(() => {
    const candidate = directedShots.find((s) => frame >= s.startFrame && frame < s.endFrame);
    const fallback = shots.find((s) => frame >= s.startFrame && frame < s.endFrame) ?? shots[shots.length - 1];
    if (candidate) return candidate;
    if (fallback) return fallback;
    return { shot: "medium" as const, startFrame: 0, endFrame: Number.MAX_SAFE_INTEGER,
      camera: { position: [0, 2.2, 5.2] as [number, number, number], lookAt: [0, 1.4, 0] as [number, number, number], fov: 45 }, transition: "cut" as const, note: "medium fallback" };
  }, [directedShots, shots, frame]);
  const punchIn = activeShot?.shot === "dolly-in" &&
    Boolean(activeLine?.beat === "payoff" || activeLine?.beat === "twist") &&
    !directedShots.some((shot) => shot.shot === "dolly-in" && shot.startFrame < (activeShot?.startFrame ?? 0));

  const activeSet = useMemo(() => {
    const targetId = activeLine?.setId ?? episode.script?.setId;
    return bible.sets.find((s) => s.id === targetId) ?? bible.sets[0];
  }, [activeLine?.setId, bible.sets, episode.script?.setId]);

  const isAnyWordActive = useMemo(
    () =>
      Boolean(
        episode.voiceTiming?.captions?.some(
          (c) => frame >= c.startFrame && frame < c.endFrame
        )
      ),
    [episode.voiceTiming?.captions, frame]
  );

  const fadeOpacity = useMemo(() => {
    if (!activeShot || activeShot.transition !== "fade") return 0;
    const elapsedInShot = frame - activeShot.startFrame;
    if (elapsedInShot >= 0 && elapsedInShot < 8) {
      return 1 - elapsedInShot / 8;
    }
    return 0;
  }, [activeShot, frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#020617" }}>
      {!audioOnly ? (
        <ThreeCanvas
          width={Math.round(width * qualityScale)}
          height={Math.round(height * qualityScale)}
          dpr={qualityScale < 1 ? 0.65 : 1}
          shadows={qualityScale >= 1}
          camera={{ position: [0, 2.2, 5.2], fov: 45 }}
        >
          <CameraController activeShot={activeShot} frame={frame} punchIn={punchIn} />
          {activeSet && <VoxelSetScene set={activeSet} frame={frame} fps={fps} />}

          {bible.characters.map((char, idx) => {
            const activeDirectedBeat = directedBeats.find((beat) => frame >= beat.startFrame && frame < beat.endFrame) ?? directedBeats[directedBeats.length - 1];
            const cue: DirectedBeat["characters"][number] | undefined = activeDirectedBeat?.characters.find((item) => item.character === char.name);
            const baseX = bible.characters.length === 1 ? 0 : (idx - (bible.characters.length - 1) / 2) * 1.6;
            const stagePosition = cue ? evaluateStagePosition(activeDirectedBeat, char.name, frame) : [baseX, 0, 0] as [number, number, number];
            const targetCue = cue?.lookAt && cue.lookAt !== "camera"
              ? activeDirectedBeat?.characters.find((item) => item.character === cue.lookAt)
              : undefined;
            const targetPosition = targetCue && activeDirectedBeat
              ? evaluateStagePosition(activeDirectedBeat, targetCue.character, frame)
              : undefined;
            const facingY = targetPosition
              ? (targetPosition[0] - stagePosition[0] < 0 ? -0.28 : 0.28)
              : idx === 0 ? 0.28 : -0.28;
            const isSpeaking =
              isAnyWordActive && activeLine?.speaker === char.name;
            const emotion =
              activeLine?.speaker === char.name
                ? activeLine.emotion
                : char.expression;

            return (
              <VoxelCharacter
                key={char.id}
                character={char}
                visualStyle={visualStyle}
                speaking={isSpeaking}
                emotion={emotion}
                action={cue ? (cue.moving && cue.startFrame <= frame && frame < cue.startFrame + Math.min(12, cue.endFrame - cue.startFrame) ? "walk" : cue.action) : "idle"}
                position={stagePosition}
                rotationY={cue?.lookAt === "camera" ? 0 : facingY}
                frame={frame}
                fps={fps}
              />
            );
          })}
        </ThreeCanvas>
      ) : (
        <AbsoluteFill
          style={{
            backgroundColor: "#09090B",
            alignItems: "center",
            justifyContent: "center",
            color: "#F4F4F5",
            padding: 64,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 38, fontWeight: 800, marginBottom: 16 }}>
            MODE REVIEW: HANYA SUARA
          </div>
          <div style={{ fontSize: 28, color: "#A1A1AA" }}>
            Visual disembunyikan untuk menguji apakah cerita tetap jelas lewat audio.
          </div>
        </AbsoluteFill>
      )}

      {/* Transisi Fade (hanya saat ganti lokasi/waktu) */}
      {fadeOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: "#000000",
            opacity: fadeOpacity,
            pointerEvents: "none",
          }}
        />
      )}

      {!audioOnly && <CartoonEffects frame={frame} cues={effectCues} />}

      {/* Caption kata-per-kata dalam safe area */}
      {showCaptions && !audioOnly && (
        <WordCaptions
          captions={episode.voiceTiming?.captions ?? []}
          frame={frame}
          style={episode.voiceTiming?.captionStyle}
          speaker={activeLine?.speaker}
        />
      )}

      {/* Safe Area Guide (khusus Preview) */}
      {showSafeArea && <SafeAreaGuide />}

      {/* Audio dialog + SFX + BGM dengan ducking -12 dB */}
      <EpisodeAudioLayer
        voiceTiming={episode.voiceTiming}
        audioFiles={episode.audioFiles}
        audioBaseUrl={audioBaseUrl}
        muted={muteAudio}
        includeSfx={includeSfx}
        actionCues={directedBeats.map((beat) => ({
          frame: beat.startFrame,
          action: beat.characters[0]?.action ?? "talk",
          sfx: beat.characters[0]?.sfx,
        }))}
        totalFrames={episode.totalFrames}
      />
    </AbsoluteFill>
  );
};
