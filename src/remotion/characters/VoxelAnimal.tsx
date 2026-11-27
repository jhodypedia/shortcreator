import React from "react";
import { CharacterAction } from "../../lib/animation/actions";

export const VoxelAnimal: React.FC<{
  character: { colorPrimary?: string; name?: string };
  position: [number, number, number];
  frame: number;
  fps: number;
  action: CharacterAction;
}> = ({ character, position, frame, fps, action }) => {
  const phase = (frame / Math.max(1, fps)) * Math.PI * 5;
  const walking = action === "walk";
  const step = walking ? Math.sin(phase) * 0.38 : 0;
  const grazing = action === "idle" ? Math.sin(phase * 0.25) * 0.04 : 0;
  const wool = character.colorPrimary ?? "#E5E7EB";
  return <group position={position}>
    <mesh position={[0, 0.72 + (walking ? Math.abs(Math.sin(phase)) * 0.04 : 0), 0]} castShadow><boxGeometry args={[0.9, 0.62, 0.48]} /><meshStandardMaterial color={wool} /></mesh>
    <group position={[0.45, 0.95 + grazing, 0.03]}>
      <mesh castShadow><boxGeometry args={[0.44, 0.4, 0.4]} /><meshStandardMaterial color={wool} /></mesh>
      <mesh position={[0.17, 0.15, 0.05]} rotation={[0, 0, -0.6]}><boxGeometry args={[0.12, 0.24, 0.12]} /><meshStandardMaterial color="#D6D3D1" /></mesh>
      <mesh position={[-0.17, 0.15, 0.05]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.12, 0.24, 0.12]} /><meshStandardMaterial color="#D6D3D1" /></mesh>
      <mesh position={[0.08, 0.03, 0.21]}><boxGeometry args={[0.06, 0.06, 0.035]} /><meshStandardMaterial color="#111827" /></mesh>
      <mesh position={[0.26, -0.12, 0.11]}><boxGeometry args={[0.22, 0.12, 0.18]} /><meshStandardMaterial color="#F0AB9A" /></mesh>
    </group>
    {[-0.28, 0.28].map((x) => [-0.15, 0.15].map((z, index) => <group key={`${x}-${z}`} position={[x, 0.48, z]} rotation={[step * (index === 0 ? 1 : -1), 0, 0]}>
      <mesh position={[0, -0.23, 0]} castShadow><boxGeometry args={[0.15, 0.48, 0.15]} /><meshStandardMaterial color="#A8A29E" /></mesh>
    </group>))}
    <group position={[-0.5, 0.85, -0.08]} rotation={[0, 0, Math.sin(phase * 0.35) * 0.22]}><mesh position={[-0.1, -0.13, 0]}><boxGeometry args={[0.2, 0.28, 0.15]} /><meshStandardMaterial color={wool} /></mesh></group>
  </group>;
};
