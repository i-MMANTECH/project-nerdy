import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Production hardening:
 *  - poweredByHeader off (don't advertise Next.js to scanners)
 *  - productionBrowserSourceMaps false (no client source maps in prod — keeps lib/ paths off the wire)
 *  - reactStrictMode on (catches double-effects early)
 *  - response headers locked down (CSP-lite, framing, sniff, referrer, permissions)
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
    /**
     * RSC client-side route cache. Re-visiting a recently-viewed admin page
     * (e.g. clicking back into Dashboard from Tickets) skips the server
     * round-trip and renders from cache. Sidebar nav feels instant.
     *   dynamic: 30s for force-dynamic pages (admin tree)
     *   static : 180s for static segments (login etc.)
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses are encrypted in transit and not meant for cross-origin reuse.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
