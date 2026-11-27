import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra o ambiente LOCAL (Supabase local + `next dev` com DEV_EMAIL_LOGIN=true).
 * O login Google real não é automatizável; o fluxo de sessão/cookies/RLS é o mesmo.
 */
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/.results",
  timeout: 180_000, // primeira execução compila as páginas sob demanda (next dev)
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
