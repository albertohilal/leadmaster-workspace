// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './', // Buscar tests en todo el proyecto
  testMatch: ['**/tests/**/*.spec.ts', '**/e2e/**/*.spec.js'], // Incluir tests/ y e2e/
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
      name: 'E2E Tests - WhatsApp',
      testMatch: '**/e2e/**/*.spec.js',
      use: {
        baseURL: process.env.E2E_BASE_URL || 'https://desarrolloydisenioweb.com.ar',
        viewport: { width: 1280, height: 720 },
        screenshot: 'on', // Siempre capturar screenshots para evidencia
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        
        // Configuración para producción en VPS (headless)
        headless: true,
        
        // Ignorar errores HTTPS en desarrollo (remover en producción si hay SSL válido)
        ignoreHTTPSErrors: false,
        
        // Timeouts para entorno productivo (red puede ser más lenta)
        navigationTimeout: 30000,
        actionTimeout: 15000,
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
