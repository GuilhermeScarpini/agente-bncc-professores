import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Imagens vêm de uploads locais ou URLs externas de avatar; usamos <img> nativo.
      "@next/next/no-img-element": "off",
      // Variáveis com "_" são descartadas de propósito (ex.: omitir campos com rest).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "generated/**"]),
]);

export default eslintConfig;
