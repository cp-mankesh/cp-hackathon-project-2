import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".next"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@ados/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@ados/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@ados/agents": path.resolve(__dirname, "packages/agents/src/index.ts"),
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
});
