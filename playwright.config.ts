import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Le suite aprono più scene WebGL reali: limitare il parallelismo evita
  // contesa GPU e mantiene affidabili i test delle animazioni temporizzate.
  workers: process.env.CI ? 1 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The installed browser uses the real GPU locally. CI's bundled Chromium
        // receives an explicit WebGL backend so both paths stay testable.
        channel: process.env.CI ? undefined : 'chrome',
        launchOptions: process.env.CI
          ? {
              args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
            }
          : undefined
      }
    }
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
