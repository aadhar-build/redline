import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/isolation/**/*.test.ts"],
    // The isolation seam talks to a local Supabase stack; keep files serial.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
