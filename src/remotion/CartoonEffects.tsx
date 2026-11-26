import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { CharacterAction } from "../lib/animation/actions";

export interface EffectCue { frame: number; action: CharacterAction; prop?: string; sfx?: string; position?: [number, number, number] }

export const CartoonEffects: React.FC<{ frame: number; cues: EffectCue[] }> = ({ frame, cues }) => {
  const activeCues = cues.filter((cue) => frame >= cue.frame && frame < cue.frame + 18);
  if (!activeCues.length) return null;
  const active = activeCues[0];
  const local = frame - active.frame;
  const opacity = interpolate(local, [0, 3, 12, 18], [0, 1, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = active.action === "slam_table" ? Math.sin(local * 3) * (1 - local / 18) * 10 : 0;
  const showStars = active.action === "surprised" || active.action === "drop_item";
  const showDust = active.action === "walk";
  const propText = active.prop?.toLowerCase() ?? "";
  const calculator = propText.includes("kalkulator") || propText.includes("kalku");

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, transform: `translateX(${shake}px)`, zIndex: 25 }}>
      <div style={{ position: "absolute", top: "24%", left: `${Math.max(15, Math.min(85, 50 + (active.position?.[0] ?? 0) * 8))}%`, transform: "translateX(-50%)", fontSize: 70, fontWeight: 1000, color: "#FDE047", WebkitTextStroke: "3px #7C2D12", textShadow: "4px 5px #111", whiteSpace: "nowrap" }}>
      {showStars ? "✦ ✧ ✦" : active.action === "angry" ? "‼" : active.action === "slam_table" ? "💥" : ""}
      </div>
      {showDust && <div style={{ position: "absolute", left: `${Math.max(15, Math.min(85, 50 + (active.position?.[0] ?? 0) * 8))}%`, top: "58%", fontSize: 60 }}>▰ ▱ ▰</div>}
      {active.action === "slam_table" && <div style={{ position: "absolute", left: `${Math.max(15, Math.min(85, 50 + (active.position?.[0] ?? 0) * 8))}%`, top: "34%", fontSize: 72 }}>💢</div>}
      {active.action === "surprised" && <div style={{ position: "absolute", left: `${Math.max(15, Math.min(85, 50 + (active.position?.[0] ?? 0) * 8 + 4))}%`, top: "27%", fontSize: 60, color: "#FACC15", fontWeight: 900 }}>!</div>}
      {calculator && <div style={{ position: "absolute", left: `${Math.max(12, Math.min(84, 50 + (active.position?.[0] ?? 0) * 8))}%`, top: "43%", padding: "10px 16px", background: "#0F172A", border: "4px solid #CBD5E1", color: "#A3E635", fontSize: 35, fontWeight: 900 }}>{Math.max(0, 10 - Math.floor(local / 3))}</div>}
      {activeCues.slice(1).map((cue, index) => (
        <div key={`${cue.frame}-${index}`} style={{ position: "absolute", left: `${18 + index * 15}%`, top: `${28 + index * 8}%`, fontSize: 52, color: "#FDE047", fontWeight: 1000 }}>
          {cue.action === "surprised" ? "✦ !" : cue.action === "slam_table" ? "💥" : cue.action === "walk" ? "▰ ▱" : "✧"}
        </div>
      ))}
    </AbsoluteFill>
  );
};
