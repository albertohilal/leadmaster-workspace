jest.mock('../../../config/db', () => ({
  execute: jest.fn()
}));

jest.mock('../services/emailCampaigns.service', () => ({
  getOwnedCampaignById: jest.fn()
}));

jest.mock('../services/emailCampaignStats.service', () => ({
  syncCampaignStats: jest.fn()
}));

const db = require('../../../config/db');
const emailCampaignsService = require('../services/emailCampaigns.service');
const emailCampaignStatsService = require('../services/emailCampaignStats.service');
const emailCampaignRecipientsService = require('../services/emailCampaignRecipients.service');

describe('emailCampaignRecipients.service.addRecipients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emailCampaignsService.getOwnedCampaignById.mockResolvedValue({
      id: 12,
      nombre: 'Campaña test',
      estado: 'borrador',
      asunto: 'Asunto test',
      body: '<p>Hola</p>',
      fecha_inicio_envio: null,
      total_enviados: 0
    });
    emailCampaignStatsService.syncCampaignStats.mockResolvedValue({
      total_destinatarios: 2,
      total_enviados: 0,
      total_fallidos: 0,
      total_pendientes: 2,
      total_cancelados: 0
    });
  });

  test('inserta y reactiva destinatarios fila por fila', async () => {
    db.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 501 }])
      .mockResolvedValueOnce([[{ id: 777, status: 'FAILED' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await emailCampaignRecipientsService.addRecipients({
      cliente_id: 44,
      campaign_id: 12,
      recipients: [
        { to_email: 'uno@test.com', nombre_destino: 'Uno', lugar_id: 10 },
        { to_email: 'dos@test.com', nombre_destino: 'Dos', lugar_id: null }
      ]
    });

    expect(result.summary.inserted).toBe(1);
    expect(result.summary.requeued).toBe(1);
    expect(result.summary.skipped_sent).toBe(0);
    expect(result.summary.already_pending).toBe(0);
    expect(emailCampaignStatsService.syncCampaignStats).toHaveBeenCalledWith({ campaign_id: 12 });
  });

  test('omite destinatario existente en SENT', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 601, status: 'SENT' }]]);

    const result = await emailCampaignRecipientsService.addRecipients({
      cliente_id: 44,
      campaign_id: 12,
      recipients: [
        { to_email: 'sent@test.com', nombre_destino: 'Sent', lugar_id: 10 }
      ]
    });

    expect(result.summary.skipped_sent).toBe(1);
    expect(result.summary.requeued).toBe(0);
    expect(result.summary.already_pending).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  test('mantiene destinatario existente en PENDING sin resetearlo', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 602, status: 'PENDING' }]]);

    const result = await emailCampaignRecipientsService.addRecipients({
      cliente_id: 44,
      campaign_id: 12,
      recipients: [
        { to_email: 'pending@test.com', nombre_destino: 'Pending', lugar_id: 10 }
      ]
    });

    expect(result.summary.already_pending).toBe(1);
    expect(result.summary.requeued).toBe(0);
    expect(result.summary.skipped_sent).toBe(0);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  test('reencola destinatarios existentes en FAILED y CANCELLED', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id: 603, status: 'FAILED' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 604, status: 'CANCELLED' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await emailCampaignRecipientsService.addRecipients({
      cliente_id: 44,
      campaign_id: 12,
      recipients: [
        { to_email: 'failed@test.com', nombre_destino: 'Failed', lugar_id: 10 },
        { to_email: 'cancelled@test.com', nombre_destino: 'Cancelled', lugar_id: 11 }
      ]
    });

    expect(result.summary.requeued).toBe(2);
    expect(result.summary.skipped_sent).toBe(0);
    expect(result.summary.already_pending).toBe(0);
  });
});
