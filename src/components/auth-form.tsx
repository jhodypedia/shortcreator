"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { prefersLightMotion } from "@/lib/device-performance";
import { Clapperboard, LoaderCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const isSetup = mode === "setup";

  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = prefersLightMotion();
    if (reduced || lowPower || !error) return;
    gsap.fromTo(menuRef.current, { x: -6 }, { x: 0, duration: 0.2, ease: "power2.out" });
  }, { scope: menuRef, dependencies: [error], revertOnUpdate: true });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isSetup && password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Permintaan gagal. Silakan coba lagi.");
        return;
      }
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen studio-grid relative flex min-h-[100dvh] items-center justify-center px-4 py-10 text-foreground">
      <div className="playhead-intro pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/70" aria-hidden="true" />
      <div className="relative w-full max-w-[360px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span aria-hidden="true" className="app-logo mb-3 size-10"><Clapperboard className="size-5" /></span>
          <p className="mono text-[10px] uppercase tracking-[0.2em] text-primary">Short Generator</p>
          <h1 className="mt-2 text-[20px] font-semibold tracking-tight">
            {isSetup ? "Siapkan akun admin" : "Masuk ke studio"}
          </h1>
          <p className="mt-1 max-w-[280px] text-[12px] leading-5 text-muted-foreground">
            {isSetup
              ? "Buat kata sandi admin untuk mengamankan workspace produksi."
              : "Masukkan kata sandi untuk membuka workspace produksi."}
          </p>
        </div>

        <section ref={menuRef} className="auth-menu p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <span className="panel-title">{isSetup ? "Setup" : "Autentikasi"}</span>
            <span className="mono text-[10px] text-muted-foreground">v1.0</span>
          </div>
          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Kata sandi</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSetup ? "new-password" : "current-password"}
                  required
                  minLength={isSetup ? 12 : undefined}
                  autoFocus
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSetup ? "Minimal 12 karakter" : "Masukkan kata sandi"}
                  className="h-9 pl-8"
                />
              </div>
            </div>

            {isSetup && (
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ulangi kata sandi</label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Ketik ulang kata sandi"
                  className="h-9"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[12px] text-red-300">
                {error}
              </p>
            )}

            <Button type="submit" className="h-9 w-full gap-2" disabled={loading}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {loading ? "Memproses…" : isSetup ? "Buat akun admin" : "Masuk"}
            </Button>
          </form>
        </section>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          {isSetup ? "Sudah memiliki akun? " : "Belum menyiapkan admin? "}
          <Link href={isSetup ? "/login" : "/setup"} className="font-medium text-primary transition-colors hover:text-[#34d399]">
            {isSetup ? "Masuk" : "Pengaturan awal"}
          </Link>
        </p>
      </div>
    </main>
  );
}
