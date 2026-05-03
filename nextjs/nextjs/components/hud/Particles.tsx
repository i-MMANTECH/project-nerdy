"use client";

import { useEffect, useRef } from "react";

/**
 * Sparse drifting cyan dots — single canvas, GPU-friendly, ~60 dots max.
 * Pauses when the tab is hidden. Respects prefers-reduced-motion.
 */
export function Particles({
  density = 0.00006,
  color = "rgba(0, 245, 255, 0.55)",
  className,
}: {
  density?: number;
  color?: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    let running = true;
    type Dot = { x: number; y: number; vx: number; vy: number; r: number };
    const dots: Dot[] = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const parent = canvas!.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.scale(dpr, dpr);
      const target = Math.min(60, Math.max(18, Math.floor(w * h * density)));
      while (dots.length < target) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: 0.6 + Math.random() * 1.2,
        });
      }
      while (dots.length > target) dots.pop();
    }

    function frame() {
      if (!running) return;
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      ctx!.clearRect(0, 0, w, h);
      ctx!.fillStyle = color;
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -2) d.x = w + 2;
        if (d.x > w + 2) d.x = -2;
        if (d.y < -2) d.y = h + 2;
        if (d.y > h + 2) d.y = -2;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function onVis() {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [density, color]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
