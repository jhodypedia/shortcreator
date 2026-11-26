"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clapperboard,
  Command,
  Film,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  PanelLeft,
  Settings,
  ChevronRight,
  Sparkles,
  SunMoon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/studio-primitives";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", short: "Monitor", icon: LayoutDashboard },
  { href: "/series", label: "Serial", short: "Serial", icon: Film },
  { href: "/bulk", label: "Massal", short: "Massal", icon: Layers },
  { href: "/queue", label: "Antrean", short: "Antrean", icon: ListOrdered },
  { href: "/settings", label: "Pengaturan", short: "Setelan", icon: Settings },
];

const MOBILE_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/series", label: "Serial", icon: Film },
  { href: "/bulk", label: "Massal", icon: Layers },
  { href: "/queue", label: "Antrean", icon: ListOrdered },
  { href: "/settings", label: "Setelan", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const stored = localStorage.getItem("short-generator-theme");
    const selected = stored === "light" || stored === "dark" ? stored : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    html.dataset.theme = selected;
    html.classList.toggle("dark", selected === "dark");
    if (selected !== "dark") requestAnimationFrame(() => setTheme(selected));
    const onSystemTheme = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem("short-generator-theme")) {
        const next = event.matches ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        document.documentElement.classList.toggle("dark", next === "dark");
        setTheme(next);
      }
    };
    const preference = window.matchMedia("(prefers-color-scheme: light)");
    preference.addEventListener("change", onSystemTheme);
    return () => preference.removeEventListener("change", onSystemTheme);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("short-generator-theme", next);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/queue/status").then((response) => response.json()).then((data) => { if (active) setQueueCount(Array.isArray(data?.items) ? data.items.filter((item: {status:string}) => item.status === "queued" || item.status === "rendering").length : 0); }).catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const current = NAV_ITEMS.find((item) => isActive(item.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Studio toolbar */}
      <header className="safe-top flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Short Generator">
            <span aria-hidden="true" className="app-logo"><Clapperboard className="size-4" /></span>
            <span className="hidden text-sm font-bold tracking-tight sm:inline">Short Generator</span>
          </Link>
          <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="hidden uppercase tracking-[0.12em] md:inline">Proyek</span>
            <span className="truncate text-foreground">{current?.label ?? "Detail"}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="mr-1 hidden items-center gap-2 border-r border-border pr-3 lg:flex">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Mesin render siap
            </span>
            <span className="mono text-[10px] text-muted-foreground">v1</span>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-7 items-center gap-2 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:border-[#46505a] hover:text-foreground sm:flex"
          >
            <Command className="size-3.5" />
            Cari
            <kbd className="mono ml-1 rounded-sm border border-border px-1 py-px text-[10px]">Ctrl K</kbd>
          </button>
          <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed((value) => !value)} aria-label="Ciutkan rail ikon" className="hidden lg:inline-flex">
            <PanelLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label={`Ganti ke tema ${theme === "dark" ? "terang" : "gelap"}`}>
            <SunMoon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Keluar">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Icon rail */}
        <aside className={cn("hidden h-full shrink-0 flex-col items-center border-r border-border bg-card py-2 transition-[width] duration-150 md:flex", collapsed ? "w-0 overflow-hidden border-r-0" : "w-12 lg:w-60", collapsed && "lg:w-0")}>
          <nav aria-label="Navigasi utama" className="flex flex-col items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/rail relative flex min-h-11 w-11 items-center justify-center rounded-md border border-transparent transition-colors lg:w-[calc(100%-16px)] lg:justify-start lg:gap-3 lg:px-3",
                    active
                      ? "border-[#065f46] bg-[#123c31] text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span className={cn("hidden truncate text-sm lg:block", collapsed && "lg:hidden")}>{item.label}</span>
                  {active && <span className="absolute -left-[9px] h-5 w-0.5 rounded-sm bg-primary" aria-hidden="true" />}
                  <span className="pointer-events-none absolute left-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-sm border border-border bg-popover px-2 py-1 text-[11px] text-foreground shadow-[var(--shadow)] group-hover/rail:block">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-1">
            <Link
              href="/settings"
              className="group/rail relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Pengaturan studio"
            >
              <Settings className="size-4" />
              <span className="pointer-events-none absolute left-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-sm border border-border bg-popover px-2 py-1 text-[11px] text-foreground shadow-[var(--shadow)] group-hover/rail:block">Pengaturan studio</span>
            </Link>
            <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Keluar" className="text-muted-foreground">
              <LogOut className="size-4" />
            </Button>
          </div>
        </aside>

        {/* Workspace */}
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div data-page-content className="mx-auto w-full max-w-[1440px] min-w-0 px-3 py-3 sm:px-4 md:py-4 xl:px-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Navigasi utama" className="bottom-nav-float fixed left-1/2 z-40 grid w-[min(94vw,440px)] -translate-x-1/2 grid-cols-5 px-1.5 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur-xl md:hidden">
        {MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-1 text-[10px] font-medium leading-tight transition-colors", active ? "text-primary" : "text-muted-foreground")}
            >
              <motion.span animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }} transition={{ type: "spring", stiffness: 430, damping: 20 }}><Icon className="size-5 shrink-0" /></motion.span>
              <span className="max-w-full truncate">{item.label}</span>
              {item.href === "/queue" && queueCount > 0 && <span className="absolute top-0.5 right-[calc(50%-19px)] min-w-4 rounded-full bg-amber-500 px-1 text-center text-[9px] font-bold leading-4 text-[#1b160a]">{queueCount > 9 ? "9+" : queueCount}</span>}
              {active && <span className="absolute top-0 h-0.5 w-6 rounded-b-sm bg-primary" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>

      <button type="button" aria-label="Perintah AI" onClick={() => setMobileMenuOpen(true)} className="fixed right-4 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full border border-amber-300/50 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-xl transition-transform active:scale-95 md:hidden"><Sparkles className="size-6"/></button>

      <BottomSheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} title="Aksi cepat" snap={0.62}>
        <div className="grid gap-2 pb-4">
          <button type="button" onClick={() => { setMobileMenuOpen(false); setSearchOpen(true); }} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-4 text-left"><Command className="size-4 text-primary"/>Cari halaman atau perintah</button>
          <Link href="/series?new=1" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-4"><Sparkles className="size-4 text-primary"/>Buat video dengan AI</Link>
          <button type="button" onClick={toggleTheme} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-4 text-left"><SunMoon className="size-4 text-primary"/>Ganti ke tema {theme === "dark" ? "terang" : "gelap"}</button>
        </div>
      </BottomSheet>

      {searchOpen && (
        <div ref={commandRef} className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-3 pt-[12dvh]" onClick={() => setSearchOpen(false)} role="presentation">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Command className="size-4 text-muted-foreground" />
              <input autoFocus placeholder="Cari halaman studio…" className="h-6 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
              <kbd className="mono rounded-sm border border-border px-1 py-px text-[10px] text-muted-foreground">Esc</kbd>
            </div>
            <div className="p-1.5">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-foreground transition-colors hover:bg-secondary">
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                  <ChevronRight className="ml-auto size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
