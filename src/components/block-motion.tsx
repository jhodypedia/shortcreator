"use client";

import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { useSyncExternalStore } from "react";
import { prefersLightMotion } from "@/lib/device-performance";
import { studioMotion } from "@/components/motion-provider";

const STATIC_ROUTES = [/^\/episodes(?:\/|$)/];
const subscribe = () => () => {};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lowPower = useSyncExternalStore(
    subscribe,
    () => prefersLightMotion(),
    () => false
  );
  const skip = STATIC_ROUTES.some((pattern) => pattern.test(pathname));

  if (skip) return <div>{children}</div>;

  return (
    <m.div
      key={pathname}
      initial={lowPower ? false : studioMotion.variants.page.initial}
      animate={studioMotion.variants.page.animate}
      transition={{ duration: studioMotion.duration.normal, ease: studioMotion.ease }}
    >
      {children}
    </m.div>
  );
}
