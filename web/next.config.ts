import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    "/": ["./japan-ceramic.html"],
  },
};

export default nextConfig;
