import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["tame-gale.boxd.sh"],
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/cli",
    "prisma",
    "@prisma/client",
    "esbuild",
  ],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
