const express = require('express');
const http = require('http');

jest.mock('../services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({
    ok: true,
    integration: 'mailer',
    mailer: {
      status: 'SENT',
      message_id: 'mail-123'
    }
  })
}));

const emailService = require('../services/email.service');
const emailRoutes = require('../routes/email.routes');
const {
  MailerTimeoutError
} = require('../../../integrations/mailer');

function makeRequest(server, body) {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/email/send',
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

describe('POST /api/email/send', () => {
  let server;

  beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use('/api/email', (req, res, next) => {
      req.user = { id: 1, tipo: 'admin', cliente_id: 77 };
      next();
    });
    app.use('/api/email', emailRoutes);

    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    emailService.sendEmail.mockClear();
  });

  test('mantiene compatibilidad del endpoint send', async () => {
    const response = await makeRequest(server, {
      to: 'cliente@test.com',
      subject: 'Asunto test',
      html: '<p>Hola</p>',
      from_email: 'marketing@test.com',
      reply_to: 'reply@test.com'
    });

    expect(response.status).toBe(200);
    expect(emailService.sendEmail).toHaveBeenCalledWith({
      cliente_id: 77,
      request: {
        to: 'cliente@test.com',
        subject: 'Asunto test',
        text: undefined,
        html: '<p>Hola</p>',
        campaign_id: undefined,
        contact_id: undefined,
        from_email: 'marketing@test.com',
        from_name: undefined,
        reply_to: 'reply@test.com',
        metadata: undefined
      }
    });
    expect(response.body.success).toBe(true);
    expect(response.body.data.ok).toBe(true);
  });

  test('propaga error tipado del controller', async () => {
    emailService.sendEmail.mockRejectedValueOnce(new MailerTimeoutError('mailer timeout'));

    const response = await makeRequest(server, {
      to: 'cliente@test.com',
      subject: 'Asunto test',
      html: '<p>Hola</p>'
    });

    expect(response.status).toBe(504);
    expect(response.body).toEqual({
      success: false,
      error: 'MAILER_TIMEOUT',
      message: 'mailer timeout'
    });
  });

  test('acepta metadata campaign_id y envio_email_id sin romper el endpoint', async () => {
    const response = await makeRequest(server, {
      to: 'cliente@test.com',
      subject: 'Asunto test',
      html: '<p>Hola</p>',
      campaign_id: 12,
      envio_email_id: 901,
      metadata: {
        source: 'scheduler',
        extra: true
      }
    });

    expect(response.status).toBe(200);
    expect(emailService.sendEmail).toHaveBeenCalledWith({
      cliente_id: 77,
      request: expect.objectContaining({
        campaign_id: 12,
        envio_email_id: 901,
        metadata: {
          source: 'scheduler',
          extra: true
        }
      })
    });
  });
});
