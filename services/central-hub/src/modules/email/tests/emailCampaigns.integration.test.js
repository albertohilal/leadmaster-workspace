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
      subject: 'Promocion especial',
      text: '<h1>Hola</h1>'
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
      null,
      null,
      null,
      0,
      0,
      0,
      null
    ]);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 321,
        cliente_id: 77,
        nombre: 'Campana Email Marzo',
        subject: 'Promocion especial',
        text: '<h1>Hola</h1>',
        estado: 'borrador'
      }
    });
  });

  test('rechaza falta de nombre', async () => {
    const response = await makeRequest(server, {
      subject: 'Promocion especial',
      text: '<h1>Hola</h1>'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'nombre' });
  });

  test('rechaza falta de subject', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      text: '<h1>Hola</h1>'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'subject' });
  });

  test('rechaza falta de text', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Promocion especial'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'text' });
  });

  test('rechaza asunto del contrato viejo', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      asunto: 'Promocion especial',
      text: '<h1>Hola</h1>'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'asunto' });
  });

  test('rechaza body del contrato viejo', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Promocion especial',
      body: '<h1>Hola</h1>'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'body' });
  });

  test('rechaza email_from no permitido en create minimal', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Promocion especial',
      text: '<h1>Hola</h1>',
      email_from: 'marketing@dominio.com'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'email_from' });
  });

  test('rechaza channel no permitido', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Promocion especial',
      text: '<h1>Hola</h1>',
      channel: 'EMAIL'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'channel' });
  });

  test('rechaza estado controlado por servidor', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Promocion especial',
      text: '<h1>Hola</h1>',
      estado: 'pendiente'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'estado' });
  });

  test('rechaza campo desconocido', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Promocion especial',
      text: '<h1>Hola</h1>',
      html: '<p>HTML</p>'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'html' });
  });
});