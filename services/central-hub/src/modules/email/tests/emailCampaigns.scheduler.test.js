jest.mock('../../../config/db', () => ({
  execute: jest.fn(),
  getConnection: jest.fn()
}));

jest.mock('../services/email.service', () => ({
  sendEmail: jest.fn()
}));

jest.mock('../services/emailCampaignStats.service', () => ({
  markCampaignInProgress: jest.fn().mockResolvedValue(undefined),
  syncCampaignStats: jest.fn().mockResolvedValue({
    total_destinatarios: 2,
    total_enviados: 1,
    total_fallidos: 0,
    total_pendientes: 1,
    total_cancelados: 0
  }),
  finalizeCampaignIfCompleted: jest.fn().mockResolvedValue({
    finalized: false,
    status: 'pending'
  })
}));

const db = require('../../../config/db');
const emailService = require('../services/email.service');
const emailCampaignStatsService = require('../services/emailCampaignStats.service');
const scheduler = require('../services/emailCampaigns.scheduler');
const {
  MailerTimeoutError,
  MailerHttpError
} = require('../../../integrations/mailer');

describe('emailCampaigns.scheduler.processCampaign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.execute.mockReset();
    db.getConnection.mockReset();
    emailService.sendEmail.mockReset();
  });

  test('envía una fila, libera lock y agenda la siguiente', async () => {
    db.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{
        id: 701,
        to_email: 'destino@test.com',
        subject: 'Asunto',
        body: '<p>Hola</p>'
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[ ]])
      .mockResolvedValueOnce([[{ id: 702 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    emailService.sendEmail.mockResolvedValue({
      ok: true,
      mailer: {
        message_id: 'm-1'
      }
    });

    const result = await scheduler.__test__.processCampaign({
      id: 88,
      cliente_id: 9,
      asunto: 'Asunto',
      body: '<p>Hola</p>',
      email_from: 'from@test.com',
      name_from: 'From',
      reply_to_email: 'reply@test.com'
    });

    expect(result.sent).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledWith({
      cliente_id: 9,
      request: expect.objectContaining({
        to: 'destino@test.com',
        envio_email_id: 701,
        campaign_id: 88
      })
    });
    expect(emailCampaignStatsService.markCampaignInProgress).toHaveBeenCalledWith({ campaign_id: 88 });
  });

  test('reprograma en error transitorio sin marcar FAILED', async () => {
    db.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{
        id: 702,
        to_email: 'retry@test.com',
        subject: 'Asunto',
        body: '<p>Hola</p>',
        attempt_count: 1
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 703 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    emailService.sendEmail.mockRejectedValue(new MailerTimeoutError('timeout'));

    const result = await scheduler.__test__.processCampaign({
      id: 89,
      cliente_id: 9,
      asunto: 'Asunto',
      body: '<p>Hola</p>',
      email_from: 'from@test.com'
    });

    expect(result.transient).toBe(true);
    expect(db.execute.mock.calls[2][0]).toContain("status = 'PENDING'");
    expect(db.execute.mock.calls[2][1][1]).toBeGreaterThan(0);
  });

  test('marca FAILED en error permanente', async () => {
    db.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{
        id: 704,
        to_email: 'fail@test.com',
        subject: 'Asunto',
        body: '<p>Hola</p>',
        attempt_count: 1
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 705 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    emailService.sendEmail.mockRejectedValue(new MailerHttpError({
      message: 'bad request',
      status: 400,
      body: { code: 'VALIDATION_ERROR' }
    }));

    const result = await scheduler.__test__.processCampaign({
      id: 90,
      cliente_id: 9,
      asunto: 'Asunto',
      body: '<p>Hola</p>',
      email_from: 'from@test.com'
    });

    expect(result.transient).toBe(false);
    expect(db.execute.mock.calls[2][0]).toContain("status = 'FAILED'");
  });

  test('marca FAILED cuando alcanza el límite de 3 intentos en error transitorio', async () => {
    db.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{
        id: 706,
        to_email: 'maxretry@test.com',
        subject: 'Asunto',
        body: '<p>Hola</p>',
        attempt_count: 3
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 707 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    emailService.sendEmail.mockRejectedValue(new MailerTimeoutError('timeout'));

    const result = await scheduler.__test__.processCampaign({
      id: 91,
      cliente_id: 9,
      asunto: 'Asunto',
      body: '<p>Hola</p>',
      email_from: 'from@test.com'
    });

    expect(result.transient).toBe(true);
    expect(result.attempts).toBe(3);
    expect(db.execute.mock.calls[2][0]).toContain("status = 'FAILED'");
    expect(String(db.execute.mock.calls[2][1][0])).toContain('MAX_RETRIES_EXCEEDED');
  });
});
