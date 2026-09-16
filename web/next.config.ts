import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: "dist",
  output: 'export',
  reactCompiler: true,
  compiler: {
    styledComponents: true,
  },
};

export default nextConfig;
