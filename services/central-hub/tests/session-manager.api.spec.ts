import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3012';

// Helper function to get auth token
async function getAuthToken(request) {
  const authResponse = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      usuario: 'Haby',
      password: 'haby1973'
    }
  });
  const authData = await authResponse.json();
  return authData.token;
}

test.describe('Session Manager API', () => {
  
  test('GET /session-manager/status - health check', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.get(`${BASE_URL}/session-manager/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('session-manager ok');
  });

  test('GET /session-manager/state - obtener estado de sesión WhatsApp', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.get(`${BASE_URL}/session-manager/state`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('state');
    expect(data).toHaveProperty('hasQR');
    expect(data).toHaveProperty('ready');
    
    // Validar que el estado es uno de los esperados
    expect(data.state).toMatch(/^(conectado|qr|desconectado)$/);
    
    // Validar tipos de datos
    expect(typeof data.hasQR).toBe('boolean');
    expect(typeof data.ready).toBe('boolean');
  });

  test('GET /session-manager/state - consistencia entre state y ready', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.get(`${BASE_URL}/session-manager/state`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    
    // Si state es 'conectado', ready debe ser true
    if (data.state === 'conectado') {
      expect(data.ready).toBe(true);
      expect(data.hasQR).toBe(false);
    }
    
    // Si state es 'qr', ready debe ser false y hasQR true
    if (data.state === 'qr') {
      expect(data.ready).toBe(false);
      expect(data.hasQR).toBe(true);
    }
    
    // Si state es 'desconectado', ready debe ser false
    if (data.state === 'desconectado') {
      expect(data.ready).toBe(false);
    }
  });

  test('GET /session-manager/qr - cuando no hay QR disponible', async ({ request }) => {
    const token = await getAuthToken(request);
    // Primero verificar el estado
    const stateResponse = await request.get(`${BASE_URL}/session-manager/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const stateData = await stateResponse.json();
    
    // Si no hay QR disponible, el endpoint debe retornar 404
    if (!stateData.hasQR) {
      const qrResponse = await request.get(`${BASE_URL}/session-manager/qr`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      expect(qrResponse.status()).toBe(404);
      
      const errorData = await qrResponse.json();
      expect(errorData).toHaveProperty('error');
    }
  });

  test('GET /session-manager/qr - cuando hay QR disponible', async ({ request }) => {
    const token = await getAuthToken(request);
    // Primero verificar el estado
    const stateResponse = await request.get(`${BASE_URL}/session-manager/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const stateData = await stateResponse.json();
    
    // Si hay QR disponible, debe retornar una imagen PNG
    if (stateData.hasQR) {
      const qrResponse = await request.get(`${BASE_URL}/session-manager/qr`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      expect(qrResponse.ok()).toBeTruthy();
      expect(qrResponse.status()).toBe(200);
      
      // Verificar que es una imagen PNG
      const contentType = qrResponse.headers()['content-type'];
      expect(contentType).toContain('image/png');
      
      // Verificar que tiene contenido
      const body = await qrResponse.body();
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test('GET /session-manager/* - endpoints responden en tiempo razonable', async ({ request }) => {
    const token = await getAuthToken(request);
    const startTime = Date.now();
    
    await request.get(`${BASE_URL}/session-manager/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await request.get(`${BASE_URL}/session-manager/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Ambas peticiones deben completarse en menos de 2 segundos
    expect(responseTime).toBeLessThan(2000);
  });
});
