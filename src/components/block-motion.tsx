"use client";

import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { useSyncExternalStore } from "react";
import { prefersLightMotion } from "@/lib/device-performance";

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
      initial={lowPower ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
