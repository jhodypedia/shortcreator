"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  KeyRound,
  PlugZap,
  Save,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { AiProviderType, AppSettingsData, TtsProviderType } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getMotionPreference, setMotionPreference, subscribeMotionPreference, type MotionPreference } from "@/lib/device-performance";

export function SettingsClient({
  initialSettings,
}: {
  initialSettings: AppSettingsData;
}) {
  const router = useRouter();
  const motionPreference = useSyncExternalStore(subscribeMotionPreference, getMotionPreference, () => "system" as MotionPreference);

  // AI / 9router state
  const [aiProvider, setAiProvider] = useState<AiProviderType>(initialSettings.ai.provider);
  const [aiBaseUrl, setAiBaseUrl] = useState(initialSettings.ai.baseUrl);
  const [aiModel, setAiModel] = useState(initialSettings.ai.model);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiKeyInfo, setAiKeyInfo] = useState({
    has: initialSettings.ai.hasApiKey,
    masked: initialSettings.ai.maskedApiKey,
  });
  const [testingAi, setTestingAi] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [roleSettings, setRoleSettings] = useState(initialSettings.ai.roles);
  const [maxCost, setMaxCost] = useState(initialSettings.ai.maxCostPerEpisodeUsd);
  const [promptSettings, setPromptSettings] = useState(initialSettings.prompts);
  const [generationSettings, setGenerationSettings] = useState(initialSettings.generation);

  // TTS state
  const [ttsProvider, setTtsProvider] = useState<TtsProviderType>(initialSettings.tts.provider);
  const [ttsModel, setTtsModel] = useState(initialSettings.tts.model);
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsKeyInfo, setTtsKeyInfo] = useState({
    has: initialSettings.tts.hasApiKey,
    masked: initialSettings.tts.maskedApiKey,
  });
  const [defaultVoiceId, setDefaultVoiceId] = useState(initialSettings.tts.defaultVoiceId);
  const [defaultSpeed, setDefaultSpeed] = useState(initialSettings.tts.defaultSpeed);
  const [defaultPitch, setDefaultPitch] = useState(initialSettings.tts.defaultPitch);

  // Render state
  const [outputDir, setOutputDir] = useState(initialSettings.render.outputDir);
  const [fps, setFps] = useState(initialSettings.render.fps);
  const [width, setWidth] = useState(initialSettings.render.width);
  const [height, setHeight] = useState(initialSettings.render.height);
  const [maxRetries, setMaxRetries] = useState(initialSettings.render.maxRetries);
  const [ffmpegPath, setFfmpegPath] = useState(initialSettings.render.ffmpegPath);
  const [availableVoices, setAvailableVoices] = useState<Array<{ id: string; label: string; name?: string; language?: string; gender?: string; description?: string }>>([]);
  const [ttsEndpoint, setTtsEndpoint] = useState(initialSettings.tts.endpoint);
  const [testVoice, setTestVoice] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [testingTts, setTestingTts] = useState(false);
  const [ttsAudioConfig, setTtsAudioConfig] = useState(initialSettings.tts.audio);

  useEffect(() => { void fetch("/api/settings").then((res) => res.json()).then((json) => { setAvailableVoices(json.voices ?? []); setTestVoice((current) => current || json.voices?.[0]?.id || ""); }).catch(() => setAvailableVoices([])); }, [ttsProvider]);

  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  function handleProviderChange(next: AiProviderType) {
    setAiProvider(next);
    if (next === "9router") {
      setAiBaseUrl("http://localhost:20128/v1");
      if (!aiModel || aiModel === "gpt-4o-mini") setAiModel("ag/gemini-2.5-flash");
    } else if (next === "openai") {
      setAiBaseUrl("https://api.openai.com/v1");
      if (!aiModel || aiModel.startsWith("ag/")) setAiModel("gpt-4o-mini");
    } else if (next === "anthropic") {
      setAiBaseUrl("https://api.anthropic.com");
      setAiModel("claude-3-5-sonnet-latest");
    }
  }

  async function handleSaveAll(clearAiKey = false, clearTtsKey = false) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai: {
            provider: aiProvider,
            baseUrl: aiBaseUrl,
            model: aiModel,
            roles: roleSettings,
            maxCostPerEpisodeUsd: maxCost,
            prompts: promptSettings.map((prompt) => ({ ...prompt, version: prompt.version + 1 })),
            ...(aiApiKey.trim() ? { apiKey: aiApiKey.trim() } : {}),
            ...(clearAiKey ? { clearApiKey: true } : {}),
          },
          tts: {
            provider: ttsProvider,
            model: ttsModel,
            defaultVoiceId,
            defaultSpeed,
            defaultPitch,
            endpoint: ttsEndpoint,
            audio: ttsAudioConfig,
            ...(ttsApiKey.trim() ? { apiKey: ttsApiKey.trim() } : {}),
            ...(clearTtsKey ? { clearApiKey: true } : {}),
          },
          render: {
            outputDir,
            fps,
            width,
            height,
            maxRetries,
            ffmpegPath,
          },
          generation: generationSettings,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan pengaturan");
        return;
      }
      setAiKeyInfo({
        has: json.settings.ai.hasApiKey,
        masked: json.settings.ai.maskedApiKey,
      });
      setTtsKeyInfo({
        has: json.settings.tts.hasApiKey,
        masked: json.settings.tts.maskedApiKey,
      });
      setAiApiKey("");
      setTtsApiKey("");
      toast.success("Semua pengaturan & API key tersimpan aman ✓");
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAiConnection() {
    setTestingAi(true);
    try {
      const res = await fetch("/api/settings/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          baseUrl: aiBaseUrl,
          model: aiModel,
          apiKey: aiApiKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Tes koneksi gagal");
        return;
      }
      if (Array.isArray(json.models)) setDiscoveredModels(json.models);
      toast.success(json.message);
    } catch {
      toast.error("Gagal mengetes koneksi API router");
    } finally {
      setTestingAi(false);
    }
  }

  async function handleImportZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/backup/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal restore backup");
        return;
      }
      toast.success(
        `Restore selesai: ${json.restoredSeries} series & ${json.restoredEpisodes} episode dipulihkan!`
      );
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1>Pengaturan Studio</h1>
          <p className="text-sm text-muted-foreground">
            Atur koneksi 9router / AI, provider TTS, render Remotion di PC, dan backup `.zip`.
          </p>
        </div>
        <Button onClick={() => handleSaveAll(false, false)} disabled={saving}>
          <Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
        </Button>
      </div>

      <Card className="studio-card">
        <CardHeader><CardTitle>Performa & gerakan</CardTitle><CardDescription>Efek visual memakai animasi kompositor (transform/opacity), pause saat tab tersembunyi, serta dikurangi otomatis di perangkat hemat daya.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><Label htmlFor="motion-saver">Mode hemat animasi</Label><p className="mt-1 text-xs text-muted-foreground">Mengurangi transisi, gerak dekoratif, dan reveal. Preferensi disimpan di perangkat ini.</p></div>
          <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{motionPreference === "system" ? "Otomatis" : motionPreference === "reduced" ? "Aktif" : "Nonaktif"}</span><Switch aria-label="Mode hemat animasi" checked={motionPreference === "reduced"} onCheckedChange={(checked) => { const next: MotionPreference = checked ? "reduced" : "full"; setMotionPreference(next); }} /></div>
        </CardContent>
      </Card>

      {/* Koneksi AI & 9router */}
      <Card className="border-primary/40">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PlugZap className="size-4 text-primary" /> Koneksi API Router (9router) &amp; AI Naskah
              </CardTitle>
              <CardDescription>
                Hubungkan ke <strong>9router</strong> lokal/cloud (OpenAI-compatible) atau Anthropic untuk generate ide hook, naskah, dan outline bulk.
              </CardDescription>
            </div>
            {aiKeyInfo.has && (
              <Badge className="bg-emerald-600/20 text-emerald-300">
                <KeyRound className="mr-1 size-3" /> Key: {aiKeyInfo.masked}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-provider">Provider / API Router</Label>
              <Select
                value={aiProvider}
                onValueChange={(v) =>
                  handleProviderChange((v as AiProviderType) || "9router")
                }
              >
                <SelectTrigger id="ai-provider" aria-label="Provider / API Router" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9router">9router (API Router)</SelectItem>
                  <SelectItem value="openai">OpenAI-Compatible</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="local">Template Lokal (Offline)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-base-url">Base URL Endpoint</Label>
              <Input
                id="ai-base-url"
                placeholder="http://localhost:20128/v1"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Model ID</Label>
              <Input
                id="ai-model"
                placeholder="ag/gemini-2.5-flash"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-api-key">API Key (Terenkripsi di SQLite, tidak ditampilkan penuh)</Label>
              <div className="flex gap-2">
                <Input
                  id="ai-api-key"
                  type="password"
                  placeholder={
                    aiKeyInfo.has
                      ? "Isi hanya jika ingin mengganti key..."
                      : "Masukkan API key 9router / provider..."
                  }
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                />
                {aiKeyInfo.has && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveAll(true, false)}
                  >
                    Hapus Key
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={testingAi}
              onClick={handleTestAiConnection}
            >
              <CheckCircle2 className="size-4" />
              {testingAi ? "Mengetes Koneksi..." : "Tes Koneksi 9router / AI"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAiProvider("9router");
                setAiBaseUrl("http://localhost:20128/v1");
              }}
            >
              Preset 9router Lokal (:20128)
            </Button>
          </div>

          {discoveredModels.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold">Model ditemukan di 9router (klik untuk pakai):</p>
              <div className="flex flex-wrap gap-1.5">
                {discoveredModels.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="xs"
                    variant={aiModel === m ? "default" : "outline"}
                    onClick={() => setAiModel(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI — Model per Peran</CardTitle>
          <CardDescription>Atur model utama, fallback, dan temperatur secara terpisah untuk tiap peran kreatif.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(roleSettings).map(([role, config]) => (
            <div key={role} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
              <Label className="self-center">{role}</Label>
                <Input aria-label={`${role} model`} value={config.model} onChange={(e) => setRoleSettings((prev) => ({ ...prev, [role]: { ...prev[role as keyof typeof prev], model: e.target.value } }))} />
              <div className="flex gap-2">
                <Input aria-label={`${role} fallback`} value={config.fallbackModel} onChange={(e) => setRoleSettings((prev) => ({ ...prev, [role]: { ...prev[role as keyof typeof prev], fallbackModel: e.target.value } }))} />
                <Input aria-label={`${role} temperature`} type="number" min="0" max="2" step="0.05" className="w-24" value={config.temperature} onChange={(e) => setRoleSettings((prev) => ({ ...prev, [role]: { ...prev[role as keyof typeof prev], temperature: Number(e.target.value) } }))} />
                <Input aria-label={`${role} max tokens`} type="number" min="1" value={config.maxTokens} onChange={(e) => setRoleSettings((prev) => ({ ...prev, [role]: { ...prev[role as keyof typeof prev], maxTokens: Number(e.target.value) } }))} />
                <Input aria-label={`${role} timeout ms`} type="number" min="1" value={config.timeoutMs} onChange={(e) => setRoleSettings((prev) => ({ ...prev, [role]: { ...prev[role as keyof typeof prev], timeoutMs: Number(e.target.value) } }))} />
                <Button variant="outline" size="sm" disabled={testingAi} onClick={handleTestAiConnection}>Tes</Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label htmlFor="ai-max-cost">Batas biaya per episode (USD)</Label><Input id="ai-max-cost" type="number" min="0" step="0.1" value={maxCost} onChange={(e) => setMaxCost(Number(e.target.value))} /></div>
            <Button variant="outline" onClick={async () => { const res = await fetch("/api/settings", { method: "DELETE" }); if (res.ok) { toast.success("Konfigurasi AI kembali ke default"); router.refresh(); } }}>Reset ke default</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">AI — Prompt dan Aturan Generasi</CardTitle><CardDescription>Prompt tersimpan berversi di database. Perubahan membuat versi prompt baru.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {promptSettings.map((item, index) => <div className="space-y-1" key={item.role}><Label>System prompt · {item.role} · v{item.version}</Label><textarea className="min-h-24 w-full rounded-md border bg-background p-2 text-sm" value={item.prompt} onChange={(event) => setPromptSettings((prev) => prev.map((entry, idx) => idx === index ? { ...entry, prompt: event.target.value } : entry))} /></div>)}
          <div className="grid gap-2 sm:grid-cols-3">{Object.entries(generationSettings).map(([key, value]) => <div key={key}><Label>{key}</Label><Input type="number" value={value} onChange={(event) => setGenerationSettings((prev) => ({ ...prev, [key]: Number(event.target.value) }))} /></div>)}</div>
        </CardContent>
      </Card>

      {/* TTS & Render */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Provider TTS (Suara)</CardTitle>
              {ttsKeyInfo.has && (
                <Badge variant="outline" className="text-[11px]">
                  Key: {ttsKeyInfo.masked}
                </Badge>
              )}
            </div>
            <CardDescription>
              Edge-TTS gratis tanpa key (saat online). Jika offline, app otomatis memakai generator panduan lokal atau upload rekaman sendiri.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tts-provider" className="text-xs">Provider TTS</Label>
              <Select
                value={ttsProvider}
                onValueChange={(v) => setTtsProvider((v as TtsProviderType) || "edge-tts")}
              >
                <SelectTrigger id="tts-provider" aria-label="Provider TTS" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edge-tts">Edge-TTS (Gratis id-ID)</SelectItem>
                  <SelectItem value="openai">OpenAI Speech</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="google">Google Cloud TTS (Chirp 3 HD)</SelectItem>
                  <SelectItem value="azure">Azure Neural / HD</SelectItem>
                  <SelectItem value="local">Lokal / Upload Rekaman Sendiri</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tts-api-key" className="text-xs">API Key TTS ({ttsProvider})</Label>
              <div className="flex gap-2">
                <Input
                  id="tts-api-key"
                  type="password"
                  placeholder={ttsKeyInfo.has ? "Key tersimpan..." : ttsProvider === "edge-tts" ? "Tidak perlu API key" : "API key provider"}
                  value={ttsApiKey}
                  onChange={(e) => setTtsApiKey(e.target.value)}
                />
                {ttsKeyInfo.has && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveAll(false, true)}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1"><Label htmlFor="tts-model" className="text-xs">Model ID (kosong = default provider)</Label><Input id="tts-model" value={ttsModel} onChange={(event) => setTtsModel(event.target.value)} placeholder={ttsProvider === "openai" ? "gpt-4o-mini-tts" : ttsProvider === "elevenlabs" ? "eleven_multilingual_v2" : ""} /></div>

            {ttsProvider === "azure" && <div className="space-y-1"><Label htmlFor="tts-endpoint" className="text-xs">Azure Speech endpoint/resource URL</Label><Input id="tts-endpoint" placeholder="https://resource.cognitiveservices.azure.com" value={ttsEndpoint} onChange={(event) => setTtsEndpoint(event.target.value)} /></div>}

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 space-y-1 sm:col-span-1">
                <Label htmlFor="tts-voice" className="text-xs">Voice Default</Label>
                  <Select value={defaultVoiceId} onValueChange={(value) => { setDefaultVoiceId(value ?? ""); setTestVoice(value ?? ""); }}>
                    <SelectTrigger id="tts-voice"><SelectValue /></SelectTrigger>
                    <SelectContent>{availableVoices.map((voice) => <SelectItem key={voice.id} value={voice.id}>{voice.label}</SelectItem>)}</SelectContent>
                  </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tts-speed" className="text-xs">Speed</Label>
                <Input
                  id="tts-speed"
                  type="number"
                  step={0.05}
                  value={defaultSpeed}
                  onChange={(e) => setDefaultSpeed(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tts-pitch" className="text-xs">Pitch (Hz)</Label>
                <Input
                  id="tts-pitch"
                  type="number"
                  value={defaultPitch}
                  onChange={(e) => setDefaultPitch(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" disabled={testingTts || !testVoice} onClick={async () => { setTestingTts(true); try { const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: ttsProvider, apiKey: ttsApiKey || undefined, endpoint: ttsEndpoint, voiceId: testVoice, text: "Hai! Aku senang sekali bisa bercerita bareng kamu hari ini.", emotion: "senang" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setPreviewUrl(data.previewUrl); toast.success(`Tes ${ttsProvider} berhasil`); } catch (error) { toast.error(error instanceof Error ? error.message : "Tes TTS gagal"); } finally { setTestingTts(false); } }}>{testingTts ? "Menguji…" : "Uji suara provider"}</Button>
              {previewUrl && <audio controls src={previewUrl} aria-label="Pratinjau suara" />}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ttsAudioConfig.trimSilence} onChange={(event) => setTtsAudioConfig((value) => ({ ...value, trimSilence: event.target.checked }))} />Trim hening</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ttsAudioConfig.compressor} onChange={(event) => setTtsAudioConfig((value) => ({ ...value, compressor: event.target.checked }))} />Kompresor</label><label className="space-y-1 text-xs">Target LUFS<Input type="number" min={-24} max={-12} value={ttsAudioConfig.loudnessLufs} onChange={(event) => setTtsAudioConfig((value) => ({ ...value, loudnessLufs: Number(event.target.value) }))} /></label><label className="space-y-1 text-xs">Sample rate<Select value={String(ttsAudioConfig.sampleRate)} onValueChange={(value) => setTtsAudioConfig((current) => ({ ...current, sampleRate: Number(value) as 44100 | 48000 }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="44100">44.1 kHz</SelectItem><SelectItem value="48000">48 kHz</SelectItem></SelectContent></Select></label></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengaturan Render PC (Remotion)</CardTitle>
            <CardDescription>
              Output video vertikal 9:16 H.264. Render dijalankan di PC/server, bukan di browser HP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="render-output" className="text-xs">Folder Output Render</Label>
              <Input id="render-output" value={outputDir} onChange={(e) => setOutputDir(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="render-fps" className="text-xs">FPS</Label>
                <Input
                  id="render-fps"
                  type="number"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="render-width" className="text-xs">Width</Label>
                <Input
                  id="render-width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="render-height" className="text-xs">Height</Label>
                <Input
                  id="render-height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="render-retries" className="text-xs">Max Retry</Label>
                <Input
                  id="render-retries"
                  type="number"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="render-ffmpeg" className="text-xs">Path FFmpeg</Label>
              <Input id="render-ffmpeg" value={ffmpegPath} onChange={(e) => setFfmpegPath(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadangkan dan Pulihkan Basis Data serta Panduan Serial</CardTitle>
          <CardDescription>
            Export semua series, episode, dan file `series-bible.json` dalam 1 arsip `.zip` untuk pindah PC atau cadangan lokal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <a href="/api/backup/export" download>
            <Button variant="outline">
              <Download className="size-4" /> Export Semua Data (.zip)
            </Button>
          </a>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
            <Upload className="size-4" />
            <span>{importing ? "Merestore..." : "Import / Restore Backup (.zip)"}</span>
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={importing}
              className="hidden"
              onChange={handleImportZip}
            />
          </label>
        </CardContent>
      </Card>

      {/* Aturan Orisinalitas */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-300">
            <ShieldAlert className="size-4" /> Tentang &amp; Aturan Orisinalitas Kreator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p>
            • <strong>No Copy Content:</strong> Dilarang menjiplak naskah, adegan, dialog, atau musik berhak cipta milik kreator lain.
          </p>
          <p>
            • <strong>Transformatif &amp; Orisinal:</strong> Gunakan karakter voxel/kartun 3D buatan sendiri (bukan aset Mojang/Nintendo/Disney), ambil pola struktur hook, ciptakan isi &amp; twist baru.
          </p>
          <p>
            • <strong>Be Authentic:</strong> Pertahankan gaya bahasa, humor, dan identitas series lewat Series Bible yang terkunci.
          </p>
          <p>
            • <strong>Batasan Perangkat:</strong> Penulisan naskah, bulk outline, dan pemantauan antrean bisa dari HP iOS, sedangkan proses render Three.js + Remotion dijalankan di server/PC.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
