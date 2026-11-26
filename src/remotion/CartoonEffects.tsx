import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { CharacterAction } from "../lib/animation/actions";

export interface EffectCue { frame: number; action: CharacterAction; prop?: string; sfx?: string }

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
  const coins = propText.includes("koin") || propText.includes("uang");
  const match = propText.includes("korek");
  const cake = propText.includes("kue") || propText.includes("lilin");
  const fallingY = Math.min(4, 0.5 * 9.8 * (local / 30) ** 2);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, transform: `translateX(${shake}px)`, zIndex: 25 }}>
      <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translateX(-50%)", fontSize: 70, fontWeight: 1000, color: "#FDE047", WebkitTextStroke: "3px #7C2D12", textShadow: "4px 5px #111", whiteSpace: "nowrap" }}>
      {showStars ? "✦ ✧ ✦" : active.action === "angry" ? "‼" : active.action === "slam_table" ? "💥" : ""}
      </div>
      {showDust && <div style={{ position: "absolute", left: "34%", top: "58%", fontSize: 60 }}>▰ ▱ ▰</div>}
      {active.action === "slam_table" && <div style={{ position: "absolute", left: "46%", top: "34%", fontSize: 72 }}>💢</div>}
      {active.action === "surprised" && <div style={{ position: "absolute", left: "54%", top: "27%", fontSize: 60, color: "#FACC15", fontWeight: 900 }}>!</div>}
      {active.action === "drop_item" && <div style={{ position: "absolute", left: "54%", top: `${43 + fallingY * 5}%`, fontSize: 54 }}>▣</div>}
      {calculator && <div style={{ position: "absolute", right: "19%", top: "43%", padding: "10px 16px", background: "#0F172A", border: "4px solid #CBD5E1", color: "#A3E635", fontSize: 35, fontWeight: 900 }}>{Math.max(0, 10 - Math.floor(local / 3))}</div>}
      {coins && <div style={{ position: "absolute", right: "28%", top: `${35 + Math.sin(local * 0.6) * 5}%`, fontSize: 48, transform: `rotate(${local * 18}deg)` }}>🪙 🪙</div>}
      {match && <div style={{ position: "absolute", left: "53%", top: "52%", fontSize: 50, filter: "drop-shadow(0 0 14px #F97316)" }}>🔥</div>}
      {cake && <div style={{ position: "absolute", right: "22%", top: "52%", fontSize: 62 }}>🎂 🕯️</div>}
      {activeCues.slice(1).map((cue, index) => (
        <div key={`${cue.frame}-${index}`} style={{ position: "absolute", left: `${18 + index * 15}%`, top: `${28 + index * 8}%`, fontSize: 52, color: "#FDE047", fontWeight: 1000 }}>
          {cue.action === "surprised" ? "✦ !" : cue.action === "slam_table" ? "💥" : cue.action === "walk" ? "▰ ▱" : "✧"}
        </div>
      ))}
    </AbsoluteFill>
  );
};
