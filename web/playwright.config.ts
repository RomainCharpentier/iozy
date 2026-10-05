import { defineConfig, devices } from '@playwright/test'

/**
 * The end-to-end tests: from the click to the database, with nothing mocked.
 *
 * <h2>What they add to the 215 unit tests</h2>
 * Those check one rule at a time, in one module. These check that a **whole
 * journey holds**: that the button is there, that it calls the right route,
 * that the server writes, and that the next screen shows it. No unit test can
 * catch a form wired to the wrong field or a missing cache invalidation — the
 * screen just stays on the previous state.
 *
 * <h2>A throwaway stack, never the real data</h2>
 * `globalSetup` starts `backend/docker-compose.e2e.yml`: its own database, its
 * own port. Separation by owner would not be enough — the catalog is shared,
 * and the series invented here would appear in the search of the real
 * collection.
 *
 * <h2>A single worker, on purpose</h2>
 * These tests share one database. Running them in parallel would need either
 * one account per worker (the catalog would stay common), or one database per
 * worker (three Docker stacks). The gain is not worth this complexity: the
 * suite runs in less than a minute.
 */
export default defineConfig({
  testDir: './e2e',
  // The startup of the Docker stack is counted separately (see globalSetup); a
  // journey must not drag on: beyond this, a test is waiting for something
  // that will not happen.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/pile.setup.ts',
  globalTeardown: './e2e/pile.teardown.ts',
  use: {
    baseURL: 'http://localhost:5174',
    // The trace of the first failure is enough to understand: systematic
    // screenshots and videos fill the disk without teaching anything more.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // The session is opened ONCE, then replayed by each journey: sending
    // every test through the login screen would add the same start ten
    // times, and ten ways to fail it.
    { name: 'compte', testMatch: /compte.setup.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'parcours',
      testIgnore: /compte.setup.ts/,
      dependencies: ['compte'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/session.json' },
    },
  ],
  webServer: {
    // The DEV server, and not `preview`: it carries the `/api` proxy, so the
    // "single origin" setup that the application assumes everywhere (see
    // vite.config.ts, nginx.conf, vercel.json).
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { IOZYCORE_API: 'http://localhost:8090' },
  },
})
