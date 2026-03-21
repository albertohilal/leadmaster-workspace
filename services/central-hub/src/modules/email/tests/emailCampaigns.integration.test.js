const express = require('express');
const http = require('http');

const emailRoutes = require('../routes');

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
    app.use('/api/email', emailRoutes);
    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  test('acepta el contrato minimo con nombre, subject y text', async () => {
    const response = await makeRequest(server, {
      channel: 'EMAIL',
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo',
      text: 'Contenido base del email'
    });

    expect(response.status).toBe(202);
    expect(response.body.success).toBe(true);
    expect(response.body.data.mode).toBe('preparatory');
    expect(response.body.data.persisted).toBe(false);
    expect(response.body.data.channel).toBe('EMAIL');
    expect(response.body.data.campaign).toEqual({
      channel: 'EMAIL',
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo',
      text: 'Contenido base del email'
    });
  });

  test('rechaza channel distinto de EMAIL', async () => {
    const response = await makeRequest(server, {
      channel: 'WHATSAPP',
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo',
      text: 'Contenido base del email'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'channel' });
  });

  test('rechaza falta de nombre', async () => {
    const response = await makeRequest(server, {
      subject: 'Novedades de marzo',
      text: 'Contenido base del email'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'nombre' });
  });

  test('rechaza falta de subject', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      text: 'Contenido base del email'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'subject' });
  });

  test('rechaza falta de text', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'text' });
  });

  test('rechaza to', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo',
      text: 'Contenido base del email',
      to: 'destino@example.com'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'to' });
  });

  test('rechaza destinatarios', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo',
      text: 'Contenido base del email',
      destinatarios: ['a@example.com']
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'destinatarios' });
  });

  test('rechaza scheduled_at', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo',
      text: 'Contenido base del email',
      scheduled_at: '2026-03-22T15:00:00Z'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'scheduled_at' });
  });

  test('rechaza campo desconocido', async () => {
    const response = await makeRequest(server, {
      nombre: 'Campana Email Marzo',
      subject: 'Novedades de marzo',
      text: 'Contenido base del email',
      html: '<p>HTML</p>'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual({ field: 'html' });
  });
});