import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "out/**", "build/**", "node_modules/**", ".browser-tests/**", "test-results/**", "playwright-report/**", "next-env.d.ts"]),
]);
