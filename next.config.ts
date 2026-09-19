import type { NextConfig } from "next";

// Same static-export setup as the official Meichu demo. On GitHub Pages the site lives under
// /<repo-name>, so CI passes NEXT_PUBLIC_BASE_PATH; locally it stays empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
