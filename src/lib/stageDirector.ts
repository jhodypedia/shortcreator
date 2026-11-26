import { EpisodeScript, ScriptLine, StagePositionSchema } from "./schemas";
import { CharacterAction } from "./animation/actions";
const DEFAULT_STAGE_POSITIONS: Record<string, [number, number, number]> = {};

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
  stagePoints: Record<string, [number, number, number]> = {},
): DirectedBeat[] {
  const previous = new Map<string, [number, number, number]>();
  const previousActions = new Map<string, CharacterAction>();
  let cursor = 0;
  const castPositions = new Map<string, [number, number, number]>();
  const positions: Record<string, [number, number, number]> = Object.keys(stagePoints).length ? stagePoints : DEFAULT_STAGE_POSITIONS;
  const stageMarks = Object.values(positions);
  cast.forEach((name, index) => { if (stageMarks.length) castPositions.set(name, stageMarks[index % stageMarks.length]); });
  return script.lines.map((line, index) => {
    const timing = lineTimings.find((item) => item.lineId === line.id);
    const beatStart = timing?.startFrame ?? cursor;
    const durationFrames = Math.max(1, (timing?.endFrame ?? beatStart + Math.round(line.durationSec * fps)) - beatStart);
    cursor = beatStart;
    const speaker = line.speaker;
    const defaultPosition = stageMarks[index % Math.max(1, stageMarks.length)] ?? [0, 0, 0];
    const speakerStart = previous.get(speaker) ?? castPositions.get(speaker) ?? defaultPosition;
    let speakerPosition = line.moveTo ? positions[line.moveTo] ?? speakerStart : speakerStart;
    if (line.moveTo && Math.hypot(speakerPosition[0] - speakerStart[0], speakerPosition[2] - speakerStart[2]) < 0.05) {
      const nextMark = Object.values(positions).find((mark) => Math.hypot(mark[0] - speakerStart[0], mark[2] - speakerStart[2]) >= 0.85);
      if (nextMark) speakerPosition = nextMark;
    }
    const beatEnd = cursor + durationFrames;
    const out: DirectedCharacter[] = [{
      character: speaker,
      action: beatAction(line),
      previousAction: previousActions.get(speaker) ?? "idle",
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

    // Keep every cast member on their saved mark; only explicit reactions add a cue.
    const allCharacters = [...new Set([...cast, ...script.lines.map((l) => l.speaker)])];
    const listeners = allCharacters.filter((name) => name !== speaker);
    for (const listener of listeners) {
      const oldPosition = previous.get(listener) ?? castPositions.get(listener) ?? stageMarks[0] ?? [0, 0, 0];
      const reaction = line.reactions?.find((r) => r.character === listener);
      out.push({
        character: listener,
        action: reaction?.action ?? "idle",
        previousAction: previousActions.get(listener) ?? "idle",
        transitionStartFrame: cursor + (reaction?.delayFrames ?? 0),
        from: oldPosition,
        to: oldPosition,
        lookAt: speaker,
        startFrame: cursor + (reaction?.delayFrames ?? 0),
        endFrame: beatEnd,
        moving: false,
      });
    }
    previous.set(speaker, speakerPosition);
    previousActions.set(speaker, beatAction(line));
    for (const character of allCharacters) if (!previous.has(character)) previous.set(character, castPositions.get(character) ?? stageMarks[0] ?? [0, 0, 0]);
    cursor = beatEnd;
    return { lineId: line.id, startFrame: beatStart, endFrame: beatEnd, characters: out, sfx: line.sfxPath ?? line.sfx };
  });
}

export function evaluateStagePosition(beat: DirectedBeat, character: string, frame: number): [number, number, number] {
  const cue = beat.characters.find((item) => item.character === character);
  if (!cue || !cue.moving) return cue?.to ?? [0, 0, 0];
  const distance = Math.hypot(cue.to[0] - cue.from[0], cue.to[1] - cue.from[1], cue.to[2] - cue.from[2]);
  const duration = Math.min(Math.max(18, Math.ceil(distance / 1.6 * 30)), Math.max(1, cue.endFrame - cue.startFrame));
  const p = Math.max(0, Math.min(1, (frame - cue.startFrame) / duration));
  const eased = p === 0 || p === 1 ? p : p < 0.25 ? p * 1.12 : 1 - Math.exp(-7 * (p - 0.25)) * (1 - p) * 0.12;
  return cue.from.map((v, i) => v + (cue.to[i] - v) * eased) as [number, number, number];
}

export function evaluateStageFacing(beat: DirectedBeat, character: string, frame: number): number {
  const cue = beat.characters.find((item) => item.character === character);
  if (!cue || !cue.moving) return 0;
  const arrived = frame >= cue.startFrame + Math.min(Math.max(18, Math.ceil(Math.hypot(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]) / 1.6 * 30)), Math.max(1, cue.endFrame - cue.startFrame));
  if (arrived) return cue.lookAt === "camera" ? 0 : Math.atan2(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]);
  return Math.atan2(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]);
}

export function assertStageMovement(beats: DirectedBeat[]) {
  return beats.every((beat) => beat.characters.some((cue) => cue.moving));
}

export const stagePositionNameSchema = StagePositionSchema;
