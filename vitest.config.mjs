import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Next.js resolves "server-only" itself; outside Next it is an empty marker.
      "server-only": fileURLToPath(new URL("./tests/support/server-only.js", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.{js,mjs}"],
    environment: "node",
  },
});
