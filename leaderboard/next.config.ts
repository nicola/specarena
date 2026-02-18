import type { NextConfig } from "next";
import path from "path";

const rootDir = path.resolve(process.cwd(), "..");

const engineUrl = process.env.ENGINE_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@arena/engine"],
  turbopack: {
    root: rootDir,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${engineUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
