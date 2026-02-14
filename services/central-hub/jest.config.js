module.exports = {
  // Directorio raíz del proyecto
  rootDir: "./",

  // Entorno de Node.js para tests de backend
  testEnvironment: "node",

  /**
   * 🔒 Cargar variables de entorno de testing
   * (usa .env.test automáticamente)
   */
  setupFiles: ["<rootDir>/jest.env.js"],

  /**
   * Setup global de Jest (mocks automáticos)
   */
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  /**
   * Ejecutar tests unitarios y de integración
   */
  testMatch: [
    "**/src/**/?(*.)+(test).js",
    "**/?(*.)+(test).js",
    "**/tests/**/?(*.)+(integration.test).js"
  ],

  /**
   * Ignorar Playwright / E2E y frontend
   */
  testPathIgnorePatterns: [
    "/node_modules/",
    "/frontend/",
    "/tests/.*\\.spec\\.ts$",
    "/tests/.*\\.spec\\.js$"
  ],

  /**
   * Coverage habilitado
   */
  collectCoverage: true,

  /**
   * Scope explícito de coverage (QR Authorization core)
   */
  collectCoverageFrom: [
    "src/modules/whatsappQrAuthorization/repositories/**/*.js",
    "src/modules/whatsappQrAuthorization/services/**/*.js"
  ],

  /**
   * Output de coverage
   */
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"]
};
