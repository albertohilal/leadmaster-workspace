// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './tests',
  timeout: 60000, // Aumentado para pruebas E2E
  retries: 1,
  use: {
    baseURL: 'http://localhost:3012', // Puerto correcto del backend
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
    // Configuración para pruebas E2E
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  projects: [
    {
      name: 'API Tests',
      testMatch: '**/*.api.spec.ts',
    },
    {
      name: 'E2E Tests - Campaigns',
      testMatch: '**/*.e2e.spec.ts',
      use: {
        baseURL: 'http://localhost:5174', // Frontend para E2E
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Integration Tests',
      testMatch: '**/*.integration.spec.ts',
    },
  ],
  // Configuración para servidores locales
  webServer: [
    {
      command: 'PORT=3012 node src/index.js',
      port: 3012,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      port: 5174,
      cwd: './frontend',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
};

module.exports = config;
