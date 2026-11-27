"use client";

import React, { Suspense, useState } from "react";
import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CharacterConfig } from "@/lib/schemas";
import { VoxelCharacter } from "@/remotion/characters/VoxelCharacter";

export function CharacterPreview3D({
  character,
  visualStyle = "voxel-3d",
  height = 240,
  autoSpeak = false,
}: {
  character: CharacterConfig;
  visualStyle?: "voxel-3d" | "cartoon-3d";
  height?: number;
  autoSpeak?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [active, setActive] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!autoSpeak || !active || document.hidden) return;
    const id = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(id);
  }, [autoSpeak, active]);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={root}
      className="relative w-full overflow-hidden rounded-lg border border-border bg-slate-950"
      style={{ height }}
    >
      {active ? <Canvas frameloop="demand" shadows camera={{ position: [0, 1.5, 3.2], fov: 42 }}>
        <color attach="background" args={["#09090b"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 7, 5]} intensity={1.4} castShadow />
        <Suspense fallback={null}>
          <VoxelCharacter
            character={character}
            visualStyle={visualStyle}
            isSpeaking={autoSpeak}
            emotion={character.expression}
            position={[0, -0.95, 0]}
            frame={tick * 2}
            fps={30}
          />
          <gridHelper args={[6, 12, "#27272a", "#18181b"]} position={[0, -0.95, 0]} />
        </Suspense>
        <OrbitControls enableZoom={true} enablePan={false} minDistance={2} maxDistance={6} />
      </Canvas> : <div className="grid h-full place-items-center text-sm text-muted-foreground">Pratinjau 3D aktif saat terlihat</div>}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-zinc-300">
        Putar 360° (geser)
      </div>
    </div>
  );
}
