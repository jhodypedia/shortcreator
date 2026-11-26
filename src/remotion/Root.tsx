import React from "react";
import { Composition } from "remotion";
import { ShortComposition, ShortCompositionProps } from "./ShortComposition";
import { RigTest } from "./RigTest";

const defaultProps = {} as ShortCompositionProps;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Short"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={ShortComposition as React.ComponentType<any>}
        durationInFrames={150}
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
