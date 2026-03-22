const express = require('express');
const http = require('http');

jest.mock('../../../config/db', () => ({
  execute: jest.fn()
}));

const db = require('../../../config/db');
const emailCampaignsRoutes = require('../routes/emailCampaigns.routes');

function makeRequest(server, body) {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/email/campaigns',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('POST /api/email/campaigns', () => {
  let server;

  beforeAll((done) => {
    const app = express();
    app.use(express.json());

    app.use('/api/email/campaigns', (req, res, next) => {
      req.user = { id: 1, tipo: 'admin', cliente_id: 77 };
      next();
    });
    app.use('/api/email/campaigns', emailCampaignsRoutes);

    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    db.execute.mockReset();
    db.execute.mockResolvedValue([{ insertId: 321 }]);
  });

  test('crea la campana email en borrador y responde 201', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      asunto: 'Promocion especial',
      body: '<h1>Hola</h1>',
      fecha_programada: null,
      email_from: 'marketing@dominio.com',
      name_from: 'Marketing',
      reply_to_email: 'respuesta@dominio.com',
      observaciones: 'Prueba inicial'
    });

    expect(response.status).toBe(201);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.execute.mock.calls[0][0]).toContain('INSERT INTO ll_campanias_email');
    expect(db.execute.mock.calls[0][1]).toEqual([
      77,
      'Campana Email Marzo',
      'Promocion especial',
      '<h1>Hola</h1>',
      'borrador',
      null,
      'marketing@dominio.com',
      'Marketing',
      'respuesta@dominio.com',
      0,
      0,
      0,
      'Prueba inicial'
    ]);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 321,
        cliente_id: 77,
        nombre: 'Campana Email Marzo',
        asunto: 'Promocion especial',
        estado: 'borrador'
      }
    });
  });

  test('rechaza falta de nombre', async () => {
    const response = await makeRequest(server, {
      asunto: 'Promocion especial'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'nombre' });
  });

  test('rechaza falta de asunto', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'asunto' });
  });

  test('rechaza email_from invalido', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      asunto: 'Promocion especial',
      email_from: 'no-es-email'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'email_from' });
  });

  test('rechaza channel del contrato viejo', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      asunto: 'Promocion especial',
      channel: 'EMAIL'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'channel' });
  });

  test('rechaza estado controlado por servidor', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      asunto: 'Promocion especial',
      estado: 'pendiente'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'estado' });
  });

  test('rechaza fecha_programada invalida', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      asunto: 'Promocion especial',
      fecha_programada: 'fecha-no-valida'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'fecha_programada' });
  });

  test('rechaza campo desconocido', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      asunto: 'Promocion especial',
      html: '<p>HTML</p>'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'html' });
  });
});