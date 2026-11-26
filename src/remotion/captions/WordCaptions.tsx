import React from "react";
import { interpolate } from "remotion";
import { CaptionStyleSchema, WordCaption } from "../../lib/schemas";
import { z } from "zod";

type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

export const SafeAreaGuide: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      {/* Top 250px UI zone */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 250,
          backgroundColor: "rgba(239, 68, 68, 0.14)",
          borderBottom: "2px dashed rgba(239, 68, 68, 0.8)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 10,
          color: "#FCA5A5",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        AREA UI ATAS (HINDARI TEKS)
      </div>

      {/* Safe Area Box 1080x1420 tengah */}
      <div
        style={{
          position: "absolute",
          top: 250,
          bottom: 250,
          left: 24,
          right: 24,
          border: "2px dashed rgba(34, 197, 94, 0.85)",
          borderRadius: 16,
        }}
      />

      {/* Bottom 250px UI zone */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 250,
          backgroundColor: "rgba(239, 68, 68, 0.14)",
          borderTop: "2px dashed rgba(239, 68, 68, 0.8)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 10,
          color: "#FCA5A5",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        AREA UI SHORTS BAWAH (HINDARI TEKS)
      </div>
    </div>
  );
};

export const WordCaptions: React.FC<{
  captions: WordCaption[];
  frame: number;
  style?: Partial<CaptionStyle>;
  speaker?: string;
}> = ({ captions, frame, style, speaker }) => {
  if (!captions || captions.length === 0) return null;

  const activeIdx = captions.findIndex(
    (c) => frame >= c.startFrame && frame < c.endFrame
  );

  // Jika sedang jeda singkat, cari caption terdekat di sekitar frame (±10 frame)
  const fallbackIdx =
    activeIdx !== -1
      ? activeIdx
      : captions.findIndex(
          (c) => Math.abs(frame - c.startFrame) <= 8 && frame >= c.startFrame - 4
        );

  if (fallbackIdx === -1) return null;

  // Kelompokkan 3-4 kata per baris agar selalu padat & terbaca di HP
  const chunkSize = 4;
  const chunkStart = Math.floor(fallbackIdx / chunkSize) * chunkSize;
  const visibleWords = captions.slice(chunkStart, chunkStart + chunkSize);

  const fontSize = style?.fontSize ?? 56;
  const activeColor = style?.activeColor ?? "#FACC15";
  const textColor = style?.textColor ?? "#FFFFFF";
  const bgColor = style?.bgColor ?? "rgba(0, 0, 0, 0.68)";
  const position = style?.position ?? "tengah-bawah";

  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        bottom: position === "tengah" ? "44%" : 320,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        pointerEvents: "none",
        zIndex: 30,
      }}
    >
      {(captions[fallbackIdx]?.speaker || speaker) && (
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            color: "#E2E8F0",
            padding: "6px 18px",
            borderRadius: 999,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          {captions[fallbackIdx]?.speaker || speaker}
        </div>
      )}

      <div
        style={{
          backgroundColor: bgColor,
          padding: "16px 28px",
          borderRadius: 20,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px 16px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          border: "2px solid rgba(255,255,255,0.12)",
        }}
      >
        {visibleWords.map((item, idx) => {
          const globalIdx = chunkStart + idx;
          const isCurrent = globalIdx === fallbackIdx;
          return (
            <span
              key={`${globalIdx}-${item.word}`}
              style={{
                fontFamily: style?.fontFamily || "Inter, sans-serif",
                fontSize,
                fontWeight: 900,
                lineHeight: 1.15,
                color: isCurrent ? activeColor : textColor,
                transform: `scale(${interpolate(frame, [item.startFrame, item.startFrame + 4], [0.68, isCurrent ? 1.12 : 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}) translateY(${interpolate(frame, [item.startFrame, item.startFrame + 4], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
                opacity: interpolate(frame, [item.startFrame, item.startFrame + 2], [0.35, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                WebkitTextStroke: "1px #000",
                textShadow:
                  "0 4px 0 #000000, -2px -2px 0 #000000, 2px -2px 0 #000000, -2px 2px 0 #000000",
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
