import React from "react";
import { Composition } from "remotion";
import { ShortComposition, ShortCompositionProps } from "./ShortComposition";
import { createDefaultBible } from "../lib/bible";
import { RigTest } from "./RigTest";

const defaultBible = createDefaultBible({
  name: "Preview Series",
  theme: "Voxel Adventure",
  tone: "lucu",
  visualStyle: "voxel-3d",
});

const defaultProps: ShortCompositionProps = {
  episode: {
    id: "preview",
    number: 1,
    title: "Preview",
    hook: "Lihat apa yang baru ditemukan!",
    script: {
      lines: [
        {
          id: "l1",
          beat: "hook",
          speaker: defaultBible.characters[0].name,
          text: "Lihat apa yang baru ditemukan!",
          emotion: "kaget",
          durationSec: 2.5,
        },
      ],
    },
    voiceTiming: {
      fps: 30,
      captions: [
        { word: "Lihat", lineId: "l1", speaker: "Raka", startFrame: 0, endFrame: 15 },
        { word: "apa", lineId: "l1", speaker: "Raka", startFrame: 15, endFrame: 30 },
        { word: "yang", lineId: "l1", speaker: "Raka", startFrame: 30, endFrame: 45 },
        { word: "ditemukan!", lineId: "l1", speaker: "Raka", startFrame: 45, endFrame: 75 },
      ],
      pauses: [],
      sfxMarkers: [],
      captionStyle: {
        fontFamily: "Inter",
        fontSize: 56,
        activeColor: "#FACC15",
        textColor: "#FFFFFF",
        bgColor: "rgba(0,0,0,0.68)",
        position: "tengah-bawah",
      },
      lineTimings: [{ lineId: "l1", startFrame: 0, endFrame: 75, durationSec: 2.5 }],
    },
    shots: {
      shots: [
        {
          shot: "dolly-in",
          startFrame: 0,
          endFrame: 75,
          camera: { position: [0, 1.9, 4.5], lookAt: [0, 1.5, 0], fov: 42 },
          transition: "cut",
          note: "Hook",
        },
      ],
    },
    totalFrames: 75,
  },
  bible: defaultBible,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Short"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={ShortComposition as React.ComponentType<any>}
        durationInFrames={75}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const typed = props as unknown as ShortCompositionProps;
          const totalFrames = Math.max(
            30,
            typed?.episode?.totalFrames ??
              (typed?.episode?.voiceTiming?.captions?.slice(-1)[0]?.endFrame || 150)
          );
          return {
            durationInFrames: totalFrames,
            fps: typed?.episode?.voiceTiming?.fps ?? 30,
            width: 1080,
            height: 1920,
          };
        }}
      />
      <Composition
        id="RigTest"
        component={RigTest}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
