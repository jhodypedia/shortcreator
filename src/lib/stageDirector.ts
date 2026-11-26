import { EpisodeScript, ScriptLine, StagePositionSchema } from "./schemas";
import { CharacterAction } from "./animation/actions";

export const STAGE_POSITIONS = {
  counter: [-1.35, 0, 0] as [number, number, number],
  pintu: [1.35, 0, -0.3] as [number, number, number],
  tengah_jalan: [0, 0, 0.35] as [number, number, number],
  belakang_warung: [-0.75, 0, -0.85] as [number, number, number],
};

export interface DirectedCharacter {
  character: string;
  action: CharacterAction;
  from: [number, number, number];
  to: [number, number, number];
  lookAt: string;
  startFrame: number;
  endFrame: number;
  moving: boolean;
  previousAction?: CharacterAction;
  transitionStartFrame?: number;
  prop?: string;
  sfx?: string;
}
export interface DirectedBeat { lineId: string; startFrame: number; endFrame: number; characters: DirectedCharacter[]; sfx?: string }

export function inferActionFromText(text: string): CharacterAction | undefined {
  const t = text.toLowerCase();
  if (/membanting|menghantam|menggebrak/.test(t)) return "slam_table";
  if (/jatuh|terjatuh|menjatuhkan/.test(t)) return "drop_item";
  if (/lari|berlari|mengejar/.test(t)) return "walk";
  if (/kaget|terkejut|astaga/.test(t)) return "surprised";
  if (/tertawa|terkekeh|ha.?ha/.test(t)) return "laugh";
  if (/menunjuk|tunjuk/.test(t)) return "point";
  if (/melamba/i.test(t)) return "wave";
  if (/mengambil|memungut/.test(t)) return "pick_up";
  if (/menyerahkan|memberikan/.test(t)) return "hand_over";
  return undefined;
}

export function beatAction(line: ScriptLine): CharacterAction {
  return line.action && line.action !== "idle" && line.action !== "talk"
    ? line.action
    : inferActionFromText(line.text) ?? gestureFromEmotionAndText(line);
}

function gestureFromEmotionAndText(line: ScriptLine): CharacterAction {
  const text = line.text.toLowerCase();
  if (/ayo|lihat|tuh|ini dia|coba/.test(text)) return "point";
  if (line.emotion === "senang") return "talk";
  if (line.emotion === "kaget") return "surprised";
  if (line.emotion === "marah") return "angry";
  if (line.emotion === "mikir" || line.emotion === "curiga") return "think";
  if (line.emotion === "sedih") return "shake_head";
  return "talk";
}

/** Build continuous blocking paths from script beats. All coordinates and timings are render-frame deterministic. */
export function directStage(
  script: EpisodeScript,
  fps = 30,
  lineTimings: Array<{ lineId: string; startFrame: number; endFrame: number }> = [],
  cast: string[] = [],
): DirectedBeat[] {
  const previous = new Map<string, [number, number, number]>();
  let cursor = 0;
  return script.lines.map((line, index) => {
    const timing = lineTimings.find((item) => item.lineId === line.id);
    const beatStart = timing?.startFrame ?? cursor;
    const durationFrames = Math.max(1, (timing?.endFrame ?? beatStart + Math.round(line.durationSec * fps)) - beatStart);
    cursor = beatStart;
    const speaker = line.speaker;
    const speakerStart = previous.get(speaker) ?? STAGE_POSITIONS[index % 2 === 0 ? "pintu" : "counter"];
    const speakerPosition = line.moveTo ? STAGE_POSITIONS[line.moveTo] : speakerStart;
    const beatEnd = cursor + durationFrames;
    const out: DirectedCharacter[] = [{
      character: speaker,
      action: beatAction(line),
      previousAction: "idle",
      transitionStartFrame: beatStart,
      from: speakerStart,
      to: speakerPosition,
      lookAt: line.lookAt ?? "camera",
      startFrame: beatStart,
      endFrame: beatEnd,
      moving: speakerStart.some((v, axis) => Math.abs(v - speakerPosition[axis]) > 0.05),
      prop: line.prop,
      sfx: line.sfxPath ?? line.sfx,
    }];

    // Keep listeners in a distinct blocking mark and animate a reaction on their beat delay.
    const allCharacters = [...new Set([...cast, ...script.lines.map((l) => l.speaker)])];
    const listeners = allCharacters.filter((name) => name !== speaker).filter((name) =>
      line.reactions?.some((reaction) => reaction.character === name),
    );
    const occupied = [speakerPosition];
    for (const listener of listeners) {
      const oldPosition = previous.get(listener) ?? STAGE_POSITIONS["belakang_warung"];
      const listenerPosition = oldPosition;
      const reaction = line.reactions?.find((r) => r.character === listener);
      out.push({
        character: listener,
        action: reaction?.action ?? (line.emotion === "kaget" ? "surprised" : "nod"),
        previousAction: "idle",
        transitionStartFrame: cursor + (reaction?.delayFrames ?? 0),
        from: oldPosition,
        to: listenerPosition,
        lookAt: speaker,
        startFrame: cursor + (reaction?.delayFrames ?? 0),
        endFrame: beatEnd,
        moving: false,
      });
      occupied.push(listenerPosition);
    }
    previous.set(speaker, speakerPosition);
    for (const character of allCharacters) {
      if (!previous.has(character)) previous.set(character, character === speaker ? speakerPosition : STAGE_POSITIONS.belakang_warung);
    }
    cursor = beatEnd;
    return { lineId: line.id, startFrame: beatStart, endFrame: beatEnd, characters: out, sfx: line.sfxPath ?? line.sfx };
  });
}

export function evaluateStagePosition(beat: DirectedBeat, character: string, frame: number): [number, number, number] {
  const cue = beat.characters.find((item) => item.character === character);
  if (!cue || !cue.moving) return cue?.to ?? [0, 0, 0];
  const distance = Math.hypot(cue.to[0] - cue.from[0], cue.to[1] - cue.from[1], cue.to[2] - cue.from[2]);
  const duration = Math.min(Math.max(18, Math.ceil(distance / 1.6 * 30)), Math.max(18, cue.endFrame - cue.startFrame));
  const p = Math.max(0, Math.min(1, (frame - cue.startFrame) / duration));
  const eased = p * p * (3 - 2 * p);
  return cue.from.map((v, i) => v + (cue.to[i] - v) * eased) as [number, number, number];
}

export function evaluateStageFacing(beat: DirectedBeat, character: string, frame: number): number {
  const cue = beat.characters.find((item) => item.character === character);
  if (!cue || !cue.moving) return 0;
  const arrived = frame >= cue.startFrame + Math.min(Math.max(18, Math.ceil(Math.hypot(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]) / 1.6 * 30)), cue.endFrame - cue.startFrame);
  if (arrived) return cue.lookAt === "camera" ? 0 : Math.atan2(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]);
  return Math.atan2(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]);
}

export function assertStageMovement(beats: DirectedBeat[]) {
  return beats.every((beat) => beat.characters.some((cue) => cue.moving));
}

export const stagePositionNameSchema = StagePositionSchema;
