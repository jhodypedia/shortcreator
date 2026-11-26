import { z } from "zod";

export const EmotionSchema = z.enum([
  "netral",
  "senang",
  "kaget",
  "sedih",
  "marah",
  "mikir",
  "curiga",
]);

export const BeatTypeSchema = z.enum([
  "hook",
  "setup",
  "konflik",
  "twist",
  "payoff",
]);

export const ActionTypeSchema = z.enum([
  "idle", "walk", "talk", "point", "wave", "nod", "shake_head", "surprised",
  "laugh", "slam_table", "drop_item", "pick_up", "hand_over", "think", "angry", "turn_to",
]);
export const StagePositionSchema = z.enum(["counter", "pintu", "tengah_jalan", "belakang_warung"]);
export const ReactionSchema = z.object({
  character: z.string().default(""),
  action: ActionTypeSchema.default("surprised"),
  delayFrames: z.number().int().min(0).max(300).default(0),
});

export const ShotTypeSchema = z.enum([
  "wide",
  "medium",
  "close-up",
  "over-shoulder",
  "low-angle",
  "high-angle",
  "dolly-in",
  "pan",
]);

export const LightingPresetSchema = z.enum([
  "siang",
  "senja",
  "malam",
  "horror",
]);

export const CharacterSchema = z.object({
  id: z.string().min(1, "ID karakter wajib diisi"),
  name: z.string().min(1, "Nama karakter wajib diisi"),
  role: z.string().min(1, "Peran karakter wajib diisi"),
  traits: z
    .array(z.string().min(1))
    .min(1, "Minimal 1 sifat karakter")
    .max(5, "Maksimal 5 sifat karakter"),
  colorPrimary: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Warna utama harus format hex (#RRGGBB)"),
  colorSkin: z.string().default("#F5C6A5"),
  colorPants: z.string().default("#334155"),
  colorHair: z.string().default("#1E293B"),
  proportions: z
    .object({
      headScale: z.number().min(0.6).max(1.8).default(1),
      bodyHeight: z.number().min(0.6).max(1.6).default(1),
      limbLength: z.number().min(0.6).max(1.6).default(1),
    })
    .default({ headScale: 1, bodyHeight: 1, limbLength: 1 }),
  voiceId: z.string().min(1, "Suara (voiceId) karakter wajib dipilih"),
  voicePitch: z.number().min(-20).max(20).default(0),
  voiceSpeed: z.number().min(0.6).max(1.6).default(1),
  expression: EmotionSchema.default("netral"),
  accessory: z.enum(["none", "topi", "kacamata", "syal", "mahkota"]).default("none"),
  catchphrase: z.string().default(""),
  forbidden: z.string().default(""),
});

export const PropPlacementSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  name: z.string().min(1),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationY: z.number().default(0),
  scale: z.number().min(0.2).max(5).default(1),
  color: z.string().optional(),
  assetPath: z.string().optional(),
});

export const SetSchema = z.object({
  id: z.string().min(1, "ID set wajib diisi"),
  name: z.string().min(1, "Nama set wajib diisi"),
  template: z
    .enum(["desa", "hutan", "gua", "rumah", "arena", "pantai", "custom"])
    .default("desa"),
  mood: z.string().min(1, "Mood set wajib diisi"),
  lighting: LightingPresetSchema,
  palette: z.array(z.string().min(1)).min(1, "Minimal 1 warna palette set"),
  props: z.array(PropPlacementSchema).default([]),
});

export const SeriesBibleChangelogSchema = z.object({
  date: z.string(),
  version: z.number().int(),
  change: z.string(),
  reason: z.string(),
});

export const SeriesBibleSchema = z.object({
  premise: z
    .string()
    .min(10, "Premise minimal 10 karakter agar cerita jelas"),
  world: z.object({
    rules: z.array(z.string()).default([]),
    impossible: z.array(z.string()).default([]),
    taboo: z.array(z.string()).default([]),
  }),
  characters: z
    .array(CharacterSchema)
    .min(1, "Series Bible wajib memiliki minimal 1 karakter"),
  sets: z
    .array(SetSchema)
    .min(1, "Series Bible wajib memiliki minimal 1 set/lokasi"),
  visualStyle: z.object({
    palette: z.array(z.string()).min(1, "Minimal 1 warna palette global"),
    captionFont: z.string().default("Inter"),
    cameraDefault: ShotTypeSchema.default("medium"),
    accentColor: z.string().default("#F97316"),
    emoji: z.string().default("🎬"),
  }),
  continuity: z.object({
    summary: z.string().default("Serial baru dimulai."),
    activeCliffhanger: z.string().default(""),
    threads: z.array(z.string()).default([]),
    characterStates: z.record(z.string(), z.string()).default({}),
  }),
  neverDo: z.array(z.string()).default([]),
  changelog: z.array(SeriesBibleChangelogSchema).default([]),
});

export const ScriptLineSchema = z.object({
  id: z.string().min(1),
  beat: BeatTypeSchema.default("setup"),
  speaker: z.string().min(1, "Pembicara harus dipilih"),
  text: z.string().min(1, "Teks dialog tidak boleh kosong"),
  emotion: EmotionSchema.default("netral"),
  durationSec: z.number().min(0.4).max(20),
  setId: z.string().optional(),
  action: ActionTypeSchema.optional(),
  actionTarget: z.string().optional(),
  prop: z.string().optional(),
  moveTo: StagePositionSchema.optional(),
  lookAt: z.string().optional(),
  sfx: z.string().optional(),
  reactions: z.array(ReactionSchema).optional(),
  sfxPath: z.string().optional(),
});

