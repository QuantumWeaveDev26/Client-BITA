import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // PO files, certificates and site photos are uploaded through Server Actions (default limit 1 MB).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
