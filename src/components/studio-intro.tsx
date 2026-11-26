"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersLightMotion } from "@/lib/device-performance";

const SKIP = /^\/episodes(?:\/|$)/;

function shouldSkipIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if (prefersLightMotion()) return true;
  try {
    if (sessionStorage.getItem("studio-intro") === "1") return true;
  } catch {
    // storage privat: anggap intro belum pernah tampil
  }
  return SKIP.test(window.location.pathname);
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function StudioIntro() {
  const overlay = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useIsomorphicLayoutEffect(() => {
    const root = overlay.current;
    const sweep = line.current;
    if (!root) return;

    if (!sweep || shouldSkipIntro()) {
      root.style.display = "none";
      return;
    }

    try {
      sessionStorage.setItem("studio-intro", "1");
    } catch {
      // storage privat: intro cukup jalan sekali pada mount ini
    }

    const panels = gsap.utils.toArray<HTMLElement>("[data-page-content] > *").slice(0, 8);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: () => setVisible(false),
      });
      tl.fromTo(sweep, { scaleX: 0 }, { scaleX: 1, duration: 0.28, transformOrigin: "left center" }, 0);
      tl.to(sweep, { opacity: 0, duration: 0.12 }, 0.26);
      tl.to(root, { opacity: 0, duration: 0.18, pointerEvents: "none" }, 0.26);
      if (panels.length) {
        tl.from(panels, { opacity: 0, y: 8, duration: 0.2, stagger: 0.04, clearProps: "transform,opacity" }, 0.28);
      }
    });

    return () => ctx.revert();
  }, []);

  if (!visible) return null;

  return (
    <div ref={overlay} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] bg-[#0b0c0e]">
      <div ref={line} className="absolute top-0 left-0 h-px w-full origin-left bg-[#10b981] shadow-[0_0_12px_#10b981]" />
    </div>
  );
}
