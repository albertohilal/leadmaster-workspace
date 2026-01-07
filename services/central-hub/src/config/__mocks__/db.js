/**
 * Mock de conexión a base de datos para Jest
 * 
 * Este mock reemplaza mysql2/promise en el entorno de pruebas,
 * evitando la necesidad de conexiones reales a MySQL.
 * 
 * Exporta las mismas funciones que el pool de conexiones real,
 * pero como mocks de Jest para control total en tests.
 */

const mockPool = {
  query: jest.fn(),
  execute: jest.fn(),
  getConnection: jest.fn(),
  end: jest.fn(),
  
  // Métodos de pool adicionales para compatibilidad
  promise: jest.fn().mockReturnThis(),
  format: jest.fn((sql, values) => sql)
};

module.exports = mockPool;
