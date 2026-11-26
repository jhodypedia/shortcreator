import {
  SeriesBible,
  SeriesBibleSchema,
  ShotItem,
  ScriptLine,
} from "./schemas";

export const SHOT_HINTS: Record<
  ShotItem["shot"],
  { label: string; description: string; position: [number, number, number]; lookAt: [number, number, number]; fov: number }
> = {
  wide: {
    label: "Wide",
    description: "Buka set, tunjukkan dunia atau lokasi baru",
    position: [0, 4.2, 9.5],
    lookAt: [0, 1.2, 0],
    fov: 52,
  },
  medium: {
    label: "Medium",
    description: "Dialog normal antara 1–2 karakter",
    position: [0.8, 2.2, 5.2],
    lookAt: [0, 1.4, 0],
    fov: 45,
  },
  "close-up": {
    label: "Close-up",
    description: "Reaksi emosi tajam, punchline, atau momen twist",
    position: [0.2, 1.85, 2.6],
    lookAt: [0, 1.65, 0],
    fov: 38,
  },
  "over-shoulder": {
    label: "Over-Shoulder",
    description: "Konfrontasi atau dialog tegang antar dua karakter",
    position: [-1.8, 2.1, 3.6],
    lookAt: [0.7, 1.5, -0.4],
    fov: 42,
  },
  "low-angle": {
    label: "Low-Angle",
    description: "Karakter terlihat kuat, gagah, atau mengancam",
    position: [0.4, 0.75, 3.8],
    lookAt: [0, 1.9, 0],
    fov: 48,
  },
  "high-angle": {
    label: "High-Angle",
    description: "Karakter terlihat kecil, kalah, atau terpojok",
    position: [1.2, 5.4, 4.5],
    lookAt: [0, 1.1, 0],
    fov: 46,
  },
  "dolly-in": {
    label: "Dolly-In",
    description: "Kamera maju perlahan menuju punchline atau pengungkapan",
    position: [0, 1.9, 4.5],
    lookAt: [0, 1.5, 0],
    fov: 42,
  },
  pan: {
    label: "Pan",
    description: "Mengikuti gerakan atau menyapu area set",
    position: [-2.5, 2.4, 5.8],
    lookAt: [1.0, 1.3, 0],
    fov: 48,
  },
};

export function createDefaultBible(params: {
  name: string;
  theme: string;
  tone: string;
  visualStyle: "voxel-3d" | "cartoon-3d";
}): SeriesBible {
  const accentMap: Record<string, string> = {
    lucu: "#F97316",
    tegang: "#EF4444",
    heartwarming: "#10B981",
  };
  const accentColor = accentMap[params.tone] ?? "#F97316";

  return {
    premise: `Serial ${params.name} bertema ${params.theme} dengan gaya ${params.tone} dan karakter orisinal.`,
    world: {
      rules: [
        "Semua karakter punya batas energi harian",
        "Setiap aksi berdampak ke episode berikutnya",
      ],
      impossible: ["Karakter tidak bisa terbang tanpa alat dunia"],
      taboo: ["Tidak ada kekerasan sadis atau ejekan kasar"],
    },
    characters: [
      {
        id: "char-1",
        name: "Raka",
        role: "Protagonis utama",
        traits: ["penasaran", "ceroboh", "setia"],
        colorPrimary: accentColor,
        colorSkin: "#F5C6A5",
        colorPants: "#1E293B",
        colorHair: "#27272A",
        proportions: { headScale: 1.05, bodyHeight: 1.0, limbLength: 1.0 },
        voiceId: "id-ID-ArdiNeural",
        voicePitch: 2,
        voiceSpeed: 1.0,
        expression: "netral",
        accessory: "topi",
        catchphrase: "Sebentar, ini aneh banget!",
        forbidden: "Tidak pernah berbohong demi menjatuhkan teman",
      },
      {
        id: "char-2",
        name: "Sari",
        role: "Partner strategis",
        traits: ["cerdas", "tenang", "skeptis"],
        colorPrimary: "#3B82F6",
        colorSkin: "#F1C29B",
        colorPants: "#0F172A",
        colorHair: "#451A03",
        proportions: { headScale: 1.0, bodyHeight: 0.98, limbLength: 1.0 },
        voiceId: "id-ID-GadisNeural",
        voicePitch: 0,
        voiceSpeed: 1.0,
        expression: "mikir",
        accessory: "kacamata",
        catchphrase: "Baca dulu aturannya!",
        forbidden: "Tidak pernah panik tanpa rencana",
      },
    ],
    sets: [
      {
        id: "set-1",
        name: "Alun-alun Utama",
        template: "desa",
        mood: "hangat dan ramai",
        lighting: "siang",
        palette: ["#38BDF8", "#84CC16", "#F59E0B", "#E2E8F0"],
        props: [
          {
            id: "prop-1",
            kind: "pohon",
            name: "Pohon Voxel",
            position: [-3.2, 0, -2.5],
            rotationY: 0,
            scale: 1.1,
          },
          {
            id: "prop-2",
            kind: "rumah",
            name: "Pondok Kayu",
            position: [3.4, 0, -3.5],
            rotationY: -0.4,
            scale: 1.0,
          },
        ],
      },
    ],
    visualStyle: {
      palette: [accentColor, "#3B82F6", "#10B981", "#FACC15"],
      captionFont: "Inter",
      cameraDefault: "medium",
      accentColor,
      emoji: params.visualStyle === "voxel-3d" ? "🧱" : "🎭",
    },
    continuity: {
      summary: "Serial baru dimulai. Semua karakter berada di lokasi awal.",
      activeCliffhanger: "",
      threads: [],
      characterStates: {},
    },
    neverDo: [
      "Jangan mulai video dengan sapaan generik 'halo guys'",
      "Jangan copy adegan atau naskah kreator lain",
      "Jangan ubah warna/proporsi karakter tanpa update Bible",
    ],
    changelog: [
      {
        date: new Date().toISOString().slice(0, 10),
        version: 1,
        change: "Inisialisasi Series Bible",
        reason: "Pembuatan series baru",
      },
    ],
  };
}

