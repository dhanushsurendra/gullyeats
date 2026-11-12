// QA end-to-end tests for the customer app, the admin dashboard, the API and
// flows across them. Starts its own backend (on the DB in backend/.env) and
// both web apps on spare ports, so running dev servers are left alone.
//   npx playwright test            all
//   npx playwright test e2e/admin  one file
import { defineConfig, devices } from '@playwright/test'
import { API, CUSTOMER, ADMIN } from './e2e/urls.js'

// dotenv never overrides these, so CORS and QR links point at the test servers.
const backendEnv = { PORT: '5050', FRONTEND_URL_CUSTOMER: CUSTOMER, FRONTEND_URL: CUSTOMER, FRONTEND_URL_ADMIN: ADMIN }

export default defineConfig({
  testDir: './e2e',
  // One cart is shared and some tests close or suspend it, so run in order.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  use: { baseURL: CUSTOMER, trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Pixel 7'] },
  webServer: [
    { command: 'node server.js', cwd: '../backend', env: backendEnv, url: `${API}/orders/get-truth-line`, timeout: 180_000 },
    { command: `npx vite --port 5183 --strictPort`, url: CUSTOMER, env: { VITE_API_BASE_URL: `${API}` } },
    { command: `npx vite --port 5184 --strictPort`, cwd: '../gullyeats-admin', url: ADMIN, env: { VITE_API_URL: API.replace(/\/api$/, '') } },
  ],
})
