---
name: short-generator
description: "Buat Shorts / video vertikal 9:16 dari NOL dengan Three.js + Remotion — naskah, voice timing, set, kamera, animasi, render lokal, review hasil, sampai bulk & lanjutan episode. Pakai skill ini SETIAP kali user minta bikin Short, video pendek, animasi Minecraft / kartun 3D, series bersambung, bulk episode, atau web/app short-generator, walau user tidak menyebut nama skill ini. Bukan AI video generator, bukan stock footage — semua di-render dari kode di PC lokal."
---

# Short Generator — Three.js + Remotion

Skill untuk membuat Shorts (YouTube Shorts / TikTok / Reels) yang **orisinal, transformatif, dan autentik**, dengan cara kerja seperti di postingan Fahni Az Zikri (YouTubers Indonesia, 25 Nov 2026 — 455,8K engaged views, +904 subscriber dari 1 short):

> Claude bantu dari **naskah → voice timing → set → kamera → review hasil**.
> Semua di-render di PC rumahan pakai **Three.js + Remotion**.
> **Bukan AI video generator, bukan stock footage.**

## 0. Prinsip yang tidak boleh dilanggar

1. **No copy content.** Jangan jiplak naskah, adegan, dialog, karakter, atau musik orang lain. Jangan remake 1:1 video viral. Ambil *pola* (mis. struktur hook), bukan *isi*.
2. **Transformatif.** Setiap episode harus mengubah ide jadi sesuatu yang baru: sudut pandang baru, twist baru, pelajaran baru, atau kombinasi yang belum ada.
3. **Be authentic.** Suara, humor, dan gaya harus suara kreator sendiri — bukan meniru gaya kreator lain mentah-mentah. Kalau user punya gaya khas, pertahankan di Series Bible.
4. **Render dari kode, bukan generate video.** Semua visual = scene Three.js (voxel / kartun 3D) + komposisi Remotion. Dilarang memakai AI video generator (Sora / Veo / Runway / sejenis) dan dilarang memakai stock footage sebagai isi utama. AI image hanya boleh untuk *referensi* moodboard, bukan frame final.
5. **Jangan pakai aset IP orang lain.** Gaya voxel ala Minecraft boleh, tapi karakter, nama, skin, tekstur, dan logo harus buatan sendiri. Jangan pakai aset Mojang, Nintendo, Disney, dsb. Jangan pakai musik ber-copyright — pakai SFX / musik bebas lisensi atau buat sendiri (WebAudio / Tone.js).
6. **Satu kebenaran visual.** Karakter, warna, proporsi, dan dunia harus konsisten antar episode. Yang mengunci itu adalah `series-bible.json` — bukan ingatan.

## 1. Kapan skill ini dipakai

Pakai skill ini bila user minta salah satu dari ini:

- "buatkan short", "bikin video pendek", "bikin animasi Minecraft / kartun 3D"
- "lanjut episode X", "bulk semua episode", "generate all eps", "series bersambung"
- "buatkan web short generator", "buatkan PROMPT.md short generator"
- "perbaiki short ini", "review hasil render", "kenapa short ini sepi"
- "buatkan naskah + voice timing + set + kamera untuk short"

Jangan pakai skill ini untuk: video AI generate, edit video footage asli (itu kerjaan editor video, bukan skill ini), atau thumbnail saja tanpa video.

## 2. Input yang wajib ditanyakan (sekali, jangan bertele-tele)

Kalau belum ada, tanyakan dalam SATU pesan, dengan default yang masuk akal:

| Input | Default bila user tidak jawab |
|---|---|
| Seri / tema | Tanya: tema + target penonton (anak / remaja / umum) |
| Gaya visual | `voxel-3d` (Minecraft-style, orisinal) atau `cartoon-3d` (kartun 3D halus) |
| Durasi | `30 detik` (range Shorts: 15–60 dtk) |
| Bahasa & voice | `id-ID`, TTS / voice-over sendiri |
| Jumlah episode | `1` — atau `bulk: EPS 1–N` bila user minta bulk |
| Lanjutan dari | `episode terakhir di series-bible.json` (bila ada) |
| Tone | lucu / menegangkan / heartwarming — pilih 1 |

