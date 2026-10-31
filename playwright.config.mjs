import { defineConfig, devices } from "@playwright/test";

// Two servers from the same production build: one with the fake model adapter (a local run) and one
// with no adapter, standing in for Vercel. Run "next build" first (npm run test:e2e does).
const FAKE_PORT = 3101;
const NONE_PORT = 3102;

// E2E_DEV_URL points the fake-adapter project at an already running dev server instead
// (e.g. REDLINE_MODEL_ADAPTER=fake npx next dev -p 3110, then E2E_DEV_URL=http://localhost:3110).
const DEV_URL = process.env.E2E_DEV_URL;

const { REDLINE_MODEL_ADAPTER: _ignored, ...envWithoutAdapter } = process.env;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  projects: [
    { name: "fake-adapter", testMatch: /(summary|ask|risk-flags|upload|trust-fixes|clean-result|outside-references)\.spec\.mjs/, use: { baseURL: DEV_URL ?? `http://localhost:${FAKE_PORT}` } },
    { name: "no-adapter", testMatch: /unavailable\.spec\.mjs/, use: { baseURL: `http://localhost:${NONE_PORT}` } },
    // Sign-in links from the local auth server return only to its site host, 127.0.0.1 (supabase/config.toml).
    { name: "library", testMatch: /(library|red-lines|saved-reviews|outside-references-saved)\.spec\.mjs/, use: { baseURL: `http://127.0.0.1:${FAKE_PORT}` } },
  ],
  webServer: DEV_URL ? undefined : [
    {
      command: `npx next start -p ${FAKE_PORT}`,
      url: `http://localhost:${FAKE_PORT}/review`,
      env: { ...envWithoutAdapter, REDLINE_MODEL_ADAPTER: "fake" },
      reuseExistingServer: false,
    },
    {
      command: `npx next start -p ${NONE_PORT}`,
      url: `http://localhost:${NONE_PORT}/review`,
      env: envWithoutAdapter,
      reuseExistingServer: false,
    },
  ],
});
