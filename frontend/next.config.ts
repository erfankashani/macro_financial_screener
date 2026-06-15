import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server output for a small production container image.
  output: "standalone",
  // Pin the workspace root to this app so a stray lockfile elsewhere on the
  // machine isn't mistaken for the project root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
