"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * Aceternity UI "Background Beams" (added with `shadcn add https://ui.aceternity.com/registry/background-beams.json`),
 * adapted for this project:
 * - colors come from the `--brand-foreground` token (the panel itself is `bg-brand`), no hex values;
 * - the beam paths are generated from the original formula instead of 50 hard-coded strings;
 * - timings use a deterministic pseudo-random sequence so render stays pure and SSR-safe;
 * - under `prefers-reduced-motion` the beams are drawn once, without animation.
 * Decorative only: hidden from assistive technology.
 */

const BEAM_COUNT = 50;
const OUTLINE_COUNT = 58;

/** Beam i of the original Aceternity artwork: each beam is shifted 7 px right and 8 px up. */
function beamPath(i: number): string {
  const x = 7 * i;
  const y = -8 * i;
  return (
    `M${-380 + x} ${-189 + y}C${-380 + x} ${-189 + y} ${-312 + x} ${216 + y} ${152 + x} ${343 + y}` +
    `C${616 + x} ${470 + y} ${684 + x} ${875 + y} ${684 + x} ${875 + y}`
  );
}

/** Deterministic value in [0, 1) for beam `i` and channel `seed` (replaces Math.random in render). */
function pseudoRandom(i: number, seed: number): number {
  const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const PATHS = Array.from({ length: BEAM_COUNT }, (_, i) => beamPath(i));
const OUTLINE = Array.from({ length: OUTLINE_COUNT }, (_, i) => beamPath(i)).join("");
const BEAM_COLOR = "var(--brand-foreground)";

export const BackgroundBeams = memo(function BackgroundBeams({
  className,
}: {
  className?: string;
}) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 flex h-full w-full items-center justify-center",
        className,
      )}
    >
      <svg
        className="absolute z-0 h-full w-full"
        width="100%"
        height="100%"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <path d={OUTLINE} stroke="url(#bhw-beams-outline)" strokeOpacity="0.12" strokeWidth="0.5" />

        {PATHS.map((path, index) => (
          <path
            key={`path-${index}`}
            d={path}
            stroke={reduceMotion ? BEAM_COLOR : `url(#bhw-beam-${index})`}
            strokeOpacity={reduceMotion ? 0.06 : 0.45}
            strokeWidth="0.5"
          />
        ))}

        <defs>
          {reduceMotion
            ? null
            : PATHS.map((_, index) => (
                <motion.linearGradient
                  id={`bhw-beam-${index}`}
                  key={`gradient-${index}`}
                  initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
                  animate={{
                    x1: ["0%", "100%"],
                    x2: ["0%", "95%"],
                    y1: ["0%", "100%"],
                    y2: ["0%", `${93 + pseudoRandom(index, 1) * 8}%`],
                  }}
                  transition={{
                    duration: pseudoRandom(index, 2) * 10 + 10,
                    ease: "easeInOut",
                    repeat: Infinity,
                    delay: pseudoRandom(index, 3) * 10,
                  }}
                >
                  <stop style={{ stopColor: BEAM_COLOR, stopOpacity: 0 }} />
                  <stop style={{ stopColor: BEAM_COLOR }} />
                  <stop offset="32.5%" style={{ stopColor: BEAM_COLOR, stopOpacity: 0.8 }} />
                  <stop offset="100%" style={{ stopColor: BEAM_COLOR, stopOpacity: 0 }} />
                </motion.linearGradient>
              ))}

          <radialGradient
            id="bhw-beams-outline"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(352 34) rotate(90) scale(555 1560.62)"
          >
            <stop offset="0.0666667" style={{ stopColor: BEAM_COLOR }} />
            <stop offset="0.243243" style={{ stopColor: BEAM_COLOR }} />
            <stop offset="0.43594" style={{ stopColor: BEAM_COLOR, stopOpacity: 0 }} />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
});
