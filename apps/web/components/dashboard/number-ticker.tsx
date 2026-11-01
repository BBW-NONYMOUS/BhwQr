"use client";

import { useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const numberFmt = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

/**
 * Animated counter for dashboard stat cards (the Magic UI NumberTicker pattern, built on the
 * installed `motion` package). Counts up when scrolled into view and springs to new values after
 * a live refresh. With prefers-reduced-motion it jumps straight to the value.
 *
 * Screen readers get the final value from a visually hidden span; the animated digits are
 * aria-hidden so intermediate numbers are never announced.
 */
export function NumberTicker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 40, stiffness: 140 });
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });

  useEffect(() => {
    if (reduceMotion) {
      motionValue.jump(value);
      spring.jump(value);
      if (ref.current) ref.current.textContent = numberFmt.format(value);
      return;
    }
    if (inView) motionValue.set(value);
  }, [inView, reduceMotion, value, motionValue, spring]);

  useMotionValueEvent(spring, "change", (latest) => {
    if (ref.current) ref.current.textContent = numberFmt.format(Math.round(latest));
  });

  return (
    <span className={cn("inline-block tabular-nums", className)}>
      <span ref={ref} aria-hidden="true">
        {numberFmt.format(0)}
      </span>
      <span className="sr-only">{numberFmt.format(value)}</span>
    </span>
  );
}
