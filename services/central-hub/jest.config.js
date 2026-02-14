module.exports = {
  // Directorio raíz del proyecto
  rootDir: "./",

  // Entorno de Node.js para tests de backend
  testEnvironment: "node",

  // Ejecutar tests unitarios y de integración Jest
  testMatch: [
    "**/src/**/?(*.)+(test).js",
    "**/?(*.)+(test).js",
    "**/tests/**/?(*.)+(integration.test).js"
  ],

  // Ignorar Playwright / E2E y frontend
  testPathIgnorePatterns: [
    "/node_modules/",
    "/frontend/",
    "/tests/.*\\.spec\\.ts$",
    "/tests/.*\\.spec\\.js$"
  ],

  // Setup global de Jest (mocks automáticos)
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Coverage habilitado
  collectCoverage: true,

  // Scope explícito de coverage (QR Authorization core)
  collectCoverageFrom: [
    "src/modules/whatsappQrAuthorization/repositories/**/*.js",
    "src/modules/whatsappQrAuthorization/services/**/*.js"
  ],

  // Output
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"]
};
