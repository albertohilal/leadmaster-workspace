const express = require('express');
const http = require('http');

jest.mock('../../../config/db', () => ({
  execute: jest.fn()
}));

const db = require('../../../config/db');
const emailCampaignsRoutes = require('../routes/emailCampaigns.routes');

function makeRequest(server, path, body) {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path,
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

describe('POST /api/email/campaigns/:id/recipients', () => {
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
        estado: 'borrador',
        fecha_inicio_envio: null,
        total_enviados: 0
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 901 }])
      .mockResolvedValueOnce([[{
        total_destinatarios: 1,
        total_enviados: 0,
        total_fallidos: 0,
        total_pendientes: 1,
        total_cancelados: 0
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
  });

  test('persiste recipients en ll_envios_email sin romper el estado borrador', async () => {
    const response = await makeRequest(server, '/api/email/campaigns/321/recipients', {
      recipients: [
        {
          to_email: 'cliente@test.com',
          nombre_destino: 'Cliente Uno',
          lugar_id: 15
        }
      ]
    });

    expect(response.status).toBe(200);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ll_envios_email'),
      [
        77,
        321,
        'cliente@test.com',
        'Cliente Uno',
        15,
        'Promoción especial',
        '<h1>Hola</h1>',
        'smtp'
      ]
    );
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.inserted).toBe(1);
  });
});
