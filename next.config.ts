import type { NextConfig } from "next";

// 서버가 없는 정적 사이트로 내보냅니다. `next build` 결과는 out/ 폴더에 생깁니다.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
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
