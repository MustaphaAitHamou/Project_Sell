import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      ".next-build/**",
      "test-results/**",
      "generated/**",
      "node_modules/**",
      "storage/**",
      "storage-test/**",
      "storage-e2e/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
      // Les images d'annonces sont servies en WebP pré-dimensionné par /api/images.
      "@next/next/no-img-element": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next/link", message: "Utilisez Link depuis @/i18n/navigation (préfixe de langue)." },
          ],
        },
      ],
    },
  },
];
export default config;
