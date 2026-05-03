"use client";

import type { ReactNode } from "react";
import { LazyMotion, domAnimation } from "framer-motion";

/**
 * `LazyMotion` defers framer-motion's animation engine to a single chunk, so
 * `<m.div animate={...}>` ships ~6KB instead of the full ~30KB. Use the lowercase
 * `m` component (not `motion`) inside this provider tree.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