Jangan mulai render sebelum Series Bible + naskah episode disetujui user (atau user bilang "gas").

## 3. Struktur proyek (wajib diikuti)

```
shorts/<nama-seri>/
  series-bible.json          # SATU sumber kebenaran: dunia, karakter, gaya, aturan
  episodes/
    ep-001.json              # naskah + timing + set + kamera (satu file per episode)
    ep-002.json
    ...
  assets/
    characters/<nama>/       # model / rig / warna per karakter
    sets/<nama-set>/         # scene Three.js per set
    audio/sfx/  audio/music/ # hanya bebas lisensi / buatan sendiri
  src/
    scenes/                  # komponen Three.js per set
    characters/              # komponen karakter
    compositions/            # komposisi Remotion
  renders/
    ep-001.mp4  ep-001-review.md
  bulk-queue.json            # antrean bulk: status tiap episode
```

Bila proyeknya adalah **web Next.js Short Generator** (bukan satu video), struktur web-nya mengikuti `PROMPT.md` di folder yang sama — skill ini yang mengatur *isi / workflow* videonya, PROMPT.md yang mengatur *aplikasi web*-nya.

## 4. Workflow — 9 langkah, jangan dilompati

### Langkah 1 — Series Bible (sekali per seri, lalu dikunci)

Buat `series-bible.json` dari template di `references/series-bible-template.md`. Isinya minimal:

- `premise` (1 kalimat), `audience`, `tone`, `language`
- `world`: aturan dunia (fisika, hal yang mustahil, hal yang tabu)
- `characters[]`: tiap karakter = nama, peran, sifat 3 kata, warna utama, proporsi, suara, catchphrase, hal yang TIDAK BOLEH dilakukan karakter itu
- `sets[]`: tiap set = nama, mood, lighting, palette, props kunci
- `visualStyle`: voxel / cartoon-3d, palette global, font caption, gaya kamera
- `continuity`: apa yang sudah terjadi, cliffhanger terakhir, benang merah
- `neverDo[]`: daftar larangan spesifik seri ini

Setelah user setuju, Bible **dikunci**. Perubahan Bible = versi baru (`bibleVersion + 1`) + dicatat alasannya. Jangan ubah karakter/set diam-diam di tengah episode.

### Langkah 2 — Ide & hook (3 ide, pilih 1)

Untuk tiap episode, tawarkan 3 ide dalam format: `Hook 0–3 dtk | Konflik | Twist | Payoff`.
Hook harus bisa diucapkan dalam 3 detik dan bisa divisualkan dalam 1 shot.
Tolak ide yang: jiplakan, tidak bisa divisualkan dengan set yang ada, atau butuh karakter/aset baru yang besar tanpa alasan.

### Langkah 3 — Naskah Short (struktur baku)

Durasi target 15–60 detik. Struktur baku:

```
0:00–0:03  HOOK — kalimat / visual paling kuat, tanpa intro "halo guys"
0:03–0:10  SETUP — siapa, di mana, masalahnya apa (1 kalimat per beat)
0:10–0:75  KONFLIK / ESKALASI — 2–3 beat, tiap beat menaikkan taruhan
0:75–0:90  TWIST — hal yang penonton tidak duga, tapi masuk akal dari Bible
0:90–akhir PAYOFF + CTA — punchline / pelajaran + ajakan (subscribe / lanjut ep berikut)
```

Aturan naskah:

- 1 baris dialog = 1 beat = 1 shot. Jangan 1 baris panjang untuk 3 shot.
- Bahasa lisan, bukan bahasa tulisan. Baca keras-keras: kalau tersendat, potong.
- Tiap episode selesai sendiri (ada payoff), TAPI sisakan 1 benang untuk episode berikut (cliffhanger ringan / pertanyaan terbuka). Ini yang membuat orang nonton lanjutan.
- Tulis naskah sebagai `lines[]` dengan `speaker`, `text`, `emotion`, `durationSec` — lihat `references/episode-template.json`.

