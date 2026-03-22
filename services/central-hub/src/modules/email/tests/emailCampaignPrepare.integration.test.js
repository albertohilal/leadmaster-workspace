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
        path: '/api/email/campaigns/321/prepare',
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

describe('POST /api/email/campaigns/:id/prepare', () => {
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
    db.execute
      .mockResolvedValueOnce([[{
        id: 321,
        cliente_id: 77,
        nombre: 'Campaña Email Marzo',
        asunto: 'Promoción especial',
        body: '<h1>Hola</h1>',
        email_from: 'marketing@test.com',
        estado: 'borrador',
        fecha_programada: null
      }]])
      .mockResolvedValueOnce([[{ id: 901, status: 'PENDING' }, { id: 902, status: 'PENDING' }]])
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([[{ id: 901 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{
        total_destinatarios: 2,
        total_enviados: 0,
        total_fallidos: 0,
        total_pendientes: 2,
        total_cancelados: 0
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
  });

  test('deja campaña pendiente y agenda la primera fila', async () => {
    const response = await makeRequest(server, {
      fecha_programada: '2026-03-23T10:30:00Z'
    });

    expect(response.status).toBe(200);
    expect(
      db.execute.mock.calls.some(([sql, params]) => (
        sql.includes('SET scheduled_for = ?') &&
        Array.isArray(params) &&
        typeof params[0] === 'string' &&
        params[1] === 901
      ))
    ).toBe(true);
    expect(response.body.success).toBe(true);
    expect(response.body.data.campaign.estado).toBe('pendiente');
    expect(response.body.data.campaign.next_envio_id).toBe(901);
    expect(response.body.data.campaign.scheduling_strategy).toBe('first_recipient_only_then_scheduler_chain');
  });

  test('rechaza prepare si falta email_from en la campaña', async () => {
    db.execute.mockReset();
    db.execute.mockResolvedValueOnce([[{
      id: 321,
      cliente_id: 77,
      nombre: 'Campaña Email Marzo',
      asunto: 'Promoción especial',
      body: '<h1>Hola</h1>',
      email_from: null,
      estado: 'borrador',
      fecha_programada: null
    }]]);

    const response = await makeRequest(server, {
      fecha_programada: '2026-03-23T10:30:00Z'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('CAMPAIGN_EMAIL_FROM_REQUIRED');
  });
});
