"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const GUTTER = 6;
const VIEW_MARGIN = 8;
const DEFAULT_MENU_WIDTH = 208;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  /** Panel layout (default `min-w-52 w-52` for subscriber actions). */
  menuClassName?: string;
};

/**
 * Renders a fixed-position menu in `document.body` so it is not clipped by
 * table/card `overflow-*` ancestors or covered by nearby footers.
 */
export function FloatingMenuPortal({
  open,
  onOpenChange,
  anchorRef,
  menuClassName = "min-w-52 w-52",
  children,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, maxHeight: 360 });

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const menu = menuRef.current;
    const menuBox = menu?.getBoundingClientRect();
    const menuW = menuBox?.width || DEFAULT_MENU_WIDTH;
    const menuH = menu?.scrollHeight || menuBox?.height || 320;
    let left = r.right - menuW;
    left = Math.max(VIEW_MARGIN, Math.min(left, window.innerWidth - menuW - VIEW_MARGIN));
    const topBelow = r.bottom + GUTTER;
    const spaceBelow = window.innerHeight - topBelow - VIEW_MARGIN;
    const spaceAbove = r.top - GUTTER - VIEW_MARGIN;
    let openUp = false;
    if (menuH <= spaceBelow) {
      openUp = false;
    } else if (menuH <= spaceAbove) {
      openUp = true;
    } else {
      openUp = spaceAbove > spaceBelow;
    }
    const maxHeight = Math.max(120, openUp ? spaceAbove : spaceBelow);
    const top = openUp
      ? Math.max(VIEW_MARGIN, r.top - GUTTER - Math.min(menuH, maxHeight))
      : topBelow;
    setBox({ top, left, maxHeight });
  }, [anchorRef]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => reposition());
    return () => cancelAnimationFrame(id);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      reposition();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onScroll() {
      reposition();
    }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onOpenChange(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onOpenChange, anchorRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[300] overflow-x-hidden overflow-y-auto rounded-xl border border-border/80 bg-card py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10",
        menuClassName,
      )}
      style={{ top: box.top, left: box.left, maxHeight: box.maxHeight }}
    >
      {children}
    </div>,
    document.body,
  );
}
