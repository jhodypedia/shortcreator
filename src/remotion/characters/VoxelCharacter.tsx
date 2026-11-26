import React from "react";
import { CharacterAction, JointPose, actionPose, blendedActionPose } from "../../lib/animation/actions";

export interface VoxelCharacterProps {
  character?: { id?: string; name?: string; colorPrimary?: string; colorSkin?: string; colorHair?: string; colorPants?: string; accessory?: string; proportions?: { headScale?: number } };
  visualStyle?: "voxel-3d" | "cartoon-3d";
  isSpeaking?: boolean;
  emotion?: "senang" | "kaget" | "marah" | "sedih" | "curiga" | string;
  rotationY?: number;
  shirtColor?: string;
  skinColor?: string;
  accessory?: "peci" | "topi" | "rambut" | "none";
  action?: CharacterAction;
  previousAction?: CharacterAction;
  transitionStartFrame?: number;
  frame?: number;
  fps?: number;
  position?: [number, number, number];
  speaking?: boolean;
  lookDirection?: number;
  prop?: string;
  propAction?: CharacterAction;
  propFrame?: number;
}

function seededHash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

const HeldProp: React.FC<{ prop: string; position: [number, number, number]; frame: number }> = ({ prop, position, frame }) => {
  const key = prop.toLowerCase();
  const color = key.includes("kalku") ? "#FACC15" : key.includes("koin") || key.includes("uang") ? "#F59E0B" : key.includes("kue") ? "#F472B6" : "#EF4444";
  return <group position={position} rotation={[0, 0, Math.sin(frame * 0.08) * 0.04]}>
    <mesh castShadow><boxGeometry args={key.includes("kalku") ? [0.26, 0.38, 0.08] : key.includes("korek") ? [0.28, 0.18, 0.16] : key.includes("kue") ? [0.3, 0.22, 0.26] : [0.2, 0.2, 0.12]} /><meshStandardMaterial color={color} /></mesh>
    {key.includes("kalku") && <>
      <mesh position={[0, 0.08, 0.045]}><boxGeometry args={[0.19, 0.1, 0.015]} /><meshStandardMaterial color="#0F172A" /></mesh>
      <mesh position={[0, 0.08, 0.055]}><boxGeometry args={[0.14, 0.045, 0.01]} /><meshBasicMaterial color="#A3E635" /></mesh>
      {[0.12, 0, -0.1].map((y) => <mesh key={y} position={[0, y - 0.12, 0.05]}><boxGeometry args={[0.19, 0.025, 0.015]} /><meshStandardMaterial color="#78350F" /></mesh>)}
    </>}
    {key.includes("kue") && <mesh position={[0, 0.22, 0]}><boxGeometry args={[0.045, 0.2, 0.045]} /><meshStandardMaterial color="#FDE68A" emissive="#F59E0B" emissiveIntensity={0.8} /></mesh>}
  </group>;
};

