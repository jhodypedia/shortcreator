import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { buildDefaultShotsFromLines } from "../src/lib/bible";
import { SeriesBible, ScriptLine } from "../src/lib/schemas";
import { buildVoiceTimingObject, estimateLineDuration } from "../src/lib/timing";
import { AI_ROLES } from "../src/lib/ai/types";

const defaultRolePrompts: Record<(typeof AI_ROLES)[number], string> = {
  bibleWriter: "Create a complete Series Bible using the supplied concept and language. Return valid JSON only. Follow the supplied technical registry and make all content consistent with the input.",
  characterDesigner: "Design one original character consistent with the supplied Series Bible. Return valid JSON only and use only technical registry values.",
  setDesigner: "Design a voxel set consistent with the supplied Series Bible. Return valid JSON only and define useful named stagePoints.",
  scriptwriter: "Write episode beats consistent with the supplied Series Bible and continuity. Return valid JSON only. All story content must follow world rules and neverDo.",
  director: "Direct the supplied script using only characters, sets, stagePoints, and technical registry values provided in the input. Return valid JSON only.",
  critic: "Critique the supplied episode against the Series Bible, rules, continuity and neverDo. Return valid JSON only.",
  editor: "Convert the supplied edit request into the smallest valid JSON patch. Return JSON only.",
  ideaGenerator: "Generate the requested original episode ideas following the supplied Series Bible, rules, continuity and neverDo. Return valid JSON only.",
  outlineGenerator: "Generate the requested connected outlines following the supplied Series Bible, rules, continuity and neverDo. Return valid JSON only.",
};

const prisma = new PrismaClient();

function createSimpleWav(durationSec: number, freq: number): Buffer {
  const sampleRate = 22050;
  const numSamples = Math.max(Math.round(sampleRate * durationSec), 4096);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.sin((i / numSamples) * Math.PI) * 0.16;
    const val = Math.round(Math.sin(2 * Math.PI * freq * t) * env * 32767);
    buf.writeInt16LE(val, 44 + i * 2);
  }
  return buf;
}

