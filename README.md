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
