"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { useEffect } from "react";

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
      <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.2 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
