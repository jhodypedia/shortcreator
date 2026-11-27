"use client";

import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { useSyncExternalStore } from "react";
import { prefersLightMotion, subscribeMotionPreference } from "@/lib/device-performance";
import { studioMotion } from "@/components/motion-provider";

const STATIC_ROUTES = [/^\/episodes(?:\/|$)/];

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lowPower = useSyncExternalStore(
    subscribeMotionPreference,
    () => prefersLightMotion(),
    () => true
  );
  const skip = STATIC_ROUTES.some((pattern) => pattern.test(pathname));

  if (skip) return <div>{children}</div>;

  return (
    <m.div
      key={pathname}
      initial={lowPower ? false : studioMotion.variants.page.initial}
      animate={studioMotion.variants.page.animate}
      transition={{ duration: studioMotion.duration.normal, ease: studioMotion.ease }}
      style={{ willChange: lowPower ? "auto" : "opacity, transform" }}
    >
      {children}
    </m.div>
  );
}
