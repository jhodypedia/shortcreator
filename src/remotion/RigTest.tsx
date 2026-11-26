import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CharacterAction } from "../lib/animation/actions";
import { VoxelCharacter } from "./characters/VoxelCharacter";

const demos: Array<{ action: CharacterAction; label: string; emotion: string; speaking?: boolean }> = [
  { action: "point", label: "POINT" , emotion: "curiga" },
  { action: "wave", label: "WAVE", emotion: "senang" },
  { action: "nod", label: "NOD", emotion: "senang" },
  { action: "shake_head", label: "SHAKE_HEAD", emotion: "curiga" },
  { action: "surprised", label: "SURPRISED", emotion: "kaget" },
  { action: "laugh", label: "LAUGH", emotion: "senang", speaking: true },
  { action: "slam_table", label: "SLAM_TABLE", emotion: "marah" },
  { action: "drop_item", label: "DROP_ITEM", emotion: "kaget" },
  { action: "pick_up", label: "PICK_UP", emotion: "curiga" },
  { action: "hand_over", label: "HAND_OVER", emotion: "senang" },
  { action: "think", label: "THINK", emotion: "curiga" },
  { action: "angry", label: "ANGRY", emotion: "marah" },
  { action: "turn_to", label: "TURN_TO", emotion: "curiga" },
  { action: "idle", label: "IDLE", emotion: "sedih" },
  { action: "walk", label: "WALK", emotion: "netral" },
  { action: "talk", label: "TALK · LIP SYNC", emotion: "senang", speaking: true },
];
const SEGMENT_FRAMES = 18;

export const RigTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const segmentIndex = Math.min(demos.length - 1, Math.floor(frame / SEGMENT_FRAMES));
  const segment = demos[segmentIndex];
  const localFrame = frame - segmentIndex * SEGMENT_FRAMES;
  const previous = demos[Math.max(0, segmentIndex - 1)].action;
  const walkIn = interpolate(frame, [0, 25], [-1.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pos: [number, number, number] = [frame < 25 ? walkIn : 0, 0, 0];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a" }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 1.25, 5], fov: 42 }}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 4]} intensity={2} castShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[12, 12]} /><meshStandardMaterial color="#334155" />
        </mesh>
        <VoxelCharacter
          character={{ id: "rigtest-raka", name: "Raka", colorPrimary: "#2563EB", colorSkin: "#F5C6A5", colorHair: "#111827", accessory: "peci" }}
          frame={localFrame} fps={fps} position={pos} action={segment.action}
          previousAction={previous} transitionStartFrame={0}
          speaking={Boolean(segment.speaking)} emotion={segment.emotion}
        />
      </ThreeCanvas>
      <div style={{ position: "absolute", top: 70, width: "100%", textAlign: "center", color: "white", fontSize: 54, fontFamily: "sans-serif", fontWeight: 800 }}>
        RIG TEST · {segment.label}
      </div>
      <div style={{ position: "absolute", top: 142, width: "100%", textAlign: "center", color: "#94a3b8", fontSize: 27, fontFamily: "sans-serif" }}>
        ACTION {segmentIndex + 1}/{demos.length} · {frame}/300
      </div>
      {segment.speaking && <div style={{ position: "absolute", bottom: 170, width: "100%", textAlign: "center", color: "#FDE68A", fontSize: 42, fontFamily: "sans-serif" }}>Halo! Aku Raka.</div>}
    </AbsoluteFill>
  );
};
