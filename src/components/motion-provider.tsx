"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { useEffect } from "react";

export const studioMotion = {
  duration: { fast: 0.12, normal: 0.2, slow: 0.32 },
  ease: [0.2, 0.75, 0.25, 1] as const,
  spring: { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.8 },
  variants: {
    page: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } },
    reveal: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } },
    press: { rest: { scale: 1 }, pressed: { scale: 0.975 } },
  },
} as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    function onVisibility() {
      if (document.hidden) html.setAttribute("data-tab-hidden", "true");
      else html.removeAttribute("data-tab-hidden");
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      html.removeAttribute("data-tab-hidden");
    };
  }, []);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ ease: studioMotion.ease, duration: studioMotion.duration.normal }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
