# Short Generator (Three.js + Remotion + Next.js)

Web app lokal-pertama untuk memproduksi serial video vertikal **9:16 (1080×1920, 30 fps)** gaya **Voxel 3D / Kartun 3D** dengan alur kerja lengkap:

`Series Bible → Ide & Hook → Naskah → Voice Timing & Caption → Set & Karakter 3D → Kamera & Shot List → Preview Remotion Player → Render Antrean 1-per-1 (MP4) → Review 7 Poin → Publish Tracking`

Fitur unggulan:
- **Bulk All Episodes:** Susun outline bersambung `EPS A–B`, generate naskah massal berurutan, dan antrekan render 1-per-1 secara otomatis.
- **Mode Lanjutan (Continuity):** Episode baru otomatis membaca ringkasan cerita, perubahan karakter, dan cliffhanger aktif dari episode terakhir — tidak pernah reset ke nol.
- **Koneksi 9router / AI Router:** Konfigurasi endpoint `9router`, OpenAI-compatible, atau Anthropic lewat halaman **Settings** (disimpan terenkripsi di SQLite, tidak tampil penuh di UI).

---

## 1. Instalasi & Menjalankan (PC)

Pastikan sudah terpasang **Node.js 20+** dan **FFmpeg** di PC.

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Buka `http://localhost:3000`.
Saat `npm run dev` atau `npm run start` berjalan di PC, worker antrean render otomatis aktif setiap 5 detik. Untuk menjalankan worker secara terpisah:

```bash
npm run worker
```

---

## 2. Cara Render MP4 di PC

1. Buka episode dari daftar series → pastikan **Naskah**, **Voice & Timing** (audio TTS / upload VO + Hitung Timing), dan **Kamera & Shots** sudah lengkap (`status: ready`).
2. Di halaman **Preview** (`/episodes/[id]/preview`) atau **Bulk Wizard** (`/series/[id]/bulk`), klik **Masukkan ke Antrean** atau **Render Episode Ini Sekarang**.
3. Worker Remotion merender video `1080×1920, 30fps, H.264` secara **berurutan (1 per 1)** ke folder:
   `storage/renders/<nama-series>/ep-XXX.mp4`
4. Setelah render selesai, status menjadi **Perlu Review**. Lakukan checklist 7 poin di `/episodes/[id]/review` hingga lolos (**Done**) agar Series Bible otomatis ter-update.

> **Batasan perangkat:** Penulisan naskah, penyusunan bulk outline, dan pemantauan progress antrean dapat diakses penuh dari HP (iOS/Android), sedangkan proses render Three.js + Remotion dijalankan di PC/server karena membutuhkan Node.js, Chromium, dan FFmpeg.

---

## 3. Pengaturan 9router / AI & TTS

Buka `/settings`:
- **API Router (`9router`):** Pilih `9router (API Router)`, masukkan Base URL (mis. `http://localhost:20128/v1`), Model ID, dan API Key, lalu klik **Tes Koneksi 9router / AI**.
- **TTS:** Pilih `Edge-TTS` (gratis untuk `id-ID`), `OpenAI TTS`, `ElevenLabs`, atau `Lokal / Upload Rekaman Sendiri`.

---

## 4. Backup & Restore

Di halaman `/settings` bagian **Backup & Restore**:
- Klik **Export Semua Data (.zip)** untuk mengunduh arsip berisi `prisma/dev.db`, `backup-data.json`, dan seluruh `series-bible.json`.
- Gunakan **Import / Restore Backup (.zip)** untuk memulihkan data di PC yang sama atau PC baru.

---

## 5. Pengujian & Kualitas Kode

```bash
npm test        # Unit test Vitest (timing, continuity, bible & shot validation)
npm run typecheck
npm run lint
npm run build
```

### Arsitektur AI peran

Peran AI (`bibleWriter`, `characterDesigner`, `setDesigner`, `scriptwriter`, `director`, `critic`, `editor`) berada di `src/lib/ai/`. Prompt dan schema Zod input/output masing-masing didefinisikan di `roles.ts`. `runAiRole` mewajibkan JSON valid, menyertakan pesan validasi dalam maksimal dua retry, menggunakan model fallback, dan merekam input/output, token, status, durasi serta error di `AiRun`. Endpoint `/api/ai/run` mengirim event SSE `progress`, `result`, atau `error`. Model, fallback, suhu, dan batas biaya per episode disimpan pada AppSetting (default `ag/gemini-2.5-flash`). Jalankan migrasi Prisma setelah mengambil perubahan. Tambah peran dengan melengkapi type/default/schema lalu integrasikan pada workflow/UI; tambah primitif set melalui whitelist SetSpec dan renderer. Set dibatasi 150 objek.

### Animasi Remotion deterministik

Semua gerak scene berasal dari `useCurrentFrame()` dan fps; jangan memakai `useFrame`, jam sistem, timer, atau random tanpa seed di komponen render. Aksi yang didukung: `idle`, `walk`, `talk`, `point`, `wave`, `nod`, `shake_head`, `surprised`, `laugh`, `slam_table`, `drop_item`, `pick_up`, `hand_over`, `think`, `angry`, `turn_to`. Shot: `wide`, `medium`, `close-up`, `over-shoulder`, `low-angle`, `high-angle`, `dolly-in`, `pan`.

Tambahkan set di Bible (`sets[]`) dengan `id`, `template`, palette dan prop placement; renderer memilih `setId` tiap beat. Prop scene dapat dibuat sebagai mesh box pada `VoxelSetScene` atau prop tangan dalam `VoxelCharacter`. Jaga objek low-poly/box dan gunakan koordinat deterministik. Editor menyimpan aksi, `moveTo` serta prop pada setiap beat.

Series seed **Warung Pak Blokir** dan contoh episode Korek Sepuluh Biji dibuat lewat `npm run seed`. 45 detik uji render low-resolution: `EPISODE_ID=<id> npm run render-test`; file ukurannya disimpan ke `storage/renders/test`.

Caption word-level ditampilkan di sekitar 70–78% tinggi frame, paling banyak delapan kata/two rows per segment, dengan pembicara terpisah di atasnya. BGM (jika ditambahkan) duck saat dialog, SFX aksi pakai aset bebas lisensi di `public/sfx` atau marker eksplisit.

## 6. UI Studio Kreator (mobile-first)

Design tokens studio voxel ada terpusat di `src/app/design-tokens.css`: emerald sebagai aksi utama, kuning senja untuk highlight AI, radius 10–20px, serta tempo/easing animasi. Primitive mobile bersama ada di `src/components/ui/studio-primitives.tsx` (bottom sheet, tab geser, empty state, progress ring, tombol AI). Gunakan target sentuh minimal 44px, safe-area `safe-top`/`safe-bottom`, state focus-visible, dan animasikan hanya transform/opacity untuk interaksi umum. CSS mendukung `prefers-reduced-motion`. Hindari efek blur berlapis dan lazy-load/pratinjau 3D hanya saat dibutuhkan.

Tes browser mobile: `npm run test:e2e` (Playwright, viewport iPhone 390px). Screenshot baseline ada di `docs/screens/setup-390x844.png`.
