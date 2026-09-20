import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "clozer.club" }],
        destination: "https://www.clozer.club/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