async function main() {
  for (const role of AI_ROLES) {
    await prisma.promptPreset.upsert({ where: { id: `system-${role}` }, update: {}, create: { id: `system-${role}`, name: `System ${role}`, kind: "system", target: role, payload: defaultRolePrompts[role] } });
  }
  const bible: SeriesBible = {
    premise:
      "Kehidupan kocak Bimo dan Nara di Kampung Voxel saat benda-benda aneh mulai muncul tanpa izin.",
    world: {
      rules: [
        "Semua benda berbentuk blok voxel dan punya berat masing-masing",
        "Portal kristal hanya aktif saat senja",
      ],
      impossible: ["Tidak ada sihir instan tanpa konsekuensi"],
      taboo: ["Dilarang menyentuh lonceng balai desa di malam hari"],
    },
    characters: [
      {
        id: "char-bimo",
        name: "Bimo",
        role: "Anak penasaran",
        traits: ["penasaran", "nekat", "ceplas-ceplos"],
        colorPrimary: "#EF4444",
        colorSkin: "#F5C6A5",
        colorPants: "#1E293B",
        colorHair: "#27272A",
        proportions: { headScale: 1.08, bodyHeight: 0.94, limbLength: 0.96 },
        voiceId: "id-ID-ArdiNeural",
        voicePitch: 6,
        voiceSpeed: 1.05,
        expression: "kaget",
        accessory: "topi",
        catchphrase: "Coba pencet dikit nggak apa-apa kan?",
        forbidden: "Tidak pernah menuduh teman tanpa bukti",
      },
      {
        id: "char-nara",
        name: "Nara",
        role: "Penjaga desa",
        traits: ["disiplin", "waspada", "sabar"],
        colorPrimary: "#3B82F6",
        colorSkin: "#F1C29B",
        colorPants: "#0F172A",
        colorHair: "#1E1B4B",
        proportions: { headScale: 1.0, bodyHeight: 1.06, limbLength: 1.02 },
        voiceId: "id-ID-GadisNeural",
        voicePitch: -2,
        voiceSpeed: 0.98,
        expression: "mikir",
        accessory: "syal",
        catchphrase: "Baca papan larangan dulu, Bimo!",
        forbidden: "Tidak pernah meninggalkan pos tanpa pengaman",
      },
    ],
    sets: [
      {
        id: "set-alun",
        name: "Alun-alun Desa",
        template: "desa",
        mood: "cerah dan jenaka",
        lighting: "siang",
        palette: ["#38BDF8", "#84CC16", "#EF4444", "#FACC15"],
        props: [
          {
            id: "p-tree-1",
            kind: "pohon",
            name: "Pohon Voxel",
            position: [-3.5, 0, -2.5],
            rotationY: 0,
            scale: 1.2,
          },
          {
            id: "p-house-1",
            kind: "rumah",
            name: "Balai Desa",
            position: [3.2, 0, -3.5],
            rotationY: -0.35,
            scale: 1.1,
          },
          {
            id: "p-table-1",
            kind: "meja",
            name: "Meja Pengumuman",
            position: [0, 0, -1.8],
            rotationY: 0,
            scale: 1.0,
          },
        ],
      },
      {
        id: "set-gua",
        name: "Gua Kristal",
        template: "gua",
        mood: "misterius dan berkilau",
        lighting: "senja",
        palette: ["#A855F7", "#06B6D4", "#334155", "#F97316"],
        props: [
          {
            id: "p-portal-1",
            kind: "portal",
            name: "Portal Kristal",
            position: [0, 0, -3.2],
            rotationY: 0,
            scale: 1.3,
            color: "#A855F7",
          },
          {
            id: "p-kristal-1",
            kind: "kristal",
            name: "Batu Kristal",
            position: [-2.6, 0, -1.5],
            rotationY: 0.4,
            scale: 1.1,
            color: "#06B6D4",
          },
        ],
      },
    ],
    visualStyle: {
      palette: ["#EF4444", "#3B82F6", "#FACC15", "#22C55E"],
      captionFont: "Inter",
      cameraDefault: "medium",
      accentColor: "#EF4444",
      emoji: "🧱",
    },
    continuity: {
      summary:
        'Eps 1 ("Kotak Lonceng Aneh"): Bimo menekan kotak misterius di alun-alun yang ternyata mengirim sinyal ke Gua Kristal.',
      activeCliffhanger: "Cahaya ungu dari Gua Kristal mulai berkedip memanggil Bimo",
      threads: ["Cahaya ungu dari Gua Kristal mulai berkedip memanggil Bimo"],
      characterStates: {
        Bimo: "Penasaran berat dengan sinyal Gua Kristal",
        Nara: "Curiga ada yang membangunkan portal tua",
      },
    },
    neverDo: [
      "Jangan mulai dengan sapaan generik",
      "Jangan gunakan aset atau nama karakter milik game lain",
    ],
    changelog: [
      {
        date: new Date().toISOString().slice(0, 10),
        version: 1,
        change: "Series Bible awal Kampung Voxel",
        reason: "Seed data awal proyek",
      },
    ],
  };

  const warungBible: SeriesBible = {
    ...bible,
    premise: "Warung Pak Blokir: setiap barang murah punya hitungan dan cerita sendiri.",
    world: { rules: ["Semua benda berbentuk voxel", "Harga tertulis tangan dan tidak berubah sendiri"], impossible: ["Barang tidak berpindah tanpa disentuh"], taboo: ["Tidak boleh menyalakan korek dekat barang mudah terbakar"] },
    characters: [
      { ...bible.characters[0], id: "pak-blokir", name: "Pak Blokir", role: "Pemilik warung", colorPrimary: "#92400E", colorHair: "#166534", accessory: "topi", proportions: { headScale: 1.28, bodyHeight: 1.1, limbLength: 0.9 } },
      { ...bible.characters[1], id: "cubi", name: "Cubi", role: "Pelanggan cilik", colorPrimary: "#3B82F6", accessory: "topi", proportions: { headScale: 1.35, bodyHeight: 0.75, limbLength: 0.75 } },
      { ...bible.characters[1], id: "bu-pixel", name: "Bu Pixel", role: "Pelanggan teliti", colorPrimary: "#EC4899", colorHair: "#DB2777", accessory: "topi", proportions: { headScale: 1.25, bodyHeight: 1, limbLength: 1 } },
      { ...bible.characters[0], id: "tuan-creeper", name: "Tuan Creeper", role: "Pelanggan sopan", colorPrimary: "#22C55E", accessory: "none", proportions: { headScale: 1.35, bodyHeight: 1.05, limbLength: 0.95 } },
      { ...bible.characters[1], id: "kambing-kubus", name: "Kambing Kubus", role: "Kambing penjaga", colorPrimary: "#E5E7EB", accessory: "none", proportions: { headScale: 1.1, bodyHeight: 0.8, limbLength: 0.8 } },
    ],
    sets: [{ id: "set-warung-pak-blokir", name: "Warung Pak Blokir", template: "desa", mood: "hangat dan ramai", lighting: "siang", palette: ["#92400E", "#166534", "#FACC15", "#3B82F6"], props: [{ id: "warung-main", kind: "warung", name: "Bangunan Warung Pak Blokir", position: [0, 0, 0], rotationY: 0, scale: 1 }] }],
    visualStyle: { ...bible.visualStyle, palette: ["#92400E", "#166534", "#FACC15", "#3B82F6"], accentColor: "#FACC15" },
    continuity: { summary: "Warung baru buka; sepuluh batang korek sedang dihitung.", activeCliffhanger: "", threads: [], characterStates: {} },
    neverDo: ["Jangan mengubah harga barang tanpa sebab", "Jangan membuat Tuan Creeper kasar", "Jangan ada api dekat barang mudah terbakar"],
  };

  const existingWarung = await prisma.series.findFirst({ where: { name: "Warung Pak Blokir" } });
  const warungSeries = existingWarung
    ? await prisma.series.update({ where: { id: existingWarung.id }, data: { bible: warungBible, visualStyle: "voxel-3d" } })
    : await prisma.series.create({ data: { name: "Warung Pak Blokir", theme: "Komedi voxel di warung kampung", audience: "umum", tone: "lucu", language: "id-ID", visualStyle: "voxel-3d", bible: warungBible, bibleVersion: 1 } });

  const korekLines: ScriptLine[] = [
    { id: "korek-1", beat: "hook", speaker: "Pak Blokir", text: "Tuan Creeper membanting 10 koin kubus ke etalase: Pak, korek sepuluh!", emotion: "kaget", action: "slam_table", prop: "koin", sfx: "tink", durationSec: 2.8, setId: "set-warung-pak-blokir", moveTo: "counter" },
    { id: "korek-2", beat: "setup", speaker: "Cubi", text: "Aku beli satu saja, Pak!", emotion: "senang", action: "talk", durationSec: 2.1, setId: "set-warung-pak-blokir", moveTo: "pintu", lookAt: "Pak Blokir" },
    { id: "korek-3", beat: "konflik", speaker: "Pak Blokir", text: "Tadi sepuluh, sekarang kok tinggal sembilan?", emotion: "curiga", action: "think", prop: "korek", durationSec: 2.5, setId: "set-warung-pak-blokir", lookAt: "Cubi" },
    { id: "korek-4", beat: "twist", speaker: "Cubi", text: "Yang satu kupakai buat nyalain lilin kue!", emotion: "kaget", action: "surprised", prop: "kue dan lilin", durationSec: 2.4, setId: "set-warung-pak-blokir", lookAt: "Pak Blokir" },
    { id: "korek-5", beat: "payoff", speaker: "Pak Blokir", text: "Berarti tinggal sembilan, kuenya gratis!", emotion: "senang", action: "laugh", durationSec: 2.5, setId: "set-warung-pak-blokir", lookAt: "camera" },
  ];
  const korekTiming = buildVoiceTimingObject({ lines: korekLines, audioDurations: {}, fps: 30 });
  const korekShots = buildDefaultShotsFromLines(korekLines, korekTiming.voiceTiming.lineTimings);
  const existingKorek = await prisma.episode.findFirst({ where: { seriesId: warungSeries.id, title: "Korek Sepuluh Biji" } });
  if (existingKorek) {
    await prisma.episode.update({ where: { id: existingKorek.id }, data: {
      status: "ready", hook: korekLines[0].text, twist: korekLines[3].text, cliffhanger: "Besok ada yang beli sebelas batang.",
      script: { lines: korekLines, setId: "set-warung-pak-blokir" }, voiceTiming: korekTiming.voiceTiming,
      shots: { shots: korekShots }, durationSec: korekTiming.durationSec, totalFrames: korekTiming.totalFrames,
    } });
  } else await prisma.episode.create({ data: {
    seriesId: warungSeries.id, number: 1, title: "Korek Sepuluh Biji", status: "ready",
    hook: korekLines[0].text, twist: korekLines[3].text, cliffhanger: "Besok ada yang beli sebelas batang.",
    script: { lines: korekLines, setId: "set-warung-pak-blokir" }, voiceTiming: korekTiming.voiceTiming,
    shots: { shots: korekShots }, durationSec: korekTiming.durationSec, totalFrames: korekTiming.totalFrames,
  } });

  const existing = await prisma.series.findFirst({ where: { name: "Kampung Voxel" } });
  if (existing) {
    console.log("Seed Warung Pak Blokir diperbarui; Kampung Voxel sudah ada, melewati.");
    return;
  }

  const series = await prisma.series.create({
    data: {
      name: "Kampung Voxel",
      theme: "Petualangan komedi desa blok orisinal",
      audience: "umum",
      tone: "lucu",
      language: "id-ID",
      visualStyle: "voxel-3d",
      bible,
      bibleVersion: 1,
    },
  });

  // Episode 1 lengkap (status: ready)
  const ep1Lines: ScriptLine[] = [
    {
      id: "line-1",
      beat: "hook",
      speaker: "Bimo",
      text: "Nara, kenapa kotak merah ini tiba-tiba berdetak?",
      emotion: "kaget",
      durationSec: estimateLineDuration("Nara, kenapa kotak merah ini tiba-tiba berdetak?"),
      setId: "set-alun",
    },
    {
      id: "line-2",
      beat: "setup",
      speaker: "Nara",
      text: "Jangan disentuh! Itu bukan kotak paket biasa.",
      emotion: "marah",
      durationSec: estimateLineDuration("Jangan disentuh! Itu bukan kotak paket biasa."),
      setId: "set-alun",
    },
    {
      id: "line-3",
      beat: "konflik",
      speaker: "Bimo",
      text: "Telat, jariku sudah kepencet tombol tengahnya!",
      emotion: "kaget",
      durationSec: estimateLineDuration("Telat, jariku sudah kepencet tombol tengahnya!"),
      setId: "set-alun",
    },
    {
      id: "line-4",
      beat: "konflik",
      speaker: "Nara",
      text: "Lari ke belakang meja, nanti meledak!",
      emotion: "kaget",
      durationSec: estimateLineDuration("Lari ke belakang meja, nanti meledak!"),
      setId: "set-alun",
    },
    {
      id: "line-5",
      beat: "twist",
      speaker: "Bimo",
      text: "Eh, kok isinya cuma ayam blok pakai kacamata?",
      emotion: "mikir",
      durationSec: estimateLineDuration("Eh, kok isinya cuma ayam blok pakai kacamata?"),
      setId: "set-alun",
    },
    {
      id: "line-6",
      beat: "payoff",
      speaker: "Nara",
      text: "Gawat, lihat langit Gua Kristal langsung menyala ungu!",
      emotion: "kaget",
      durationSec: estimateLineDuration("Gawat, lihat langit Gua Kristal langsung menyala ungu!"),
      setId: "set-alun",
    },
  ];

  const ep1 = await prisma.episode.create({
    data: {
      seriesId: series.id,
      number: 1,
      title: "Kotak Lonceng Aneh",
      status: "ready",
      hook: "Nara, kenapa kotak merah ini tiba-tiba berdetak?",
      twist: "Kotaknya tidak meledak, malah mengeluarkan ayam berkacamata yang menyalakan Gua Kristal",
      cliffhanger: "Cahaya ungu dari Gua Kristal mulai berkedip memanggil Bimo",
      script: { lines: ep1Lines, setId: "set-alun" },
      shots: { shots: [] },
    },
  });

  const audioDir = path.join(process.cwd(), "storage", "audio", ep1.id);
  await fs.mkdir(audioDir, { recursive: true });
  const audioDurations: Record<string, number> = {};
  const audioFiles: Array<{ lineId: string; path: string; durationSec: number }> = [];

  for (let i = 0; i < ep1Lines.length; i++) {
    const line = ep1Lines[i];
    const wavPath = path.join(audioDir, `${line.id}.wav`);
    const dur = Math.max(2.6, line.durationSec + 1.2);
    await fs.writeFile(wavPath, createSimpleWav(dur, 200 + i * 25));
    audioDurations[line.id] = dur;
    audioFiles.push({
      lineId: line.id,
      path: `/api/storage/audio/${ep1.id}/${line.id}.wav`,
      durationSec: dur,
    });
  }

  const ep1Timing = buildVoiceTimingObject({
    lines: ep1Lines,
    audioDurations,
    fps: 30,
  });
  const ep1Shots = buildDefaultShotsFromLines(ep1Lines, ep1Timing.voiceTiming.lineTimings);

  await prisma.episode.update({
    where: { id: ep1.id },
    data: {
      voiceTiming: ep1Timing.voiceTiming,
      shots: { shots: ep1Shots },
      durationSec: ep1Timing.durationSec,
      totalFrames: ep1Timing.totalFrames,
      audioFiles,
    },
  });

  // Episode 2 lanjutan (status: script) — langsung menjawab cliffhanger Ep 1 & menyisakan cliffhanger baru
  const ep2Lines: ScriptLine[] = [
    {
      id: "line-1",
      beat: "hook",
      speaker: "Bimo",
      text: "Cahaya ungu Gua Kristal barusan memanggil namaku!",
      emotion: "kaget",
      durationSec: estimateLineDuration("Cahaya ungu Gua Kristal barusan memanggil namaku!"),
      setId: "set-gua",
    },
    {
      id: "line-2",
      beat: "setup",
      speaker: "Nara",
      text: "Pantas saja sejak kotak kemarin pintu gua terbuka.",
      emotion: "mikir",
      durationSec: estimateLineDuration("Pantas saja sejak kotak kemarin pintu gua terbuka."),
      setId: "set-gua",
    },
    {
      id: "line-3",
      beat: "konflik",
      speaker: "Bimo",
      text: "Ayam berkacamata tadi lompat masuk ke portal ungu!",
      emotion: "kaget",
      durationSec: estimateLineDuration("Ayam berkacamata tadi lompat masuk ke portal ungu!"),
      setId: "set-gua",
    },
    {
      id: "line-4",
      beat: "twist",
      speaker: "Nara",
      text: "Tunggu, dia bukan ayam biasa, dia penjaga gerbang!",
      emotion: "senang",
      durationSec: estimateLineDuration("Tunggu, dia bukan ayam biasa, dia penjaga gerbang!"),
      setId: "set-gua",
    },
    {
      id: "line-5",
      beat: "payoff",
      speaker: "Bimo",
      text: "Peta dimensi muncul di dinding gua! Lanjut eps tiga!",
      emotion: "senang",
      durationSec: estimateLineDuration("Peta dimensi muncul di dinding gua! Lanjut eps tiga!"),
      setId: "set-gua",
    },
  ];

  await prisma.episode.create({
    data: {
      seriesId: series.id,
      number: 2,
      title: "Panggilan Gua Kristal",
      status: "script",
      hook: "Cahaya ungu Gua Kristal barusan memanggil namaku!",
      twist: "Ayam berkacamata ternyata adalah penjaga asli gerbang dimensi Gua Kristal",
      cliffhanger: "Peta dimensi bercahaya muncul di dinding Gua Kristal menunjuk tiga koordinat",
      cliffhangerFrom: "Cahaya ungu dari Gua Kristal mulai berkedip memanggil Bimo",
      script: { lines: ep2Lines, setId: "set-gua", continuityConfirmed: true },
      shots: { shots: buildDefaultShotsFromLines(ep2Lines, []) },
      durationSec: ep2Lines.reduce((acc, l) => acc + l.durationSec, 0),
    },
  });

  await prisma.queueControl.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", isPaused: false },
  });

  await prisma.activityLog.create({
    data: {
      seriesId: series.id,
      episodeId: ep1.id,
      level: "success",
      message: "Seed Kampung Voxel selesai",
      detail: "Episode 1 siap preview/render, Episode 2 siap sebagai lanjutan.",
    },
  });

  console.log("Seed Kampung Voxel berhasil dibuat.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
