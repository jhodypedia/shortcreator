export type MotionPreference = "system" | "full" | "reduced";

const STORAGE_KEY = "short-generator-motion";
const listeners = new Set<() => void>();
let configured = false;
let systemReduced = false;
let saveData = false;
let lowHardware = false;

function emit() { listeners.forEach((listener) => listener()); }

function configure() {
  if (configured || typeof window === "undefined") return;
  configured = true;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  systemReduced = media.matches;
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
  saveData = Boolean(connection?.saveData);
  lowHardware = (navigator.hardwareConcurrency || 8) <= 4;
  media.addEventListener?.("change", (event) => { systemReduced = event.matches; emit(); });
  connection?.addEventListener?.("change", () => { saveData = Boolean(connection.saveData); emit(); });
  window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) emit(); });
}

export function getMotionPreference(): MotionPreference {
  if (typeof window === "undefined") return "system";
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "full" || value === "reduced" ? value : "system";
  } catch { return "system"; }
}

export function setMotionPreference(value: MotionPreference) {
  if (typeof window === "undefined") return;
  try {
    if (value === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
    if (typeof document !== "undefined") document.documentElement.dataset.motion = isMotionReduced() ? "reduced" : "full";
    emit();
  } catch { /* browser storage may be unavailable */ }
}

export function subscribeMotionPreference(listener: () => void) {
  configure();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isMotionReduced(): boolean {
  configure();
  const preference = getMotionPreference();
  if (preference === "reduced") return true;
  if (preference === "full") return systemReduced;
  return systemReduced || saveData || lowHardware;
}

export function prefersLightMotion(): boolean {
  return isMotionReduced();
}

export function loadLenis(): Promise<typeof import("lenis") | null> {
  if (typeof window === "undefined" || isMotionReduced() || !window.matchMedia("(pointer:fine)").matches) return Promise.resolve(null);
  return import("lenis");
}
