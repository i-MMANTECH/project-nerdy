"use client";

/**
 * Animated mesh-gradient backdrop — three slow-drifting radial-gradient orbs
 * (cyan / magenta / acid green) that create a Cyberpunk 2077-style aurora.
 * Pure CSS transforms, GPU-only, respects `prefers-reduced-motion`.
 */
export function MeshBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="fx-orb fx-orb-drift"
        style={{
          top: "-12%",
          left: "-10%",
          width: "55vmax",
          height: "55vmax",
          background: "radial-gradient(closest-side, rgba(0, 240, 255, 0.45), transparent 70%)",
        }}
      />
      <div
        className="fx-orb fx-orb-drift"
        style={{
          bottom: "-15%",
          right: "-12%",
          width: "60vmax",
          height: "60vmax",
          background: "radial-gradient(closest-side, rgba(255, 0, 170, 0.36), transparent 70%)",
          animationDelay: "-7s",
        }}
      />
      <div
        className="fx-orb fx-orb-drift"
        style={{
          top: "32%",
          right: "20%",
          width: "30vmax",
          height: "30vmax",
          background: "radial-gradient(closest-side, rgba(34, 255, 136, 0.22), transparent 70%)",
          animationDelay: "-13s",
        }}
      />
    </div>
  );
}
