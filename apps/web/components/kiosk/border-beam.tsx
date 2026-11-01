"use client";

import { motion, useReducedMotion, type MotionStyle } from "motion/react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * Magic UI "Border Beam" (magicui.design/docs/components/border-beam), written with Motion so no
 * extra package is needed. A short gradient travels along the parent's border. Colors come from
 * design tokens. Renders nothing when the user prefers reduced motion (design spec "Motion").
 * The parent must be `relative` and have a border radius.
 */
export function BorderBeam({
  size = 160,
  duration = 8,
  borderWidth = 2,
  className,
}: {
  size?: number;
  duration?: number;
  borderWidth?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] border-(length:--beam-width) border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(black,black)]"
      style={{ "--beam-width": `${borderWidth}px` } as CSSProperties}
    >
      <motion.div
        className={cn(
          "absolute aspect-square bg-linear-to-l from-brand via-chart-2/70 to-transparent",
          className,
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          } as MotionStyle
        }
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration }}
      />
    </div>
  );
}
