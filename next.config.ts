import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The clickable prototype is a static copy in public/prototype/index.html; Next doesn't serve a
  // folder's index.html by itself, so /prototype (and /prototype/, redirected to it) points there.
  async rewrites() {
    return [{ source: "/prototype", destination: "/prototype/index.html" }];
  },
};

export default nextConfig;
