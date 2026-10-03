import type { NextConfig } from "next";

/**
 * Web (Vercel): normal build incl. API routes (RevenueCat webhook, entitlement restore).
 * Android/Capacitor: `npm run build:mobile` sets LINGO_MOBILE_BUILD=1 and produces a static export in `out/`
 * (API routes are excluded by the script, because static exports cannot contain route handlers).
 */
const isMobileBuild = process.env.LINGO_MOBILE_BUILD === "1";

const nextConfig: NextConfig = isMobileBuild
  ? { output: "export", images: { unoptimized: true } }
  : {};

export default nextConfig;
