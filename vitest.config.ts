import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;
const alias = {
  "@/generated": path.resolve(root, "generated"),
  "@messages": path.resolve(root, "messages"),
  "@": path.resolve(root, "src"),
  "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Une base PostgreSQL partagée : exécution séquentielle des fichiers.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