### Langkah 4 — Voice timing (ini yang membedakan amatir vs pro)

Buat `voiceTiming` per episode — JANGAN asal tempel audio ke video:

1. Hitung durasi tiap line: `kata × 0,35–0,45 dtk` (id-ID, tempo normal) — lalu ukur dari audio TTS / VO asli dan ganti dengan angka riil.
2. Buat `captions[]` word-level: `{ word, startFrame, endFrame }`. Caption muncul kata-per-kata (karaoke-style), bukan satu blok kalimat.
3. Jeda = bagian dari naskah: `pause 0,3–0,6 dtk` sebelum punchline, `pause 0,8 dtk` sebelum twist. Jangan isi jeda dengan musik keras.
4. SFX diletakkan di frame yang sama dengan aksi visual (pukulan, pintu, ledakan) — bukan asal di tengah.
5. Validasi: total durasi audio ≤ durasi video. Kalau audio lebih panjang, potong kata — jangan dipercepat audionya sampai cempreng.

Template & cara hitung ada di `references/voice-timing-template.md`.

### Langkah 5 — Set & karakter (bangun sekali, pakai ulang)

- **Set:** 1 set = 1 komponen Three.js di `src/scenes/<Set>.tsx`. Lighting dikunci per set (jangan ganti mood tiap episode). Props yang bisa dipakai ulang dipisah jadi komponen.
- **Karakter:** 1 karakter = 1 rig sederhana (kepala, badan, tangan, kaki + ekspresi: mata, mulut, alis). Ekspresi minimal: netral, senang, kaget, sedih, marah, mikir. Jangan bikin karakter baru untuk 1 lelucon — pakai karakter yang ada dengan ekspresi/props baru.
- **Konsistensi:** warna kulit / baju / rambut diambil dari `series-bible.json`, bukan di-hardcode di scene. Kalau Bible bilang baju merah, semua scene harus merah.

### Langkah 6 — Kamera (shot list, bukan asal rekam)

Tiap beat = 1 shot dari daftar baku ini. Pilih dengan sengaja:

| Shot | Kapan dipakai |
|---|---|
| `wide` | Buka set, tunjukkan dunia / lokasi baru |
| `medium` | Dialog normal, 2 karakter |
| `close-up` | Reaksi emosi, punchline, twist |
| `over-shoulder` | Konfrontasi / dialog tegang |
| `low-angle` | Karakter terlihat kuat / mengancam |
| `high-angle` | Karakter terlihat kecil / kalah |
| `dolly-in` | Menuju punchline / pengungkapan |
| `pan` | Mengikuti gerakan / mengungkapkan sesuatu |

Aturan: ganti shot tiap beat (jangan 10 detik 1 angle), jangan potong di tengah kata, close-up hanya untuk momen yang memang penting — kalau semua close-up, tidak ada yang spesial.

Tulis shot list di `ep-XXX.json` sebagai `shots[]`: `{ shot, startFrame, endFrame, camera: { position, lookAt, fov }, note }`.

### Langkah 7 — Animasi Three.js (gerakan secukupnya, tapi hidup)

- Gerak Remotion wajib deterministik dari `useCurrentFrame()` dan fps; jangan gunakan `useFrame`, `Date.now`, timer, atau `Math.random` tanpa seed. Gerakan dipetakan oleh start/end frame dan easing.
- Idle animation selalu ada: napas (skala dada ±2%), kedip mata tiap 3–5 dtk, kepala mengikuti lawan bicara.
- Gerakan bicara: mulut buka-tutup mengikuti `captions[]` (bukan asal mangap). Kalau tidak ada lip-sync penuh, pakai buka-tutup sederhana sinkron kata.
- Jangan over-animasi: 2–3 gerakan bermakna per beat lebih bagus daripada 10 gerakan sibuk.
- Referensi teknis Three.js: baca skill `threejs-fundamentals`, `threejs-animation`, `threejs-lighting` bila perlu detail scene / cahaya.

