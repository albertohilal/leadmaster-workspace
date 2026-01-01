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

test.describe('Sender API', () => {
  
  test('POST /sender/messages/send - enviar mensaje individual (sin sesión activa)', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/sender/messages/send`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        destinatario: '5491112345678',
        mensaje: 'Mensaje de prueba desde test'
      }
    });
    
    // Puede retornar 503 si la sesión no está lista
    if (response.status() === 503) {
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Sesión de WhatsApp no lista');
      expect(data).toHaveProperty('estado');
    } else if (response.status() === 201) {
      // Si la sesión está activa, debe crear el envío
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('destinatario');
      expect(data).toHaveProperty('mensaje');
      expect(data).toHaveProperty('estado');
      expect(data.estado).toBe('enviado');
    }
  });

  test('POST /sender/messages/send - validar campos requeridos', async ({ request }) => {
    const token = await getAuthToken(request);
    // Sin destinatario
    const response1 = await request.post(`${BASE_URL}/sender/messages/send`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { mensaje: 'test' },
      failOnStatusCode: false
    });
    expect([400, 503]).toContain(response1.status());
    
    // Sin mensaje
    const response2 = await request.post(`${BASE_URL}/sender/messages/send`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { destinatario: '5491112345678' },
      failOnStatusCode: false
    });
    expect([400, 503]).toContain(response2.status());
    
    // Sin datos
    const response3 = await request.post(`${BASE_URL}/sender/messages/send`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {},
      failOnStatusCode: false
    });
    expect([400, 503]).toContain(response3.status());
  });

  test('POST /sender/messages/bulk - envío masivo (sin sesión activa)', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/sender/messages/bulk`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        campañaId: 1,
        mensajes: [
          { destinatario: '5491112345678', mensaje: 'Test 1' },
          { destinatario: '5491187654321', mensaje: 'Test 2' }
        ]
      }
    });
    
    // Puede retornar 503 si la sesión no está lista
    if (response.status() === 503) {
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Sesión de WhatsApp no lista');
    } else if (response.status() === 201) {
      // Si la sesión está activa, debe procesar el envío
      const data = await response.json();
      expect(data).toHaveProperty('campañaId');
      expect(data).toHaveProperty('enviados');
      expect(data).toHaveProperty('fallidos');
      expect(data).toHaveProperty('estado');
      expect(data).toHaveProperty('resultados');
      expect(Array.isArray(data.resultados)).toBeTruthy();
    }
  });

  test('POST /sender/messages/bulk - validar estructura de mensajes', async ({ request }) => {
    const token = await getAuthToken(request);
    // Sin campañaId
    const response1 = await request.post(`${BASE_URL}/sender/messages/bulk`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { mensajes: [] },
      failOnStatusCode: false
    });
    const data1 = await response1.json();
    expect([400, 503]).toContain(response1.status());
    expect(data1).toHaveProperty('error');
    
    // Sin mensajes array
    const response2 = await request.post(`${BASE_URL}/sender/messages/bulk`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { campañaId: 1 },
      failOnStatusCode: false
    });
    const data2 = await response2.json();
    expect([400, 503]).toContain(response2.status());
    expect(data2).toHaveProperty('error');
    
    // Mensajes no es array
    const response3 = await request.post(`${BASE_URL}/sender/messages/bulk`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { campañaId: 1, mensajes: 'invalid' },
      failOnStatusCode: false
    });
    const data3 = await response3.json();
    expect([400, 503]).toContain(response3.status());
    expect(data3).toHaveProperty('error');
  });

  test('POST /sender/messages/bulk - diferentes formatos de mensaje', async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.post(`${BASE_URL}/sender/messages/bulk`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        campañaId: 1,
        mensajes: [
          { destinatario: '549111', mensaje: 'Test formato 1' },
          { telefono: '549222', mensaje: 'Test formato 2' },
          { phoneNumber: '549333', message: 'Test formato 3' },
          { destinatario: '549444', texto: 'Test formato 4' }
        ]
      }
    });
    
    // El servicio debe poder manejar diferentes formatos
    if (response.status() === 201 || response.status() === 503) {
      const data = await response.json();
      expect(data).toHaveProperty('campañaId');
    }
  });

  test('GET /sender/messages/status/:id - consultar estado de mensaje', async ({ request }) => {
    const token = await getAuthToken(request);
    const testId = 12345;
    const response = await request.get(`${BASE_URL}/sender/messages/status/${testId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('estado');
    expect(data).toHaveProperty('fecha');
  });

  test('Sender endpoints - responden en tiempo razonable', async ({ request }) => {
    const token = await getAuthToken(request);
    const startTime = Date.now();
    
    // Probar endpoint de envío individual
    await request.post(`${BASE_URL}/sender/messages/send`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        destinatario: '5491112345678',
        mensaje: 'Test de performance'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Debe responder en menos de 3 segundos (incluso si falla)
    expect(responseTime).toBeLessThan(3000);
  });

  test('POST /sender/messages/send - manejo de números con diferentes formatos', async ({ request }) => {
    const token = await getAuthToken(request);
    const phoneFormats = [
      '5491112345678',
      '+5491112345678',
      '549111234567',
    ];
    
    for (const phone of phoneFormats) {
      const response = await request.post(`${BASE_URL}/sender/messages/send`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          destinatario: phone,
          mensaje: `Test para ${phone}`
        }
      });
      
      // Debe aceptar o rechazar de forma consistente
      expect([201, 400, 503]).toContain(response.status());
    }
  });
});
