import type { NextConfig } from "next";
import { previewMode } from "./lib/preview";

const nextConfig: NextConfig = {
  async headers() {
    if (!previewMode) return [];

    return [{
      source: "/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "private, no-store" },
      ],
    }];
  },
};

export default nextConfig;