Daftar aksi yang tersedia: `idle`, `walk`, `talk`, `point`, `wave`, `nod`, `shake_head`, `surprised`, `laugh`, `slam_table`, `drop_item`, `pick_up`, `hand_over`, `think`, `angry`, `turn_to`. Aksi beat memakai frame lokal dan blend transisi 8 frame. Kamera wajib guard framing 9:16, mengikuti pembicara; shot editor mengalahkan directed fallback. Shot baku: `wide`, `medium`, `close-up`, `over-shoulder`, `low-angle`, `high-angle`, `dolly-in`, `pan`.

Set dan prop didefinisikan di Bible `sets[]` / `props[]`, dipilih per `setId`; scene set khusus dibuat sebagai komponen di `src/remotion/scenes`, prop tangan sebagai mesh berbiaya rendah di rig karakter. Default seed Warung Pak Blokir ada di `prisma/seed.ts`. Pertahankan mesh rendah dan warna/proporsi dari Bible.

### Langkah 8 — Komposisi Remotion (rakit jadi video)

- Komposisi: `1080×1920`, `30 fps`, durasi = `totalFrames` dari naskah + timing.
- Struktur: `<ShortComposition>` → `<Scene3D>` (Canvas Three.js) + `<Captions>` + `<SFXLayer>` + `<SafeAreaGuide>` (saat preview saja).
- Safe area: teks & elemen penting di dalam 1080×1420 tengah — jangan taruh teks di 250px atas / bawah (ketutup UI Shorts).
- Caption word-level: font tebal, outline/background, maksimal dua baris, kata aktif di-highlight dan berada sekitar 70–78% tinggi layar; label pembicara di atas caption.
- Preview dulu di Remotion Studio sebelum render final. Render final: `npx remotion render <Comp> <out>.mp4` — jangan render ulang tanpa alasan; 1 render final per episode, plus render ulang hanya bila review menemukan cacat.

### Langkah 9 — Review hasil (Claude ikut review, seperti di post)

Sebelum episode dinyatakan selesai, isi `renders/ep-XXX-review.md` dengan checklist di `references/review-checklist.md`. Minimal cek:

1. Hook 3 detik pertama — apakah orang asing paham & penasaran tanpa konteks?
2. Audio vs visual sinkron? Caption kata-per-kata tepat?
3. Karakter / set konsisten dengan Bible?
4. Ada shot yang diam terlalu lama / potongan yang membingungkan?
5. Ada yang jiplak / mirip video orang lain? Kalau ya, ubah.
6. Tonton tanpa suara: apakah cerita tetap kebaca dari visual + caption?
7. Tonton hanya suara: apakah cerita tetap kebaca tanpa visual?

Kalau ada 1 jawaban "tidak", perbaiki dan render ulang bagian itu. Jangan submit / upload episode yang gagal review.

## 5. Bulk & lanjutan episode (mode yang user minta)

### Mode bulk: `bulk: EPS A–B`

1. Tulis / setujui **outline semua episode dulu** (1 baris per episode: hook + twist + cliffhanger) sebelum render episode manapun. Ini mencegah episode 5 bertabrakan dengan episode 2.
2. Buat `bulk-queue.json`: `{ episode, status: queued|script|timing|rendering|review|done|failed, attempts, lastError }`.
3. Kerjakan berurutan, bukan paralel render: naskah boleh batch, **render jalan 1 per 1** (Remotion + Three.js rakus CPU/GPU; paralel render = crash / frame rusak).
4. Tiap episode selesai → update `series-bible.json > continuity` (apa yang terjadi, cliffhanger baru) SEBELUM mulai episode berikut. Episode berikut WAJIB membaca continuity terbaru.
5. Bila 1 episode gagal review 2×, STOP antrean, laporkan ke user, jangan lanjut render episode berikut dengan cacat yang sama.
6. Laporan bulk: tabel `ep | durasi | hook | status | file mp4` di akhir.

### Mode lanjutan: `lanjut ep berikutnya`

