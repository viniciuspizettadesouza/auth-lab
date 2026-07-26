import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/setup/server-only.ts", import.meta.url)
      )
    }
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    coverage: {
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"]
    }
  }
});
