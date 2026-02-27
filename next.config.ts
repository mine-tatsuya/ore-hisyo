import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias ??= {};

    // Prisma が生成する `#main-entry-point` の package import を実ファイルに解決させる
    config.resolve.alias["#main-entry-point"] = path.resolve(
      process.cwd(),
      "node_modules/.prisma/client/index.js",
    );

    return config;
  },
};

export default nextConfig;
