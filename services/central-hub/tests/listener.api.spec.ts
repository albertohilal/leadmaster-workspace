import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011';

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

test.describe('Listener API', () => {
  
  test('GET /listener/status - obtener estado del listener', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.get(`${BASE_URL}/listener/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('mode');
    expect(data.mode).toMatch(/^(listen|respond)$/);
  });

  test('POST /listener/mode - cambiar modo a respond', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/listener/mode`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { mode: 'respond' }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.mode).toBe('respond');
    
    // Verificar que el cambio persiste
    const statusResponse = await request.get(`${BASE_URL}/listener/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const statusData = await statusResponse.json();
    expect(statusData.mode).toBe('respond');
  });

  test('POST /listener/mode - cambiar modo a listen', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/listener/mode`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { mode: 'listen' }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.mode).toBe('listen');
  });

  test('POST /listener/mode - rechazar modo inválido', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/listener/mode`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { mode: 'invalid_mode' }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data).toHaveProperty('error');
  });

  test('POST /listener/ia/enable - habilitar IA para un lead', async ({ request }) => {
    const token = await getAuthToken(request);
    const testPhone = '5491112345678';
    
    const response = await request.post(`${BASE_URL}/listener/ia/enable`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { telefono: testPhone }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    // Si falla, mostrar el error para debugging
    if (!data.success) {
      console.log('Error en ia/enable:', data.error);
    }
    expect(data.success).toBe(true);
    expect(data.telefono).toBe(testPhone);
    expect(data.ia_enabled).toBe(true);
  });

  test('POST /listener/ia/disable - deshabilitar IA para un lead', async ({ request }) => {
    const token = await getAuthToken(request);
    const testPhone = '5491112345678';
    
    const response = await request.post(`${BASE_URL}/listener/ia/disable`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { telefono: testPhone }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    // Si falla, mostrar el error para debugging
    if (!data.success) {
      console.log('Error en ia/disable:', data.error);
    }
    expect(data.success).toBe(true);
    expect(data.telefono).toBe(testPhone);
    expect(data.ia_enabled).toBe(false);
  });

  test('POST /listener/ia/enable - validar teléfono requerido', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/listener/ia/enable`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {},
      failOnStatusCode: false
    });
    
    // Puede retornar 400 o 200 con success:false según implementación
    const data = await response.json();
    
    if (response.status() === 400) {
      expect(data).toHaveProperty('error');
    } else {
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    }
  });

  test('POST /listener/ia/disable - validar teléfono requerido', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/listener/ia/disable`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {},
      failOnStatusCode: false
    });
    
    // Puede retornar 400 o 200 con success:false según implementación
    const data = await response.json();
    
    if (response.status() === 400) {
      expect(data).toHaveProperty('error');
    } else {
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    }
  });

  test('POST /listener/test-message - simular mensaje en modo listen', async ({ request }) => {
    const token = await getAuthToken(request);
    // Primero configurar modo listen
    await request.post(`${BASE_URL}/listener/mode`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { mode: 'listen' }
    });
    
    const response = await request.post(`${BASE_URL}/listener/test-message`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        cliente_id: 52,
        telefono: '5491112345678',
        texto: 'hola, soy un test'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('respuesta');
    expect(data).toHaveProperty('enviado');
    expect(data.enviado).toBe(false); // En modo listen no envía
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Modo no respond');
  });

  test('POST /listener/test-message - simular mensaje en modo respond', async ({ request }) => {
    const token = await getAuthToken(request);
    // Configurar modo respond y habilitar IA
    await request.post(`${BASE_URL}/listener/mode`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { mode: 'respond' }
    });
    
    await request.post(`${BASE_URL}/listener/ia/enable`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { telefono: '5491112345678' }
    });
    
    const response = await request.post(`${BASE_URL}/listener/test-message`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        cliente_id: 52,
        telefono: '5491112345678',
        texto: 'necesito información'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('respuesta');
    expect(data).toHaveProperty('enviado');
    
    // Si la sesión no está activa, debe indicarlo
    if (data.error) {
      expect(data.error).toMatch(/Sesión de WhatsApp|IA deshabilitada/);
    }
  });

  test('POST /listener/test-message - validar campos requeridos', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/listener/test-message`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { cliente_id: 52 }
    });
    
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('GET /listener/logs - obtener logs del listener', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.get(`${BASE_URL}/listener/logs`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(Array.isArray(data)).toBeTruthy();
    // Puede estar vacío o tener logs
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('timestamp');
    }
  });
});
