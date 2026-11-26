"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { EpisodePublish, SeriesBible } from "@/lib/schemas";
import { EpisodeHeaderNav } from "@/components/episode-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SeriesEpPerf {
  id: string;
  number: number;
  title: string;
  hook: string;
  publish: EpisodePublish | null;
}

export function PublishClient({
  episode,
  series,
  bible,
  seriesEpisodes,
}: {
  episode: {
    id: string;
    number: number;
    title: string;
    status: string;
    publish: EpisodePublish | null;
  };
  series: { id: string; name: string };
  bible: SeriesBible;
  seriesEpisodes: SeriesEpPerf[];
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<EpisodePublish["platform"]>(
    episode.publish?.platform ?? "YouTube Shorts"
  );
  const [uploadedAt, setUploadedAt] = useState(
    episode.publish?.uploadedAt ?? new Date().toISOString().slice(0, 10)
  );
  const [url, setUrl] = useState(episode.publish?.url ?? "");
  const [views, setViews] = useState(episode.publish?.views ?? 0);
  const [likes, setLikes] = useState(episode.publish?.likes ?? 0);
  const [subsDelta, setSubsDelta] = useState(episode.publish?.subsDelta ?? 0);
  const [notes, setNotes] = useState(episode.publish?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const best = [...seriesEpisodes]
    .filter((e) => (e.publish?.views ?? 0) > 0)
    .sort((a, b) => (b.publish?.views ?? 0) - (a.publish?.views ?? 0))[0];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/episodes/${episode.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          uploadedAt,
          url,
          views,
          likes,
          subsDelta,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan tracking publish");
        return;
      }
      toast.success("Data publish manual tersimpan ✓");
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <EpisodeHeaderNav
        episodeId={episode.id}
        seriesId={series.id}
        seriesName={series.name}
        episodeNumber={episode.number}
        episodeTitle={episode.title}
        status={episode.status}
        accentColor={bible.visualStyle.accentColor}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Catat Publish &amp; Performa Manual</CardTitle>
            <CardDescription>
              App tidak melakukan auto-upload atau scraping. Catat angka dari YouTube Studio / TikTok secara manual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Platform</Label>
                <Select
                  value={platform}
                  onValueChange={(v) =>
                    setPlatform((v as EpisodePublish["platform"]) || "YouTube Shorts")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YouTube Shorts">YouTube Shorts</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Instagram Reels">Instagram Reels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tanggal Upload</Label>
                <Input
                  type="date"
                  value={uploadedAt}
                  onChange={(e) => setUploadedAt(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Link Video</Label>
                <Input
                  placeholder="https://youtube.com/shorts/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Views</Label>
                  <Input
                    type="number"
                    min={0}
                    value={views}
                    onChange={(e) => setViews(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Likes</Label>
                  <Input
                    type="number"
                    min={0}
                    value={likes}
                    onChange={(e) => setLikes(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sub Delta</Label>
                  <Input
                    type="number"
                    value={subsDelta}
                    onChange={(e) => setSubsDelta(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Catatan Performa</Label>
                <Textarea
                  rows={3}
                  placeholder="Retensi 3 detik bagus, penonton suka twist ayam..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                <Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan Performa"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-7">
          {best && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-300">
                  <Trophy className="size-4" /> Pola Hook Pemenang — {series.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                <p>
                  Episode terbaik sejauh ini:{" "}
                  <strong>
                    Eps {best.number} ({best.title})
                  </strong>{" "}
                  dengan{" "}
                  <strong>{best.publish?.views?.toLocaleString("id-ID")} views</strong> dan{" "}
                  <strong>+{best.publish?.subsDelta ?? 0} subscriber</strong>.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Hook pemenang: &ldquo;{best.hook}&rdquo; — pertahankan pola hook langsung beraksi seperti ini di episode lanjutan.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabel Performa Serial</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Ep</th>
                    <th className="py-2 pr-3">Platform</th>
                    <th className="py-2 pr-3">Views</th>
                    <th className="py-2 pr-3">Likes</th>
                    <th className="py-2 pr-3">Sub</th>
                    <th className="py-2">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {seriesEpisodes.map((se) => (
                    <tr key={se.id}>
                      <td className="py-2 pr-3 font-semibold">
                        <Link href={`/episodes/${se.id}/publish`} className="hover:underline">
                          Eps {se.number}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{se.publish?.platform ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {se.publish?.views?.toLocaleString("id-ID") ?? "0"}
                      </td>
                      <td className="py-2 pr-3">
                        {se.publish?.likes?.toLocaleString("id-ID") ?? "0"}
                      </td>
                      <td className="py-2 pr-3">
                        {se.publish?.subsDelta !== undefined
                          ? se.publish.subsDelta >= 0
                            ? `+${se.publish.subsDelta}`
                            : se.publish.subsDelta
                          : "-"}
                      </td>
                      <td className="py-2">
                        {se.publish?.url ? (
                          <a
                            href={se.publish.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Buka <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
