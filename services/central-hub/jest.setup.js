/**
 * Configuración global de Jest
 * 
 * Este archivo se ejecuta antes de todos los tests y configura
 * el entorno de pruebas, incluyendo mocks automáticos.
 */

// Mock automático de la conexión a base de datos
jest.mock('./src/config/db');

// Configuración de timeouts si es necesario
jest.setTimeout(10000);

// Suprimir logs de console durante tests (opcional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
