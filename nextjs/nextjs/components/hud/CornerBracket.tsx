import { cn } from "@/lib/cn";

type Corner = "tl" | "tr" | "bl" | "br";

const POS: Record<Corner, string> = {
  tl: "top-1.5 left-1.5",
  tr: "top-1.5 right-1.5 rotate-90",
  bl: "bottom-1.5 left-1.5 -rotate-90",
  br: "bottom-1.5 right-1.5 rotate-180",
};

/** Decorative HUD L-bracket. Stacks four to wrap a panel; renders nothing without `corners`. */
export function CornerBracket({
  corner,
  className,
  size = 14,
  color = "currentColor",
}: {
  corner: Corner;
  className?: string;
  size?: number;
  color?: string;
}) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute", POS[corner], className)}>
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M0 6 V0 H6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Wrap a panel with all four HUD brackets. Position: parent must be `relative`. */
export function CornerBrackets({ className, color }: { className?: string; color?: string }) {
  return (
    <>
      <CornerBracket corner="tl" className={className} color={color} />
      <CornerBracket corner="tr" className={className} color={color} />
      <CornerBracket corner="bl" className={className} color={color} />
      <CornerBracket corner="br" className={className} color={color} />
    </>
  );
}
