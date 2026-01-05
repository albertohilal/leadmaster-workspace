/**
 * QR Authorization Service - Unit Tests
 * 
 * Tests para la capa de lógica de negocio del módulo whatsappQrAuthorization.
 * Mockea el repository para aislar tests del service.
 */

const qrAuthorizationService = require('../services/qrAuthorizationService');

// Mock del repository
jest.mock('../repositories/qrAuthorizationRepository');

const qrAuthorizationRepository = require('../repositories/qrAuthorizationRepository');

describe('QR Authorization Service', () => {
  
  beforeEach(() => {
    // Limpiar mocks antes de cada test
    jest.clearAllMocks();
  });

  describe('isAuthorized', () => {
    
    test('devuelve true cuando repository confirma autorización', async () => {
      qrAuthorizationRepository.isClientAuthorized.mockResolvedValue(true);
      
      const result = await qrAuthorizationService.isAuthorized(51);
      
      expect(result).toBe(true);
      expect(qrAuthorizationRepository.isClientAuthorized).toHaveBeenCalledWith(51);
    });

    test('devuelve false cuando repository niega autorización', async () => {
      qrAuthorizationRepository.isClientAuthorized.mockResolvedValue(false);
      
      const result = await qrAuthorizationService.isAuthorized(51);
      
      expect(result).toBe(false);
    });

    test('devuelve false en caso de error DB (seguridad)', async () => {
      qrAuthorizationRepository.isClientAuthorized.mockRejectedValue(
        new Error('Connection timeout')
      );
      
      const result = await qrAuthorizationService.isAuthorized(51);
      
      expect(result).toBe(false);
    });
  });

  describe('authorizeQrSession', () => {
    
    test('autoriza cliente exitosamente', async () => {
      const mockResult = {
        clienteId: 51,
        enabled: true,
        enabledAt: new Date('2026-01-05T10:00:00Z'),
        expiresAt: null
      };
      
      qrAuthorizationRepository.enableClient.mockResolvedValue(mockResult);
      
      const result = await qrAuthorizationService.authorizeQrSession({
        clientId: 51,
        authorizedBy: 1,
        expiresAt: null
      });
      
      expect(result.status).toBe('AUTHORIZED');
      expect(result.clientId).toBe(51);
      expect(result.enabledAt).toEqual(mockResult.enabledAt);
      expect(result.expiresAt).toBe(null);
      
      expect(qrAuthorizationRepository.enableClient).toHaveBeenCalledWith({
        clienteId: 51,
        adminId: 1,
        expiresAt: null
      });
    });

    test('autoriza cliente con fecha de expiración', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const mockResult = {
        clienteId: 51,
        enabled: true,
        enabledAt: new Date('2026-01-05T10:00:00Z'),
        expiresAt
      };
      
      qrAuthorizationRepository.enableClient.mockResolvedValue(mockResult);
      
      const result = await qrAuthorizationService.authorizeQrSession({
        clientId: 51,
        authorizedBy: 1,
        expiresAt
      });
      
      expect(result.status).toBe('AUTHORIZED');
      expect(result.expiresAt).toEqual(expiresAt);
    });

    test('devuelve ERROR en caso de fallo en repository', async () => {
      qrAuthorizationRepository.enableClient.mockRejectedValue(
        new Error('Database error')
      );
      
      const result = await qrAuthorizationService.authorizeQrSession({
        clientId: 51,
        authorizedBy: 1
      });
      
      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Database error');
      expect(result.clientId).toBe(51);
    });
  });

  describe('revokeQrSession', () => {
    
    test('revoca cliente existente exitosamente', async () => {
      const mockResult = {
        found: true,
        revoked: true,
        clientId: 51,
        revokedAt: new Date('2026-01-05T11:00:00Z')
      };
      
      qrAuthorizationRepository.revokeClient.mockResolvedValue(mockResult);
      
      const result = await qrAuthorizationService.revokeQrSession({
        clientId: 51,
        revokedBy: 1
      });
      
      expect(result.status).toBe('REVOKED');
      expect(result.clientId).toBe(51);
      expect(result.revokedAt).toEqual(mockResult.revokedAt);
      
      expect(qrAuthorizationRepository.revokeClient).toHaveBeenCalledWith({
        clienteId: 51,
        adminId: 1
      });
    });

    test('devuelve NOT_FOUND para cliente inexistente', async () => {
      const mockResult = {
        found: false,
        revoked: false,
        clientId: 999
      };
      
      qrAuthorizationRepository.revokeClient.mockResolvedValue(mockResult);
      
      const result = await qrAuthorizationService.revokeQrSession({
        clientId: 999,
        revokedBy: 1
      });
      
      expect(result.status).toBe('NOT_FOUND');
      expect(result.error).toBe('Client authorization not found');
      expect(result.clientId).toBe(999);
    });

    test('permite revocar sin especificar admin', async () => {
      const mockResult = {
        found: true,
        revoked: true,
        clienteId: 51,
        revokedAt: new Date()
      };
      
      qrAuthorizationRepository.revokeClient.mockResolvedValue(mockResult);
      
      await qrAuthorizationService.revokeQrSession({
        clientId: 51
      });
      
      expect(qrAuthorizationRepository.revokeClient).toHaveBeenCalledWith({
        clienteId: 51,
        adminId: null
      });
    });

    test('devuelve ERROR en caso de fallo en repository', async () => {
      qrAuthorizationRepository.revokeClient.mockRejectedValue(
        new Error('Connection lost')
      );
      
      const result = await qrAuthorizationService.revokeQrSession({
        clientId: 51,
        revokedBy: 1
      });
      
      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Connection lost');
    });
  });

  describe('getQrSession', () => {
    
    test('devuelve autorización mapeada para cliente existente', async () => {
      const mockAuth = {
        id: 1,
        cliente_id: 51,
        enabled: 1,
        enabled_by_admin_id: 1,
        enabled_at: new Date('2026-01-05T10:00:00Z'),
        expires_at: new Date('2026-12-31T23:59:59Z'),
        revoked_at: null,
        created_at: new Date('2026-01-05T09:00:00Z')
      };
      
      qrAuthorizationRepository.getAuthorization.mockResolvedValue(mockAuth);
      
      const result = await qrAuthorizationService.getQrSession(51);
      
      expect(result).not.toBe(null);
      expect(result.clientId).toBe(51);
      expect(result.enabled).toBe(true);
      expect(result.enabledAt).toEqual(mockAuth.enabled_at);
      expect(result.expiresAt).toEqual(mockAuth.expires_at);
      expect(result.revokedAt).toBe(null);
      expect(result.createdAt).toEqual(mockAuth.created_at);
      
      expect(qrAuthorizationRepository.getAuthorization).toHaveBeenCalledWith(51);
    });

    test('mapea enabled=0 a false', async () => {
      const mockAuth = {
        id: 1,
        cliente_id: 51,
        enabled: 0,
        enabled_by_admin_id: 1,
        enabled_at: new Date('2026-01-05T10:00:00Z'),
        expires_at: null,
        revoked_at: new Date('2026-01-05T11:00:00Z'),
        created_at: new Date('2026-01-05T09:00:00Z')
      };
      
      qrAuthorizationRepository.getAuthorization.mockResolvedValue(mockAuth);
      
      const result = await qrAuthorizationService.getQrSession(51);
      
      expect(result.enabled).toBe(false);
      expect(result.revokedAt).toEqual(mockAuth.revoked_at);
    });

    test('devuelve null para cliente inexistente', async () => {
      qrAuthorizationRepository.getAuthorization.mockResolvedValue(null);
      
      const result = await qrAuthorizationService.getQrSession(999);
      
      expect(result).toBe(null);
    });

    test('devuelve null en caso de error DB', async () => {
      qrAuthorizationRepository.getAuthorization.mockRejectedValue(
        new Error('Query timeout')
      );
      
      const result = await qrAuthorizationService.getQrSession(51);
      
      expect(result).toBe(null);
    });
  });
});
