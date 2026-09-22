import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Wrangler/miniflare bindings are only for `next dev`. Starting them during
// `next build` (CI and Cloudflare Workers Builds) hangs static generation.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
