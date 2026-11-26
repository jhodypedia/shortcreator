"use client";

import React from "react";
import { SetConfig } from "../../lib/schemas";

const LIGHTING_CONFIGS: Record<
  SetConfig["lighting"],
  {
    sky: string;
    fog: string;
    ambientIntensity: number;
    ambientColor: string;
    sunIntensity: number;
    sunColor: string;
    sunPos: [number, number, number];
  }
> = {
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
};

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
  frame: number;
  fps: number;
}) {
  const lower = kind.toLowerCase();

  if (lower.includes("pohon")) {
    return (
      <group position={position} rotation={[0, rotationY, Math.sin(frame / Math.max(1, fps) * 1.2 + position[0]) * 0.035]} scale={[scale, scale, scale]}>
        <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.55, 2.0, 0.55]} />
          <meshStandardMaterial color="#78350F" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.4, 0]} castShadow>
          <boxGeometry args={[1.9, 1.3, 1.9]} />
          <meshStandardMaterial color={color || "#22C55E"} roughness={0.75} />
        </mesh>
        <mesh position={[0, 3.3, 0]} castShadow>
          <boxGeometry args={[1.2, 0.8, 1.2]} />
          <meshStandardMaterial color={color || "#16A34A"} roughness={0.75} />
        </mesh>
      </group>
    );
  }

  if (lower.includes("rumah") || lower.includes("balai")) {
    return (
      <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
        <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 2.5, 2.6]} />
          <meshStandardMaterial color={color || "#E2E8F0"} roughness={0.8} />
        </mesh>
        <mesh position={[0, 2.8, 0]} castShadow>
          <boxGeometry args={[3.2, 0.7, 3.0]} />
          <meshStandardMaterial color="#B45309" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.75, 1.32]}>
          <boxGeometry args={[0.7, 1.5, 0.08]} />
          <meshStandardMaterial color="#451A03" />
        </mesh>
      </group>
    );
  }

  if (lower.includes("portal")) {
    return (
      <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
        <mesh position={[-1.0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.45, 3.0, 0.55]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        <mesh position={[1.0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.45, 3.0, 0.55]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        <mesh position={[0, 2.8, 0]} castShadow>
          <boxGeometry args={[2.45, 0.45, 0.55]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[1.55, 2.35, 0.16]} />
          <meshStandardMaterial
            color={color || "#A855F7"}
            emissive={color || "#9333EA"}
            emissiveIntensity={1.4}
            transparent
            opacity={0.82}
          />
        </mesh>
      </group>
    );
  }

  if (lower.includes("kristal")) {
    return (
      <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
        <mesh position={[0, 0.85, 0]} rotation={[0.1, 0.3, 0.15]} castShadow>
          <boxGeometry args={[0.6, 1.7, 0.6]} />
          <meshStandardMaterial
            color={color || "#06B6D4"}
            emissive={color || "#0891B2"}
            emissiveIntensity={0.9}
          />
        </mesh>
        <mesh position={[0.45, 0.5, 0.25]} rotation={[-0.2, 0, -0.2]} castShadow>
          <boxGeometry args={[0.4, 1.0, 0.4]} />
          <meshStandardMaterial
            color={color || "#22D3EE"}
            emissive={color || "#06B6D4"}
            emissiveIntensity={0.7}
          />
        </mesh>
      </group>
    );
  }

  if (lower.includes("meja")) {
    return (
      <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
        <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.18, 1.0]} />
          <meshStandardMaterial color={color || "#92400E"} />
        </mesh>
        <mesh position={[-0.65, 0.38, -0.35]} castShadow>
          <boxGeometry args={[0.16, 0.76, 0.16]} />
          <meshStandardMaterial color="#78350F" />
        </mesh>
        <mesh position={[0.65, 0.38, -0.35]} castShadow>
          <boxGeometry args={[0.16, 0.76, 0.16]} />
          <meshStandardMaterial color="#78350F" />
        </mesh>
        <mesh position={[-0.65, 0.38, 0.35]} castShadow>
          <boxGeometry args={[0.16, 0.76, 0.16]} />
          <meshStandardMaterial color="#78350F" />
        </mesh>
        <mesh position={[0.65, 0.38, 0.35]} castShadow>
          <boxGeometry args={[0.16, 0.76, 0.16]} />
          <meshStandardMaterial color="#78350F" />
        </mesh>
      </group>
    );
  }

  // Default voxel block / batu / lampu
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.0, 1.0]} />
        <meshStandardMaterial color={color || "#64748B"} roughness={0.7} />
      </mesh>
    </group>
  );
}

export const VoxelSetScene: React.FC<{ set: SetConfig; frame?: number; fps?: number }> = ({ set, frame = 0, fps = 30 }) => {
  const light = LIGHTING_CONFIGS[set.lighting] ?? LIGHTING_CONFIGS.siang;

  const groundColor =
    set.template === "gua"
      ? "#1E293B"
      : set.template === "pantai"
        ? "#FDE68A"
        : set.template === "arena"
          ? "#475569"
          : set.template === "rumah"
            ? "#78350F"
            : "#4D7C0F";

  return (
    <>
      <color attach="background" args={[light.sky]} />
      <fog attach="fog" args={[light.fog, 10, 32]} />

      <ambientLight intensity={light.ambientIntensity} color={light.ambientColor} />
      <directionalLight
        position={light.sunPos}
        intensity={light.sunIntensity}
        color={light.sunColor}
        castShadow
      />
      <pointLight position={[0, 3.5, 2]} intensity={0.45} color={set.palette[0] || "#FFFFFF"} />

      <group position={[Math.sin(frame / Math.max(1, fps) * 0.08) * 0.9, 5.8 + Math.sin(frame / Math.max(1, fps) * 0.11) * 0.08, -8]}>
        <mesh><boxGeometry args={[1.7, 0.45, 0.7]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.5} /></mesh>
        <mesh position={[-0.42, -0.1, 0]}><boxGeometry args={[0.75, 0.3, 0.68]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.5} /></mesh>
        <mesh position={[0.4, -0.08, 0]}><boxGeometry args={[0.85, 0.34, 0.7]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.5} /></mesh>
      </group>
      <mesh position={[Math.sin(frame / Math.max(1, fps) * 0.025) * 3.2, 5.2, -9]}>
        <boxGeometry args={[1.05, 1.05, 0.15]} /><meshBasicMaterial color="#FDE047" />
      </mesh>

      {/* Lantai utama */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={groundColor} roughness={0.9} />
      </mesh>

      {/* Grid voxel halus */}
      <gridHelper args={[24, 24, "#1E293B", "#334155"]} position={[0, 0.01, 0]} />

      {/* Dinding backdrop gua/rumah bila template gua atau rumah */}
      {(set.template === "gua" || set.template === "rumah") && (
        <mesh position={[0, 3, -6]} receiveShadow>
          <boxGeometry args={[18, 6, 0.8]} />
          <meshStandardMaterial
            color={set.template === "gua" ? "#0F172A" : "#B45309"}
            roughness={0.95}
          />
        </mesh>
      )}

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
