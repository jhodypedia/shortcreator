"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { SetConfig } from "../../lib/schemas";

const LIGHTING_CONFIGS = {
  siang: {
    sky: "#38BDF8",
    fog: "#7DD3FC",
    ambientIntensity: 0.75,
    ambientColor: "#FFFFFF",
    sunIntensity: 1.5,
    sunColor: "#FFFBEB",
    sunPos: [8, 14, 8],
  },
  senja: {
    sky: "#FB923C",
    fog: "#7C2D12",
    ambientIntensity: 0.55,
    ambientColor: "#FDBA74",
    sunIntensity: 1.35,
    sunColor: "#F97316",
    sunPos: [-10, 6, -6],
  },
  malam: {
    sky: "#0F172A",
    fog: "#020617",
    ambientIntensity: 0.32,
    ambientColor: "#93C5FD",
    sunIntensity: 0.9,
    sunColor: "#60A5FA",
    sunPos: [-5, 12, -8],
  },
  horror: {
    sky: "#18181B",
    fog: "#09090B",
    ambientIntensity: 0.22,
    ambientColor: "#A855F7",
    sunIntensity: 0.85,
    sunColor: "#EF4444",
    sunPos: [4, 9, -7],
  },
} satisfies Record<SetConfig["lighting"], { sky: string; fog: string; ambientIntensity: number; ambientColor: string; sunIntensity: number; sunColor: string; sunPos: [number, number, number] }>;

function VoxelPropMesh({
  kind,
  position,
  rotationY = 0,
  scale = 1,
  color,
  frame,
  fps,
}: {
  kind: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  frame?: number;
  fps?: number;
}) {
  void kind;
  void frame;
  void fps;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.0, 1.0]} />
        <meshStandardMaterial color={color ?? "#64748B"} roughness={0.7} />
      </mesh>
    </group>
  );
}

export const VoxelSetScene: React.FC<{ set: SetConfig; frame?: number; fps?: number }> = ({ set, frame = 0, fps = 30 }) => {
  const light = LIGHTING_CONFIGS[set.lighting];
  const groundGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(40, 40, 20, 20);
    const colors: number[] = [];
    const greenA = new THREE.Color("#4D7C0F");
    const greenB = new THREE.Color("#65A30D");
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = Math.round(positions.getX(i));
      const z = Math.round(positions.getY(i));
      const color = ((x * 73856093) ^ (z * 19349663)) & 1 ? greenA : greenB;
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, []);

  const groundColor = set.palette[0] ?? "#64748B";

  return (
    <>
      <color attach="background" args={[light.sky]} />
      <fog attach="fog" args={[light.fog, 10, 32]} />

      <hemisphereLight args={[light.sky, groundColor, light.ambientIntensity]} />
      <directionalLight
        position={light.sunPos}
        intensity={light.sunIntensity}
        color={light.sunColor}
        castShadow
        shadow-mapSize-width={256}
        shadow-mapSize-height={256}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0002}
      />
      <pointLight position={[0, 3.5, 2]} intensity={0.45} color={set.palette[0] || "#FFFFFF"} />

      {/* Lantai utama */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <primitive object={groundGeometry} attach="geometry" />
          <meshStandardMaterial color="white" roughness={0.9} vertexColors />
      </mesh>

      {/* Grid voxel halus */}
      <gridHelper args={[24, 24, "#1E293B", "#334155"]} position={[0, 0.01, 0]} />

      {/* Backdrop renderer geometry. */}
      <mesh position={[0, 3, -6]} receiveShadow>
        <boxGeometry args={[18, 6, 0.8]} />
        <meshStandardMaterial color={groundColor} roughness={0.95} />
      </mesh>

      {/* Props dari Set Builder */}
      {set.props.map((prop) => (
        <VoxelPropMesh
          key={prop.id}
          kind={prop.kind}
          position={prop.position}
          rotationY={prop.rotationY ?? 0}
          scale={prop.scale ?? 1}
          color={prop.color}
          frame={frame}
          fps={fps}
        />
      ))}
    </>
  );
};
