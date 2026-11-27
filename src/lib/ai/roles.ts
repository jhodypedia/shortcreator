import { z } from "zod";
import { AiRoleSchema, type AiRole } from "./types";
import { ActionTypeSchema, AccessoryTypeSchema, BODY_TYPES, SetObjectTypeSchema } from "../technical-registry";
import { firstEmoji } from "../schemas";

const text = z.string().min(1);
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const shortBibleText = (max: number) => z.string().trim().max(max);
const bibleEmoji = z.string().refine((value) => firstEmoji(value, "") === value && [...graphemes.segment(value)].length === 1, "emoji harus tepat satu grapheme emoji");
const bible = z.object({ premise: text, audience: text, tone: text, language: text, world: z.object({ rules: z.array(z.string()), impossible: z.array(z.string()), taboo: z.array(z.string()) }), characters: z.array(z.record(z.string(), z.unknown())).min(1), sets: z.array(z.record(z.string(), z.unknown())).min(1), visualStyle: z.object({ palette: z.array(z.string().max(32)).max(12), captionFont: shortBibleText(48), cameraDefault: shortBibleText(32), accentColor: z.string().regex(/^#[0-9a-f]{6}$/i), emoji: bibleEmoji }), continuity: z.object({ summary: z.string(), activeCliffhanger: z.string(), threads: z.array(z.string()), characterStates: z.record(z.string(), z.string()) }), neverDo: z.array(z.string()), changelog: z.array(z.record(z.string(), z.unknown())) }).passthrough();
const character = z.object({ name: text, role: text, traits: z.array(z.string()), age: z.number().nonnegative(), height: z.number().positive(), bodyWidth: z.number().positive(), headRatio: z.number().positive(), skinColor: text, shirtColor: text, pantsColor: text, hairColor: text, accessories: z.array(z.object({ type: AccessoryTypeSchema, color: text, position: z.string() })), face: z.object({ eyes: z.string(), eyebrows: z.string(), mouth: z.string() }), bodyType: z.enum(BODY_TYPES), voice: z.object({ id: text, pitch: z.number(), speed: z.number(), style: z.string().optional() }), catchphrase: z.string(), movementStyle: text });
const setSpec = z.object({ name: text, objects: z.array(z.object({ type: SetObjectTypeSchema, position: z.tuple([z.number(), z.number(), z.number()]), size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]), color: text, rotation: z.tuple([z.number(), z.number(), z.number()]), text: z.string().optional() })).max(150), timeOfDay: text, sky: text, fog: z.boolean(), lighting: z.record(z.string(), z.unknown()), stagePoints: z.record(z.string(), z.tuple([z.number(), z.number(), z.number()])) });
const delivery = z.object({ emotion: text, intensity: z.number().min(0).max(1), pacing: z.enum(["slow", "measured", "natural", "brisk", "fast"]), pauses: z.array(z.object({ after: text, durationMs: z.number().int().min(0).max(3000) })), emphasisWords: z.array(text), nonverbal: z.array(z.enum(["laugh", "sigh", "gasp", "breath", "whisper"])) });
const directed = z.object({ beats: z.array(z.object({ speaker: text, text, emotion: text, delivery: delivery.optional(), action: ActionTypeSchema, moveTo: z.string().nullable(), lookAt: z.string().nullable(), prop: z.string().nullable(), sfx: z.string().nullable(), reactions: z.array(z.record(z.string(), z.unknown())), shot: text, setId: text }).passthrough()).min(1) });
const critique = z.object({ score: z.number().min(0).max(10), durationSec: z.number(), hasHook: z.boolean(), hasTwist: z.boolean(), safe: z.boolean(), notes: z.array(z.string()), improvements: z.array(z.string()) });
const patch = z.object({ operations: z.array(z.object({ op: z.enum(["set", "update", "delete"]), target: z.enum(["bible", "character", "set", "beat", "shot"]), path: text, value: z.unknown().optional() })) });

export const ROLE_DEFINITIONS = {
  bibleWriter: { input: z.object({ idea: text }), output: bible },
  characterDesigner: { input: z.object({ description: text, bible: z.unknown().optional(), voiceCatalog: z.array(z.record(z.string(), z.unknown())).optional() }), output: character },
  setDesigner: { input: z.object({ description: text, bible: z.unknown().optional() }), output: setSpec },
  scriptwriter: { input: z.object({ idea: text, bible: z.unknown(), continuity: z.unknown().optional() }), output: z.object({ beats: z.array(z.object({ speaker: text, text, emotion: text, beat: z.string().optional() }).passthrough()).min(1) }) },
  director: { input: z.object({ script: z.unknown(), characters: z.array(z.unknown()), sets: z.array(z.unknown()) }), output: directed },
  critic: { input: z.object({ episode: z.unknown(), bible: z.unknown() }), output: critique },
  editor: { input: z.object({ command: text, state: z.unknown() }), output: patch },
  outlineGenerator: { input: z.object({ idea: text, bible: z.unknown() }), output: z.array(z.object({ number: z.number().int(), title: text, hook: text, conflict: text, twist: text, cliffhanger: text, cliffhangerFrom: z.string().optional() })).min(1) },
  ideaGenerator: { input: z.object({ idea: text }), output: z.array(z.object({ hook: text, conflict: text, twist: text, payoff: text, cliffhanger: text })).min(1) },
  ttsPrep: { input: z.object({ text, language: z.string().default("id-ID") }), output: z.object({ spokenText: text }) },
} satisfies Record<AiRole, { input: z.ZodType; output: z.ZodType }>;

export function getRoleDefinition(role: AiRole) { return ROLE_DEFINITIONS[role]; }
export const aiRoleForRequest = AiRoleSchema;
