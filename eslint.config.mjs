import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 페이지 이동에 일부러 <a>를 씁니다. <Link>는 이동할 때 fetch를 쓰는데,
      // 이 사이트는 connect-src 'none'으로 모든 fetch를 막아 두었기 때문입니다.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
