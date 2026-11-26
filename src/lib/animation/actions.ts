export type CharacterAction =
  | "idle" | "walk" | "talk" | "point" | "wave" | "nod" | "shake_head"
  | "surprised" | "laugh" | "slam_table" | "drop_item" | "pick_up"
  | "hand_over" | "think" | "angry" | "turn_to";

export interface JointPose {
  hips: [number, number, number];
  torso: [number, number, number];
  head: [number, number, number];
  armL: [number, number, number];
  armR: [number, number, number];
  legL: [number, number, number];
  legR: [number, number, number];
  bounce: number;
  squash: number;
}

const zero = (): JointPose => ({
  hips: [0, 0, 0], torso: [0, 0, 0], head: [0, 0, 0],
  armL: [0, 0, 0], armR: [0, 0, 0], legL: [0, 0, 0], legR: [0, 0, 0],
  bounce: 0, squash: 0,
});

const smooth = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };

export function actionPose(action: CharacterAction, frame: number, fps: number): JointPose {
  const pose = zero();
  const t = Math.max(0, frame) / Math.max(1, fps);
  const phase = t * Math.PI * 2 * 2;
  if (action === "idle") {
    pose.torso[0] = Math.sin(t * 2.4) * 0.018;
    pose.torso[1] = Math.sin(t * 1.2) * 0.012;
    pose.head[0] = Math.sin(t * 1.8) * 0.012;
  } else if (action === "walk") {
    const swing = Math.sin(phase) * 0.48;
    pose.armL[0] = -swing;
    pose.armR[0] = swing;
    pose.legL[0] = swing;
    pose.legR[0] = -swing;
    pose.hips[1] = Math.abs(Math.sin(phase)) * 0.035;
    pose.torso[0] = Math.sin(phase * 2) * 0.025;
  } else if (action === "talk") {
    pose.head[0] = Math.sin(t * 7) * 0.035;
    pose.head[1] = Math.sin(t * 3.5) * 0.035;
    pose.armR[0] = -0.35 + Math.sin(t * 6) * 0.12;
    pose.armR[2] = -0.12;
    pose.armL[0] = -0.12;
  } else if (action === "point") {
    pose.armR[0] = -1.35; pose.armR[2] = -0.16; pose.head[1] = -0.12;
  } else if (action === "wave") {
    pose.armR[0] = -2.25; pose.armR[2] = -0.18;
    pose.armR[1] = Math.sin(t * 9) * 0.36;
  } else if (action === "nod") {
    pose.head[0] = Math.sin(t * 10) * 0.28;
  } else if (action === "shake_head") {
    pose.head[1] = Math.sin(t * 9) * 0.38;
  } else if (action === "surprised") {
    const jump = Math.max(0, Math.sin(t * Math.PI * 2 * 1.2));
    pose.bounce = jump * 0.24;
    pose.squash = Math.max(0, -Math.sin(t * Math.PI * 2 * 1.2)) * 0.09;
    pose.armL[0] = -2.2; pose.armR[0] = -2.2;
    pose.legL[0] = 0.16; pose.legR[0] = -0.16;
    pose.torso[0] = -0.12;
  } else if (action === "laugh") {
    pose.head[0] = Math.sin(t * 12) * 0.22; pose.torso[0] = Math.sin(t * 12) * 0.1;
    pose.armL[0] = -0.45; pose.armR[0] = -0.45;
  } else if (action === "slam_table") {
    const impact = Math.max(0, Math.sin(t * Math.PI * 2 * 1.5));
    pose.torso[0] = 0.48 - impact * 0.15; pose.armL[0] = -1.1; pose.armR[0] = -1.1;
    pose.squash = impact * 0.11;
  } else if (action === "drop_item") {
    pose.torso[0] = 0.22; pose.head[0] = 0.26; pose.armL[0] = -0.4; pose.armR[0] = -0.5;
  } else if (action === "pick_up") {
    pose.torso[0] = 0.62; pose.head[0] = 0.35; pose.armR[0] = -0.8;
  } else if (action === "hand_over") {
    pose.armR[0] = -1.15; pose.armR[2] = -0.32; pose.torso[0] = -0.06;
  } else if (action === "think") {
    pose.armR[0] = -1.7; pose.armR[2] = -0.32; pose.head[0] = -0.08; pose.head[1] = 0.13;
  } else if (action === "angry") {
    pose.torso[0] = -0.08; pose.armL[0] = -0.4; pose.armR[0] = -0.4;
    pose.armL[2] = 0.16; pose.armR[2] = -0.16; pose.head[0] = 0.08;
  } else if (action === "turn_to") {
    pose.hips[1] = Math.sin(t * 3) * 0.3; pose.torso[1] = Math.sin(t * 3) * 0.52;
    pose.head[1] = Math.sin(t * 3) * 0.62;
  }
  return pose;
}

/** Blend the previous and current action over exactly 8 Remotion frames. */
export function blendedActionPose(
  action: CharacterAction,
  frame: number,
  fps: number,
  previousAction: CharacterAction = action,
  transitionStartFrame = frame,
): JointPose {
  const current = actionPose(action, frame, fps);
  if (previousAction === action) return current;
  const amount = smooth((frame - transitionStartFrame) / 8);
  const previous = actionPose(previousAction, frame, fps);
  const result = zero();
  (Object.keys(result).filter((key) => key !== "bounce" && key !== "squash") as Array<Exclude<keyof JointPose, "bounce" | "squash">>).forEach((joint) => {
    for (let axis = 0; axis < 3; axis++) {
      result[joint][axis] = previous[joint][axis] * (1 - amount) + current[joint][axis] * amount;
    }
  });
  result.bounce = previous.bounce * (1 - amount) + current.bounce * amount;
  result.squash = previous.squash * (1 - amount) + current.squash * amount;
  return result;
}
