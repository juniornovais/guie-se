import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  deploymentId: process.env.RENDER_GIT_COMMIT || undefined,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
