import type { NextConfig } from "next";

// See lib/basePath.ts for why this exists — GitHub Pages project sites serve
// from a subpath (https://user.github.io/repo-name/), not the domain root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // Fully static export — no Node server required at runtime
  images: {
    unoptimized: true, // next/image optimization needs a server; disable for static export
  },
  trailingSlash: true, // Makes static export work reliably when opened via file:// or any static host
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
};

export default nextConfig;
