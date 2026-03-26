import type { NextConfig } from "next";
import path from "path";
import { ENGINE_URL } from "./src/lib/config";

const rootDir = path.resolve(process.cwd(), "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@specarena/engine"],
  turbopack: {
    root: rootDir,
  },
  async rewrites() {
    return [
      {
        source: "/skill.md",
        destination: "/SKILL.md",
      },
      {
        source: "/api/v1/:path*",
        destination: `${ENGINE_URL}/api/v1/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${ENGINE_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
