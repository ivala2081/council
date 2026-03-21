import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/history",
        destination: "/",
        permanent: true,
      },
      {
        source: "/projects",
        destination: "/",
        permanent: true,
      },
      {
        source: "/build/:id",
        destination: "/thread/:id#genesis",
        permanent: true,
      },
      {
        source: "/compare",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