export function validateAndBumpBible(params: {
  nextBible: unknown;
  currentVersion: number;
  changeNote?: string;
  reason?: string;
}): { ok: true; bible: SeriesBible; nextVersion: number } | { ok: false; error: string } {
  const parsed = SeriesBibleSchema.safeParse(params.nextBible);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message || "Format Series Bible tidak valid",
    };
  }

  for (const ch of parsed.data.characters) {
    if (!ch.colorPrimary || !ch.voiceId) {
      return {
        ok: false,
        error: `Karakter "${ch.name}" wajib memiliki warna utama dan suara (voiceId).`,
      };
    }
  }

  for (const s of parsed.data.sets) {
    if (!s.lighting) {
      return {
        ok: false,
        error: `Set "${s.name}" wajib memiliki preset lighting.`,
      };
    }
  }

  const nextVersion = params.currentVersion + 1;
  const changelog = [...(parsed.data.changelog ?? [])];
  changelog.unshift({
    date: new Date().toISOString().slice(0, 10),
    version: nextVersion,
    change: params.changeNote || "Pembaruan Series Bible",
    reason: params.reason || "Disimpan oleh kreator",
  });

  return {
    ok: true,
    bible: {
      ...parsed.data,
      changelog: changelog.slice(0, 30),
    },
    nextVersion,
  };
}

export function buildDefaultShotsFromLines(
  lines: ScriptLine[],
  lineTimings: Array<{ lineId: string; startFrame: number; endFrame: number }>
): ShotItem[] {
  const sequence: ShotItem["shot"][] = [
    "wide",
    "medium",
    "over-shoulder",
    "dolly-in",
    "close-up",
    "low-angle",
    "pan",
    "close-up",
  ];

  return lines.map((line, index) => {
    const timing = lineTimings.find((t) => t.lineId === line.id);
    const startFrame = timing?.startFrame ?? index * 90;
    const endFrame = timing?.endFrame ?? (index + 1) * 90;

    let shot: ShotItem["shot"] = sequence[index % sequence.length];
    if (line.beat === "hook") shot = "dolly-in";
    else if (line.beat === "twist" || line.beat === "payoff") shot = "close-up";
    else if (index === 1) shot = "wide";

    const preset = SHOT_HINTS[shot];
    return {
      id: `shot-${index + 1}`,
      lineId: line.id,
      shot,
      startFrame,
      endFrame: Math.max(startFrame + 1, endFrame),
      camera: {
        position: [...preset.position] as [number, number, number],
        lookAt: [...preset.lookAt] as [number, number, number],
        fov: preset.fov,
      },
      transition: "cut",
      note: `${(line.beat ?? "setup").toUpperCase()} — ${line.speaker}`,
    };
  });
}

export function validateShotList(shots: ShotItem[], fps = 30): string[] {
  const warnings: string[] = [];
  if (shots.length === 0) {
    warnings.push("Shot list masih kosong.");
    return warnings;
  }

  let hasCloseUp = false;
  for (let i = 0; i < shots.length; i++) {
    const cur = shots[i];
    if (cur.shot === "close-up") hasCloseUp = true;

    const durSec = (cur.endFrame - cur.startFrame) / fps;
    if (durSec > 8 && cur.shot !== "dolly-in" && cur.shot !== "pan") {
      warnings.push(
        `Shot #${i + 1} (${cur.shot}) berdurasi ${durSec.toFixed(1)} dtk (>8 dtk) tanpa gerakan kamera.`
      );
    }

    if (i > 0) {
      const prev = shots[i - 1];
      const samePos =
        prev.shot === cur.shot &&
        prev.camera.position.every((v, idx) => Math.abs(v - cur.camera.position[idx]) < 0.05);
      if (samePos) {
        warnings.push(
          `Shot #${i} dan #${i + 1} memakai sudut kamera (${cur.shot}) yang sama persis berturut-turut.`
        );
      }
    }
  }

  if (!hasCloseUp) {
    warnings.push(
      "Belum ada shot close-up sama sekali. Momen twist atau payoff sangat disarankan memakai close-up."
    );
  }

  return warnings;
}
