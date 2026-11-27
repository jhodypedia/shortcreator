"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { studioMotion } from "@/components/motion-provider";
import { isMotionReduced, subscribeMotionPreference } from "@/lib/device-performance";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useSyncExternalStore(subscribeMotionPreference, isMotionReduced, () => true);
  const [visible, setVisible] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <m.div
      ref={element}
      className={className}
      initial={reduced ? false : studioMotion.variants.reveal.initial}
      animate={reduced || !visible ? { opacity: 1, y: 0 } : studioMotion.variants.reveal.animate}
      transition={{ duration: reduced ? 0 : studioMotion.duration.normal, delay: reduced ? 0 : delay, ease: studioMotion.ease }}
    >
      {children}
    </m.div>
  );
}

export function CountUp({
  value,
  className,
  suffix,
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const [shown, setShown] = useState(0);
  const started = useRef(false);
  const reduced = useSyncExternalStore(subscribeMotionPreference, isMotionReduced, () => true);
  const [visible, setVisible] = useState(false);
  const element = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (started.current) return;
    if (!visible || document.hidden) return;
    started.current = true;
    const duration = reduced || value === 0 ? 0 : studioMotion.duration.slow * 1000;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, visible, reduced]);

  return (
    <span ref={element} className={cn("mono tabular-nums", className)}>
      {shown.toLocaleString("id-ID")}
      {suffix}
    </span>
  );
}

export function Sparkline({
  points,
  className,
  tone = "emerald",
}: {
  points: number[];
  className?: string;
  tone?: "emerald" | "amber" | "blue";
}) {
  const color = tone === "amber" ? "#f59e0b" : tone === "blue" ? "#60a5fa" : "#10b981";
  const values = points.length > 1 ? points : [0, ...points, 0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const path = values
    .map((point, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((point - min) / span) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden="true">
      <m.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