export const EpisodeScriptSchema = z.object({
  lines: z.array(ScriptLineSchema).min(1, "Naskah minimal memiliki 1 baris dialog"),
  setId: z.string().optional(),
  continuityConfirmed: z.boolean().optional(),
  continuityNote: z.string().optional(),
});

export const WordCaptionSchema = z.object({
  word: z.string().min(1),
  lineId: z.string().optional(),
  speaker: z.string().optional(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
});

export const PauseMarkerSchema = z.object({
  id: z.string().optional(),
  afterLineId: z.string(),
  durationSec: z.number().min(0).max(5),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  reason: z.string().optional(),
});

export const SfxMarkerSchema = z.object({
  id: z.string(),
  assetId: z.string().optional(),
  name: z.string(),
  path: z.string(),
  frame: z.number().int().min(0),
  volume: z.number().min(0).max(1.5).default(0.8),
});

export const CaptionStyleSchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().min(28).max(96).default(56),
  activeColor: z.string().default("#FACC15"),
  textColor: z.string().default("#FFFFFF"),
  bgColor: z.string().default("rgba(0,0,0,0.68)"),
  position: z.enum(["tengah-bawah", "tengah"]).default("tengah-bawah"),
});

export const VoiceTimingSchema = z.object({
  fps: z.number().int().default(30),
  captions: z.array(WordCaptionSchema),
  pauses: z.array(PauseMarkerSchema).default([]),
  sfxMarkers: z.array(SfxMarkerSchema).default([]),
  bgm: z
    .object({
      assetId: z.string().optional(),
      name: z.string().optional(),
      path: z.string().optional(),
      volume: z.number().min(0).max(1).default(0.3),
      duckDb: z.number().min(-30).max(0).default(-12),
    })
    .optional(),
  captionStyle: CaptionStyleSchema.default({
    fontFamily: "Inter",
    fontSize: 56,
    activeColor: "#FACC15",
    textColor: "#FFFFFF",
    bgColor: "rgba(0,0,0,0.68)",
    position: "tengah-bawah",
  }),
  lineTimings: z
    .array(
      z.object({
        lineId: z.string(),
        startFrame: z.number().int().min(0),
        endFrame: z.number().int().min(1),
        durationSec: z.number().min(0.1),
      })
    )
    .default([]),
});

export const ShotItemSchema = z.object({
  id: z.string().optional(),
  lineId: z.string().optional(),
  shot: ShotTypeSchema,
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  camera: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    lookAt: z.tuple([z.number(), z.number(), z.number()]),
    fov: z.number().min(20).max(100).default(45),
  }),
  transition: z.enum(["cut", "fade"]).default("cut"),
  note: z.string().default(""),
});

export const ShotListSchema = z.object({
  shots: z.array(ShotItemSchema).min(1, "Minimal 1 shot kamera harus ada"),
});

export const ReviewCheckItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  note: z.string().default(""),
});

export const EpisodeReviewSchema = z.object({
  checks: z.array(ReviewCheckItemSchema).length(7),
  status: z.enum(["lolos", "perlu_revisi"]),
  reviewedAt: z.string(),
  renderAttempts: z.number().int().min(0).default(0),
  unlockReason: z.string().optional(),
});

export const EpisodePublishSchema = z.object({
  platform: z.enum(["YouTube Shorts", "TikTok", "Instagram Reels"]),
  url: z.string().default(""),
  uploadedAt: z.string().min(1, "Tanggal upload wajib diisi"),
  views: z.number().int().min(0).default(0),
  likes: z.number().int().min(0).default(0),
  subsDelta: z.number().int().default(0),
  notes: z.string().default(""),
});

export const CreateSeriesInputSchema = z.object({
  name: z.string().min(2, "Nama series minimal 2 karakter"),
  theme: z.string().min(3, "Tema minimal 3 karakter"),
  audience: z.enum(["anak", "remaja", "umum"]),
  tone: z.enum(["lucu", "tegang", "heartwarming"]),
  language: z.string().default("id-ID"),
  visualStyle: z.enum(["voxel-3d", "cartoon-3d"]),
  bible: SeriesBibleSchema.optional(),
});

export const BulkOutlineItemSchema = z.object({
  number: z.number().int().min(1),
  title: z.string().min(1, "Judul episode wajib diisi"),
  hook: z.string().min(3, "Hook episode wajib diisi"),
  conflict: z.string().min(3, "Konflik episode wajib diisi"),
  twist: z.string().min(3, "Twist episode wajib diisi"),
  cliffhanger: z.string().min(3, "Cliffhanger episode wajib diisi"),
  cliffhangerFrom: z.string().optional(),
  continuityChecked: z.boolean().default(true),
});

export type SeriesBible = z.infer<typeof SeriesBibleSchema>;
export type CharacterConfig = z.infer<typeof CharacterSchema>;
export type SetConfig = z.infer<typeof SetSchema>;
export type ScriptLine = z.infer<typeof ScriptLineSchema>;
export type EpisodeScript = z.infer<typeof EpisodeScriptSchema>;
export type ScriptLineInput = z.input<typeof ScriptLineSchema>;
export type WordCaption = z.infer<typeof WordCaptionSchema>;
export type PauseMarker = z.infer<typeof PauseMarkerSchema>;
export type VoiceTiming = z.infer<typeof VoiceTimingSchema>;
export type ShotItem = z.infer<typeof ShotItemSchema>;
export type ShotList = z.infer<typeof ShotListSchema>;
export type EpisodeReview = z.infer<typeof EpisodeReviewSchema>;
export type EpisodePublish = z.infer<typeof EpisodePublishSchema>;
export type BulkOutlineItem = z.infer<typeof BulkOutlineItemSchema>;
