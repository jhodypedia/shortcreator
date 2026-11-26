import { BulkOutlineItem, ScriptLine, ScriptLineSchema, SeriesBible } from "./schemas";
import { inferActionFromText } from "./stageDirector";
import { runAiRole } from "./ai/runner";
import { estimateLineDuration } from "./timing";
import { ContinuitySnapshot } from "./continuity";

export interface HookIdea {
  hook: string;
  conflict: string;
  twist: string;
  payoff: string;
  cliffhanger: string;
}

async function configuredAiText(role: "bibleWriter" | "scriptwriter", input: Record<string, unknown>): Promise<string> {
  const { data } = await runAiRole(role, input);
  return JSON.stringify(data);
}

function extractJsonBlock<T>(raw: string): T | null {
  try {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : raw;
    const firstBracket = candidate.search(/[\[{]/);
    if (firstBracket === -1) return null;
    return JSON.parse(candidate.slice(firstBracket)) as T;
  } catch {
    return null;
  }
}

export async function generateHookIdeas(params: {
  seriesName: string;
  tone: string;
  bible: SeriesBible;
  continuity?: ContinuitySnapshot | null;
}): Promise<{ ideas: HookIdea[]; source: "ai" | "template" }> {
  const c1 = params.bible.characters[0]?.name ?? "Raka";
  const c2 = params.bible.characters[1]?.name ?? c1;
  const set1 = params.bible.sets[0]?.name ?? "Alun-alun";
  const activeCliff = params.continuity?.activeCliffhanger;

  const prompt = `Series: ${params.seriesName} (tone: ${params.tone})
Premise: ${params.bible.premise}
Karakter: ${params.bible.characters.map((c) => `${c.name} (${c.role})`).join(", ")}
Set tersedia: ${params.bible.sets.map((s) => s.name).join(", ")}
${activeCliff ? `WAJIB melanjutkan cliffhanger: ${activeCliff}` : ""}
Buat tepat 3 ide episode baru dalam JSON array dengan key: hook, conflict, twist, payoff, cliffhanger.`;

  let aiRaw = "";
  try { aiRaw = await configuredAiText("bibleWriter", { idea: prompt }); } catch (error) { throw new Error(`Gagal menghasilkan ide episode: ${error instanceof Error ? error.message : String(error)}`); }
  if (aiRaw) {
    const parsed = extractJsonBlock<HookIdea[]>(aiRaw);
    if (Array.isArray(parsed) && parsed.length >= 1) {
      return { ideas: parsed.slice(0, 3), source: "ai" };
    }
  }

  // Fallback lokal deterministik & orisinal
  const ideas: HookIdea[] = [
    {
      hook: activeCliff
        ? `${c1} akhirnya membuka misteri "${activeCliff.slice(0, 36)}" dan kaget melihat isinya!`
        : `Jangan pernah sentuh kotak biru di ${set1}, kecuali mau kejadian ini!`,
      conflict: `${c1} melanggar aturan kecil demi membuktikan teori, membuat ${c2} panik mengejar sebelum waktu habis.`,
      twist: `Ternyata benda itu bukan jebakan, melainkan kunci rahasia yang menunjuk ke nama ${c2} sendiri.`,
      payoff: `${c1} sadar aturan dibuat bukan untuk menakuti, tapi menjaga keseimbangan ${set1}.`,
      cliffhanger: `Sebuah tanda cahaya baru muncul di balik pintu tua ${set1}.`,
    },
    {
      hook: `${c2} baru sadar satu blok di ${set1} diam-diam bergerak sendiri setiap jam 12!`,
      conflict: `${c1} mencoba menahannya dengan alat seadanya, tapi blok itu malah menggandakan diri.`,
      twist: `Blok yang bergerak ternyata sedang mencoba memberi pesan darurat tentang penghuni bawah tanah.`,
      payoff: `Mereka berhenti melawan dan mulai membaca pola gerak blok itu bersama-sama.`,
      cliffhanger: `Pola blok membentuk peta menuju koordinat terlarang di luar desa.`,
    },
    {
      hook: `Cuma butuh 3 detik untuk bikin seluruh warga ${set1} panik gara-gara ${c1}!`,
      conflict: `${c1} salah menukar ramuan proyek ${c2}, sehingga suara semua orang jadi tertukar.`,
      twist: `Justru dengan suara tertukar itu, mereka tidak sengaja membongkar penyusup yang pura-pura bisu.`,
      payoff: `Efeknya hilang tepat waktu, tapi semua kini curiga ada tamu tak diundang.`,
      cliffhanger: `Si penyusup menjatuhkan lencana berukir lambang serial ini sebelum kabur.`,
    },
  ];

  return { ideas, source: "template" };
}

export async function generateScriptLines(params: {
  seriesName: string;
  tone: string;
  bible: SeriesBible;
  title: string;
  hook: string;
  conflict: string;
  twist: string;
  payoff?: string;
  cliffhanger: string;
  cliffhangerFrom?: string | null;
}): Promise<{ lines: ScriptLine[]; source: "ai" | "template" }> {
  const c1 = params.bible.characters[0]?.name ?? "Raka";
  const c2 = params.bible.characters[1]?.name ?? c1;
  const setId = params.bible.sets[0]?.id ?? "set-1";

  const prompt = `Judul: ${params.title}
Karakter tersedia: ${params.bible.characters.map((c) => c.name).join(", ")}
${params.cliffhangerFrom ? `Menjawab cliffhanger lalu: ${params.cliffhangerFrom}` : ""}
Hook: ${params.hook}
Konflik: ${params.conflict}
Twist: ${params.twist}
Payoff: ${params.payoff ?? "Kesadaran baru + ajakan lanjut"}
Cliffhanger baru: ${params.cliffhanger}
Buat 7 sampai 8 baris dialog singkat (masing-masing <= 10 kata), serta blocking yang masuk akal dan posisi berbeda sepanjang adegan. ` +
    `JSON item wajib: {beat,speaker,text,emotion,action,actionTarget,prop,moveTo,lookAt,sfx,reactions}.`;

  let aiRaw = "";
  try { aiRaw = await configuredAiText("scriptwriter", { idea: prompt, bible: params.bible }); } catch (error) { throw new Error(`Gagal menghasilkan naskah: ${error instanceof Error ? error.message : String(error)}`); }
  if (aiRaw) {
    const parsed = extractJsonBlock<unknown>(aiRaw);
    if (Array.isArray(parsed) && parsed.length >= 4) {
      const validLines = parsed.map((raw, idx) => {
        const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const text = typeof item.text === "string" ? item.text.trim() : "";
        const guessedAction = inferActionFromText(text);
        return ScriptLineSchema.safeParse({
          id: `line-${idx + 1}`,
          beat: item.beat ?? (idx === 0 ? "hook" : idx === parsed.length - 1 ? "payoff" : "konflik"),
          speaker: item.speaker || (idx % 2 === 0 ? c1 : c2),
          text,
          emotion: item.emotion ?? "netral",
          durationSec: estimateLineDuration(text || "..."),
          setId,
          action: item.action || guessedAction || "talk",
          actionTarget: item.actionTarget ?? undefined,
          prop: item.prop ?? undefined,
          moveTo: item.moveTo ?? undefined,
          lookAt: item.lookAt ?? undefined,
          sfx: typeof item.sfx === "string" ? item.sfx : undefined,
          sfxPath: typeof item.sfxPath === "string" ? item.sfxPath : undefined,
          reactions: Array.isArray(item.reactions) ? item.reactions : [],
        });
      });
      if (validLines.every((line) => line.success)) {
        return { lines: validLines.map((line) => line.data), source: "ai" };
      }
    }
  }

  const rawDraft: Array<Omit<ScriptLine, "id" | "durationSec">> = [
    {
      beat: "hook",
      speaker: c1,
      text: params.hook.split(/\s+/).slice(0, 10).join(" "),
      emotion: "kaget",
      action: "surprised",
      moveTo: "tengah_jalan",
      setId,
    },
    {
      beat: "setup",
      speaker: c2,
      text: params.cliffhangerFrom
        ? `Soal ${params.cliffhangerFrom.split(/\s+/).slice(0, 6).join(" ")}, lihat ini!`
        : `${c1}, jangan dekati benda itu sebelum aku cek!`,
      emotion: "mikir",
      action: "point",
      moveTo: "counter",
      setId,
    },
    {
      beat: "konflik",
      speaker: c1,
      text: params.conflict.split(/\s+/).slice(0, 10).join(" "),
      emotion: "marah",
      action: inferActionFromText(params.conflict) ?? "slam_table",
      moveTo: "pintu",
      setId,
    },
    {
      beat: "konflik",
      speaker: c2,
      text: "Waktunya tinggal lima detik, kita harus putuskan sekarang!",
      emotion: "kaget",
      action: "walk",
      moveTo: "belakang_warung",
      setId,
    },
    {
      beat: "twist",
      speaker: c2,
      text: params.twist.split(/\s+/).slice(0, 10).join(" "),
      emotion: "kaget",
      action: inferActionFromText(params.twist) ?? "pick_up",
      moveTo: "tengah_jalan",
      setId,
    },
    {
      beat: "payoff",
      speaker: c1,
      text: `${params.cliffhanger.split(/\s+/).slice(0, 8).join(" ")}. Lanjut part berikutnya!`,
      emotion: "senang",
      action: "wave",
      moveTo: "counter",
      setId,
    },
  ];

  const lines: ScriptLine[] = rawDraft.map((item, idx) => ({
    ...item,
    id: `line-${idx + 1}`,
    durationSec: estimateLineDuration(item.text),
  }));

  return { lines, source: "template" };
}

export async function generateBulkOutlines(params: {
  seriesName: string;
  tone: string;
  bible: SeriesBible;
  fromEps: number;
  toEps: number;
  continuity?: ContinuitySnapshot | null;
}): Promise<{ outlines: BulkOutlineItem[]; source: "ai" | "template" }> {
  const count = Math.max(1, Math.min(20, params.toEps - params.fromEps + 1));
  const c1 = params.bible.characters[0]?.name ?? "Raka";
  const c2 = params.bible.characters[1]?.name ?? c1;
  const setNames = params.bible.sets.map((s) => s.name);
  const startCliff = params.continuity?.activeCliffhanger || "";

  const prompt = `Series: ${params.seriesName} (${params.tone})
Premise: ${params.bible.premise}
Karakter: ${params.bible.characters.map((c) => c.name).join(", ")}
Set: ${setNames.join(", ")}
Rentang Episode: ${params.fromEps} sampai ${params.toEps} (${count} episode).
${startCliff ? `Episode ${params.fromEps} WAJIB melanjutkan cliffhanger aktif: "${startCliff}"` : ""}
Format tiap item JSON: { "number": number, "title": string, "hook": string, "conflict": string, "twist": string, "cliffhanger": string, "cliffhangerFrom": string }.`;

  let aiRaw = "";
  try { aiRaw = await configuredAiText("scriptwriter", { idea: prompt, bible: params.bible }); } catch (error) { throw new Error(`Gagal menghasilkan outline: ${error instanceof Error ? error.message : String(error)}`); }
  if (aiRaw) {
    const parsed = extractJsonBlock<BulkOutlineItem[]>(aiRaw);
    if (Array.isArray(parsed) && parsed.length === count) {
      return {
        outlines: parsed.map((o, idx) => ({
          ...o,
          number: params.fromEps + idx,
          continuityChecked: true,
        })),
        source: "ai",
      };
    }
  }

  // Fallback lokal yang menjaga rantai continuity N -> N+1 secara ketat
  const outlines: BulkOutlineItem[] = [];
  let prevCliff = startCliff;

  const arcBeats = [
    {
      tema: "Jejak Cahaya Pertama",
      konflik: `${c1} menyentuh batu penanda dan memicu alarm kuno`,
      twist: `Alarm itu bukan bahaya, melainkan pesan suara dari penjaga lama`,
      nextCliff: "Pintu rahasia di balik air terjun terbuka perlahan",
    },
    {
      tema: "Peta di Balik Pintu",
      konflik: `${c2} menemukan lantai ruangan mulai bergeser saat mereka masuk`,
      twist: `Peta yang tergambar ternyata berubah sesuai langkah ${c1}`,
      nextCliff: "Sebuah kompas voxel berputar ke arah bayangan menara",
    },
    {
      tema: "Menara Tanpa Pintu",
      konflik: `Kompas mengarah ke menara tinggi yang tidak punya akses masuk`,
      twist: `Masuknya harus mundur sambil menutup mata sesuai aturan dunia`,
      nextCliff: "Di puncak menara ada dua cermin yang menampilkan masa depan",
    },
    {
      tema: "Cermin Pilihan Ganda",
      konflik: `${c1} dan ${c2} melihat bayangan berbeda di kedua cermin`,
      twist: `Bayangan itu bukan ramalan, melainkan rekaman keputusan mereka kemarin`,
      nextCliff: "Salah satu cermin retak dan menjatuhkan kunci perak",
    },
    {
      tema: "Kunci Perak Terakhir",
      konflik: `Kunci perak bereaksi panas tiap kali didekatkan ke gerbang desa`,
      twist: `Kunci itu ternyata penghenti waktu darurat, bukan pembuka harta`,
      nextCliff: "Jarum jam di alun-alun berhenti tepat di angka nol",
    },
  ];

  for (let i = 0; i < count; i++) {
    const epNum = params.fromEps + i;
    const beat = arcBeats[i % arcBeats.length];
    const loc = setNames[i % setNames.length] || "Alun-alun";

    const hook = prevCliff
      ? `Melanjutkan ${prevCliff.toLowerCase()}, ${c1} langsung terkejut di ${loc}!`
      : `Detik pertama di ${loc}, ${c1} menemukan petunjuk aneh yang menyala!`;

    const item: BulkOutlineItem = {
      number: epNum,
      title: `Eps ${epNum}: ${beat.tema}`,
      hook,
      conflict: `${beat.konflik} (Eps ${epNum})`,
      twist: `${beat.twist} — khusus bab ${epNum}`,
      cliffhanger: `${beat.nextCliff} (uji di Eps ${epNum + 1})`,
      cliffhangerFrom: prevCliff || undefined,
      continuityChecked: true,
    };

    outlines.push(item);
    prevCliff = item.cliffhanger;
  }

  return { outlines, source: "template" };
}
