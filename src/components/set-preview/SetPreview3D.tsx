"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CharacterConfig, SetConfig } from "@/lib/schemas";
import { VoxelSetScene } from "@/remotion/scenes/VoxelSetScene";
import { VoxelCharacter } from "@/remotion/characters/VoxelCharacter";

export function SetPreview3D({
  set,
  characters = [],
  visualStyle = "voxel-3d",
  height = 280,
  cameraPosition = [0, 3.4, 7.5],
  cameraTarget = [0, 1.2, 0],
  onCameraCaptured,
}: {
  set: SetConfig;
  characters?: CharacterConfig[];
  visualStyle?: "voxel-3d" | "cartoon-3d";
  height?: number;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  onCameraCaptured?: (pos: [number, number, number], target: [number, number, number]) => void;
}) {
  const controlsRef = React.useRef<{ target: { x: number; y: number; z: number } } | null>(null);
  const cameraRef = React.useRef<{ position: { x: number; y: number; z: number } } | null>(null);

  return (
    <div className="space-y-2">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-border bg-slate-950"
        style={{ height }}
      >
        <Canvas
          shadows
          camera={{ position: cameraPosition, fov: 46 }}
          onCreated={({ camera }) => {
            cameraRef.current = camera;
          }}
        >
          <Suspense fallback={null}>
            <VoxelSetScene set={set} />
            {characters.slice(0, 2).map((ch, idx) => (
              <VoxelCharacter
                key={ch.id}
                character={ch}
                visualStyle={visualStyle}
                position={[idx === 0 ? -0.9 : 0.9, 0, 0]}
                rotationY={idx === 0 ? 0.25 : -0.25}
              />
            ))}
          </Suspense>
          <OrbitControls
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={controlsRef as any}
            target={cameraTarget}
            enableZoom
            maxPolarAngle={Math.PI / 2 - 0.04}
          />
        </Canvas>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-zinc-200">
          {set.name} • {set.lighting}
        </div>
      </div>

      {onCameraCaptured && (
        <button
          type="button"
          onClick={() => {
            if (!cameraRef.current) return;
            const p = cameraRef.current.position;
            const t = controlsRef.current?.target ?? { x: 0, y: 1.2, z: 0 };
            onCameraCaptured(
              [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))],
              [Number(t.x.toFixed(2)), Number(t.y.toFixed(2)), Number(t.z.toFixed(2))]
            );
          }}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/85"
        >
          Pakai Kamera Ini
        </button>
      )}
    </div>
  );
}