1. Baca `series-bible.json` + `ep-terakhir.json` + `renders/ep-terakhir-review.md`.
2. Ringkas dalam 3 baris: apa yang sudah terjadi, cliffhanger apa yang menggantung, karakter mana yang berubah.
3. Episode baru WAJIB: menjawab / melanjutkan cliffhanger itu (atau sengaja menundanya dengan alasan yang dicatat), dan menyisakan cliffhanger baru.
4. Jangan reset karakter / hubungan ke nol. Jangan bikin episode yang bisa ditukar urutannya dengan episode lain tanpa terasa — kalau bisa, itu bukan lanjutan, itu episode lepas.

## 6. Output yang dihasilkan skill ini

Tergantung perintah user, hasilkan salah satu / gabungan:

- **1 episode:** `ep-XXX.json` + scene/karakter baru (bila perlu) + `renders/ep-XXX.mp4` + `renders/ep-XXX-review.md`
- **Bulk:** outline semua episode + `bulk-queue.json` + semua file di atas per episode + laporan bulk
- **Web generator:** ikuti `PROMPT.md` di folder yang sama (bukan skill ini yang menulis kode web-nya — skill ini memastikan workflow video di dalam web itu benar)

Selalu akhiri dengan ringkasan pendek: apa yang dibuat, durasi, file-nya di mana, dan 1 hal yang perlu user putuskan berikutnya.

## 7. Contoh perintah & respons yang diharapkan

### Arsitektur AI aplikasi

Aplikasi mendefinisikan peran (`bibleWriter`, `characterDesigner`, `setDesigner`, `scriptwriter`, `director`, `critic`, `editor`) di `src/lib/ai/`. Prompt dan schema Zod tiap peran ada di `roles.ts`. Output harus JSON valid, maksimal dua retry dengan error validasi, dan run tercatat pada `AiRun`; `/api/ai/run` menyiarkan progres via SSE. Tambah peran dengan melengkapi type/default/schema serta integrasi workflow. Tambah primitif dengan mengubah whitelist SetSpec dan renderer set.

### Design system studio kreator

Gunakan tokens terpusat di `src/app/design-tokens.css`, primitive `src/components/ui/studio-primitives.tsx`, warna emerald untuk aksi dan kuning senja untuk state AI. UI harus mobile-first, target sentuh ≥44px, aman terhadap safe-area iOS, fokus keyboard terlihat, serta menghormati `prefers-reduced-motion`. Animasi UI umum hanya transform/opacity; jangan animasikan layout/blur berat. Tab strip horizontal harus memakai auto-scroll ke tab aktif; sheet dipakai untuk editor kontekstual di layar sempit.

**User:** "Buatkan short Minecraft episode 1, tema: Steve menemukan desa kosong"
→ Buat / update Bible → 3 ide hook → minta pilih / langsung gas bila user bilang gas → naskah + timing + shot list → scene + komposisi → preview → render → review → serahkan mp4 + review.

**User:** "Bulk eps 1–10, lanjutkan seri yang kemarin"
→ Baca Bible + ep terakhir → outline 10 episode → minta user setujui outline → kerjakan berurutan dengan update continuity tiap episode → laporan bulk.

**User:** "Buatkan web Next.js short generator-nya"
→ Jangan tulis kode web di sini. Buka `PROMPT.md` di folder yang sama dan jalankan prompt itu (atau serahkan file PROMPT.md ke builder). Skill ini hanya memastikan fitur video di dalamnya (bulk, lanjutan, voice timing, render queue) sesuai workflow di atas.

## 8. Batasan

- Skill ini TIDAK menjanjikan viral / views / subscriber. Postingan contoh (455K views) adalah 1 hasil, bukan jaminan.
- Skill ini TIDAK bisa generate video dari AI video generator — dan memang tidak boleh.
- Render butuh PC dengan Node + Remotion + (opsional) GPU. Di HP hanya bisa naskah / review / antrean — render tetap di PC / VPS.
- Jangan klaim episode "selesai" sebelum review checklist terisi dan mp4 final ada.
