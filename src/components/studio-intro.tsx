"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { prefersLightMotion } from "@/lib/device-performance";
import { studioMotion } from "@/components/motion-provider";

const SKIP = /^\/episodes(?:\/|$)/;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function StudioIntro() {
  const overlay = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const root = overlay.current;
    const sweep = line.current;
    if (!root) return;
    let alreadyPlayed = false;
    try { alreadyPlayed = sessionStorage.getItem("studio-intro") === "1"; } catch { /* storage may be unavailable */ }
    if (!sweep || reducedMotion || prefersLightMotion() || alreadyPlayed || SKIP.test(window.location.pathname)) {
      root.style.display = "none";
      setVisible(false);
      return;
    }
    try { sessionStorage.setItem("studio-intro", "1"); } catch { /* session storage is optional */ }
    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-page-content] > *")).slice(0, 8);
    const sweepAnimation = animate(sweep, { scaleX: [0, 1], opacity: [1, 0] }, { duration: studioMotion.duration.slow, ease: studioMotion.ease });
    const rootAnimation = animate(root, { opacity: [1, 0] }, { duration: studioMotion.duration.normal, delay: studioMotion.duration.fast, ease: studioMotion.ease });
    const panelAnimations = panels.map((panel, index) => animate(panel, { opacity: [0, 1], y: [8, 0] }, { duration: studioMotion.duration.normal, delay: studioMotion.duration.fast + index * studioMotion.duration.fast / 3, ease: studioMotion.ease }));
    Promise.all([sweepAnimation.finished, rootAnimation.finished, ...panelAnimations.map((animation) => animation.finished)]).then(() => setVisible(false));
    return () => { sweepAnimation.stop(); rootAnimation.stop(); panelAnimations.forEach((animation) => animation.stop()); };
  }, [reducedMotion]);

  if (!visible) return null;
  return <div ref={overlay} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] bg-[var(--studio-bg)]"><div ref={line} className="absolute top-0 left-0 h-px w-full origin-left bg-primary shadow-[0_0_12px_var(--studio-emerald)]"/></div>;
}
