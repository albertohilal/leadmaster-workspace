/**
 * QR Authorization Repository - Unit Tests
 * 
 * Tests para la capa de persistencia del módulo whatsappQrAuthorization.
 * Usa mocks de pool.query para no depender de DB real.
 */

const qrAuthorizationRepository = require('../repositories/qrAuthorizationRepository');

// Mock del pool de conexiones MySQL
jest.mock('../../../config/db', () => ({
  query: jest.fn()
}));

const pool = require('../../../config/db');

describe('QR Authorization Repository', () => {
  
  beforeEach(() => {
    // Limpiar mocks antes de cada test
    jest.clearAllMocks();
  });

  describe('isClientAuthorized', () => {
    
    test('devuelve true para cliente autorizado válido', async () => {
      const mockRows = [{
        enabled: 1,
        expires_at: null,
        revoked_at: null
      }];
      
      pool.query.mockResolvedValue([mockRows]);
      
      const result = await qrAuthorizationRepository.isClientAuthorized(51);
      
      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT enabled, expires_at, revoked_at'),
        [51]
      );
    });

    test('devuelve false para cliente no autorizado (enabled=0)', async () => {
      const mockRows = [{
        enabled: 0,
        expires_at: null,
        revoked_at: null
      }];
      
      pool.query.mockResolvedValue([mockRows]);
      
      const result = await qrAuthorizationRepository.isClientAuthorized(51);
      
      expect(result).toBe(false);
    });

    test('devuelve false para cliente revocado', async () => {
      const mockRows = [{
        enabled: 1,
        expires_at: null,
        revoked_at: new Date('2026-01-05T10:00:00Z')
      }];
      
      pool.query.mockResolvedValue([mockRows]);
      
      const result = await qrAuthorizationRepository.isClientAuthorized(51);
      
      expect(result).toBe(false);
    });

    test('devuelve false para cliente expirado', async () => {
      const mockRows = [{
        enabled: 1,
        expires_at: new Date('2025-12-31T23:59:59Z'), // Pasado
        revoked_at: null
      }];
      
      pool.query.mockResolvedValue([mockRows]);
      
      const result = await qrAuthorizationRepository.isClientAuthorized(51);
      
      expect(result).toBe(false);
    });

    test('devuelve true para cliente no expirado', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 días en el futuro
      
      const mockRows = [{
        enabled: 1,
        expires_at: futureDate,
        revoked_at: null
      }];
      
      pool.query.mockResolvedValue([mockRows]);
      
      const result = await qrAuthorizationRepository.isClientAuthorized(51);
      
      expect(result).toBe(true);
    });

    test('devuelve false para cliente inexistente', async () => {
      pool.query.mockResolvedValue([[]]);
      
      const result = await qrAuthorizationRepository.isClientAuthorized(999);
      
      expect(result).toBe(false);
    });
  });

  describe('enableClient', () => {
    
    test('inserta nuevo cliente cuando no existe', async () => {
      // Primera query: verificar si existe
      pool.query
        .mockResolvedValueOnce([[]]) // No existe
        .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT exitoso
      
      const result = await qrAuthorizationRepository.enableClient({
        clienteId: 51,
        adminId: 1,
        expiresAt: null
      });
      
      expect(result.clienteId).toBe(51);
      expect(result.enabled).toBe(true);
      expect(result.enabledAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBe(null);
      
      // Verificar que se hicieron 2 queries (SELECT + INSERT)
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO ll_whatsapp_qr_sessions'),
        expect.any(Array)
      );
    });

    test('actualiza cliente existente', async () => {
      // Primera query: cliente existe
      pool.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // Existe
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE exitoso
      
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      
      const result = await qrAuthorizationRepository.enableClient({
        clienteId: 51,
        adminId: 1,
        expiresAt
      });
      
      expect(result.clienteId).toBe(51);
      expect(result.enabled).toBe(true);
      expect(result.expiresAt).toEqual(expiresAt);
      
      // Verificar que se hicieron 2 queries (SELECT + UPDATE)
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE ll_whatsapp_qr_sessions'),
        expect.any(Array)
      );
    });
  });

  describe('revokeClient', () => {
    
    test('revoca cliente existente', async () => {
      pool.query.mockResolvedValue([{ affectedRows: 1 }]);
      
      const result = await qrAuthorizationRepository.revokeClient({
        clienteId: 51,
        adminId: 1
      });
      
      expect(result.found).toBe(true);
      expect(result.revoked).toBe(true);
      expect(result.clienteId).toBe(51);
      expect(result.revokedAt).toBeInstanceOf(Date);
      
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ll_whatsapp_qr_sessions'),
        expect.arrayContaining([expect.any(Date), 51])
      );
    });

    test('devuelve found=false para cliente inexistente', async () => {
      pool.query.mockResolvedValue([{ affectedRows: 0 }]);
      
      const result = await qrAuthorizationRepository.revokeClient({
        clienteId: 999,
        adminId: 1
      });
      
      expect(result.found).toBe(false);
      expect(result.revoked).toBe(false);
      expect(result.clienteId).toBe(999);
    });
  });

  describe('getAuthorization', () => {
    
    test('devuelve fila completa para cliente existente', async () => {
      const mockRows = [{
        id: 1,
        cliente_id: 51,
        enabled: 1,
        enabled_by_admin_id: 1,
        enabled_at: new Date('2026-01-05T10:00:00Z'),
        expires_at: null,
        revoked_at: null,
        created_at: new Date('2026-01-05T09:00:00Z')
      }];
      
      pool.query.mockResolvedValue([mockRows]);
      
      const result = await qrAuthorizationRepository.getAuthorization(51);
      
      expect(result).toEqual(mockRows[0]);
      expect(result.cliente_id).toBe(51);
      expect(result.enabled).toBe(1);
      
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, cliente_id'),
        [51]
      );
    });

    test('devuelve null para cliente inexistente', async () => {
      pool.query.mockResolvedValue([[]]);
      
      const result = await qrAuthorizationRepository.getAuthorization(999);
      
      expect(result).toBe(null);
    });
  });
});
