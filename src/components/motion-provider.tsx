"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { isMotionReduced, loadLenis, subscribeMotionPreference } from "@/lib/device-performance";

export const studioMotion = {
  duration: { fast: 0.1, normal: 0.18, slow: 0.28 },
  ease: [0.2, 0.75, 0.25, 1] as const,
  spring: { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.8 },
  variants: {
    page: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -2 } },
    reveal: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } },
    press: { rest: { scale: 1 }, pressed: { scale: 0.975 } },
  },
} as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useSyncExternalStore(subscribeMotionPreference, isMotionReduced, () => true);
  useEffect(() => {
    const html = document.documentElement;
    function onVisibility() {
      if (document.hidden) html.setAttribute("data-tab-hidden", "true");
      else html.removeAttribute("data-tab-hidden");
    }
    onVisibility();
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      html.removeAttribute("data-tab-hidden");
    };
  }, [reduced]);

  useEffect(() => {
    let disposed = false;
    let lenis: import("lenis").default | undefined;
    void loadLenis().then((module) => {
      if (disposed || !module) return;
      lenis = new module.default({ autoRaf: true, lerp: 0.08, smoothWheel: true, syncTouch: false });
      document.documentElement.dataset.lenis = "ready";
    });
    return () => { disposed = true; lenis?.destroy(); delete document.documentElement.dataset.lenis; };
  }, [reduced]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (finePointer && !reduced && typeof document.startViewTransition === "function" && typeof CSS !== "undefined" && CSS.supports("(view-transition-name: none)")) {
      root.classList.add("view-transitions-supported");
    } else root.classList.remove("view-transitions-supported");
    return () => { root.style.scrollBehavior = previous; root.classList.remove("view-transitions-supported"); };
  }, [reduced]);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduced ? "always" : "never"} transition={{ ease: studioMotion.ease, duration: reduced ? 0 : studioMotion.duration.normal }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