export const VoxelCharacter: React.FC<VoxelCharacterProps> = ({
  character, shirtColor, skinColor, accessory, action, previousAction,
  transitionStartFrame, frame, fps, position = [0, 0, 0], speaking = false, isSpeaking = false, rotationY = 0, emotion = "netral", lookDirection = 0, prop, propAction, propFrame = 0,
}) => {
  const atFrame = frame ?? 0;
  const frameRate = fps ?? 30;
  const resolvedAction = action ?? (speaking || isSpeaking ? "talk" : "idle");
  const pose = previousAction && transitionStartFrame !== undefined
    ? blendedActionPose(resolvedAction, atFrame, frameRate, previousAction, transitionStartFrame)
    : actionPose(resolvedAction, atFrame, frameRate);
  const id = character?.id ?? character?.name ?? "voxel-character";
  const actionStart = transitionStartFrame ?? 0;
  const name = character?.name?.toLowerCase() ?? "";
  const top = accessory ?? (character?.accessory === "topi" || character?.accessory === "peci" ? character.accessory : "rambut");
  const hairColor = character?.colorHair ?? "#27272A";
  const shirt = shirtColor ?? character?.colorPrimary ?? "#2563EB";
  const hatColor = name.includes("blokir") ? "#166534" : name.includes("cubi") ? "#3B82F6" : hairColor;
  const dominantShirt = name.includes("blokir") ? "#92400E" : name.includes("bu pixel") ? "#EC4899" : name.includes("tuan creeper") ? "#22C55E" : shirt;
  const headSize = 0.52 * (character?.proportions?.headScale ?? 1.3);
  const skin = skinColor ?? character?.colorSkin ?? "#F5C6A5";
  const phase = seededHash(id) % 120;
  const blinkPeriod = 60 + (seededHash(`${id}:blink`) % 61);
  const blinkAt = (phase + Math.floor(atFrame)) % blinkPeriod;
  const blinking = blinkAt < 3;
  const isTalking = speaking || isSpeaking;
  const localFrame = Math.max(0, atFrame - actionStart);
  const lipPhase = (Math.floor(localFrame) + (seededHash(`${id}:lip`) % 4)) % 4;
  const mouthOpen = isTalking && lipPhase < 2;
  const smile = emotion === "senang";
  const surprised = emotion === "kaget";
  const angry = emotion === "marah";
  const sad = emotion === "sedih";
  const suspicious = emotion === "curiga";
  const browTilt = angry ? 0.28 : sad ? -0.24 : suspicious ? 0.22 : surprised ? -0.08 : smile ? -0.06 : 0;
  const mouthWidth = smile ? 0.16 : surprised ? 0.075 : angry ? 0.14 : sad ? 0.13 : suspicious ? 0.12 : 0.13;
  const mouthScale = mouthOpen ? 1.7 : (surprised ? 1.35 : 0.45);
  const stretch = 1 + pose.bounce * 0.28 - pose.squash;
  const squashScale = [1 + pose.squash * 0.4, stretch, 1 - pose.squash * 0.2] as [number, number, number];
  const rotation = (p: JointPose["hips"]) => p;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* root → hips → torso/head; shoulder and hip pivots articulate each limb */}
      <group name="root" position={[0, pose.bounce, 0]} scale={squashScale}>
        <group name="hips" position={[0, 0.72, 0]} rotation={rotation(pose.hips)}>
          <mesh position={[0, -0.16, 0]} castShadow><boxGeometry args={[0.48, 0.32, 0.3]} /><meshStandardMaterial color={character?.colorPants ?? "#334155"} /></mesh>
          <group name="legL" position={[-0.14, -0.24, 0]} rotation={rotation(pose.legL)}>
            <mesh position={[0, -0.28, 0]} castShadow><boxGeometry args={[0.2, 0.56, 0.24]} /><meshStandardMaterial color={character?.colorPants ?? "#1E293B"} /></mesh>
          </group>
          <group name="legR" position={[0.14, -0.24, 0]} rotation={rotation(pose.legR)}>
            <mesh position={[0, -0.28, 0]} castShadow><boxGeometry args={[0.2, 0.56, 0.24]} /><meshStandardMaterial color={character?.colorPants ?? "#1E293B"} /></mesh>
          </group>
          <group name="torso" position={[0, 0.4, 0]} rotation={rotation(pose.torso)}>
            <mesh castShadow><boxGeometry args={[name.includes("blokir") ? 0.76 : 0.58, 0.72, 0.34]} /><meshStandardMaterial color={dominantShirt} /></mesh>
            <group name="armL" position={[-0.36, 0.27, 0]} rotation={rotation(pose.armL)}>
              <mesh position={[0, -0.23, 0]} castShadow><boxGeometry args={[0.19, 0.5, 0.22]} /><meshStandardMaterial color={dominantShirt} /></mesh>
              <mesh position={[0, -0.51, 0]} castShadow><boxGeometry args={[0.17, 0.14, 0.19]} /><meshStandardMaterial color={skin} /></mesh>
            </group>
            <group name="armR" position={[0.36, 0.27, 0]} rotation={rotation(pose.armR)}>
              <mesh position={[0, -0.23, 0]} castShadow><boxGeometry args={[0.19, 0.5, 0.22]} /><meshStandardMaterial color={dominantShirt} /></mesh>
              <mesh position={[0, -0.51, 0]} castShadow><boxGeometry args={[0.17, 0.14, 0.19]} /><meshStandardMaterial color={skin} /></mesh>
            </group>
            {prop && propAction !== "drop_item" && <HeldProp prop={prop} position={propAction === "pick_up" ? [0.42, -0.2, 0.02] : [0.42, -0.55, 0.02]} frame={propFrame} />}
            <group name="head" position={[0, 0.58, 0]} rotation={[pose.head[0], pose.head[1] + lookDirection * 0.04, pose.head[2]]}>
              <mesh castShadow><boxGeometry args={[headSize, headSize, headSize * 0.92]} /><meshStandardMaterial color={skin} /></mesh>
              {top !== "none" && (name.includes("pixel") ? <>
                {[-0.22, 0, 0.22].map((x, index) => <mesh key={x} position={[x, 0.36 + (index === 1 ? 0.1 : 0), 0]} castShadow><boxGeometry args={[0.2, 0.32 + (index === 1 ? 0.2 : 0), 0.48]} /><meshStandardMaterial color={hairColor || "#EC4899"} /></mesh>)}
              </> : <mesh position={[0, 0.3, 0]} castShadow>
                <boxGeometry args={top === "peci" ? [0.5, 0.13, 0.47] : name.includes("cubi") ? [0.6, 0.22, 0.58] : [0.57, 0.18, 0.53]} />
                <meshStandardMaterial color={top === "peci" ? hatColor : name.includes("cubi") ? "#3B82F6" : hairColor} />
              </mesh>)}
              {name.includes("blokir") && <mesh position={[-0.39, -0.56, 0.02]} rotation={[0, 0, -0.12]}><boxGeometry args={[0.2, 0.24, 0.12]} /><meshStandardMaterial color="#FACC15" /></mesh>}
              {name.includes("creeper") && <>
                <mesh position={[-0.12, 0.02, headSize * 0.51]}><boxGeometry args={[0.09, 0.12, 0.035]} /><meshStandardMaterial color="#14532D" /></mesh>
                <mesh position={[0.12, 0.02, headSize * 0.51]}><boxGeometry args={[0.09, 0.12, 0.035]} /><meshStandardMaterial color="#14532D" /></mesh>
                <mesh position={[0, -0.14, headSize * 0.51]}><boxGeometry args={[0.16, 0.09, 0.035]} /><meshStandardMaterial color="#14532D" /></mesh>
              </>}
              {([-0.12, 0.12] as const).map((x, index) => <React.Fragment key={x}>
                <mesh position={[x, 0.04, headSize * 0.47]} scale={[1, blinking ? 0.08 : (surprised ? 1.18 : 1), 1]}>
                <boxGeometry args={[0.11, 0.12, 0.035]} /><meshStandardMaterial color="white" />
                </mesh>
                <mesh position={[x + lookDirection * 0.025, 0.04, headSize * 0.5 + 0.025]}>
                  <boxGeometry args={[0.055, 0.07, 0.025]} /><meshStandardMaterial color="#111827" />
                </mesh>
                <mesh position={[x, 0.15 + (sad ? -0.025 : suspicious ? 0.015 : 0), headSize * 0.47]} rotation={[0, 0, (index === 0 ? 1 : -1) * browTilt]}>
                  <boxGeometry args={[0.14, 0.04, 0.035]} /><meshStandardMaterial color={hairColor} />
                </mesh>
              </React.Fragment>)}
              <mesh position={[0, -0.13, headSize * 0.5]} scale={[1, mouthScale, 1]} rotation={[0, 0, sad ? Math.PI : 0]}>
                <boxGeometry args={[mouthWidth, 0.035, 0.025]} /><meshStandardMaterial color={smile ? "#991B1B" : "#7F1D1D"} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
