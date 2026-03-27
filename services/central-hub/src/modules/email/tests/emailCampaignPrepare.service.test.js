jest.mock('../../../config/db', () => ({
  execute: jest.fn()
}));

jest.mock('../services/emailCampaigns.service', () => ({
  getActiveClientEmailConfig: jest.fn(),
  getOwnedCampaignById: jest.fn(),
  updateCampaignSenderFields: jest.fn()
}));

jest.mock('../services/emailCampaignStats.service', () => ({
  syncCampaignStats: jest.fn()
}));

const db = require('../../../config/db');
const emailCampaignsService = require('../services/emailCampaigns.service');
const emailCampaignStatsService = require('../services/emailCampaignStats.service');
const emailCampaignPrepareService = require('../services/emailCampaignPrepare.service');

describe('emailCampaignPrepare.service.prepareCampaign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deja un solo envío listo para scheduler y campaña pendiente', async () => {
    emailCampaignsService.getOwnedCampaignById.mockResolvedValue({
      id: 21,
      nombre: 'Campaña Marzo',
      estado: 'borrador',
      asunto: 'Promo',
      body: '<p>Contenido</p>',
      email_from: 'marketing@test.com',
      fecha_programada: null
    });

    emailCampaignsService.getActiveClientEmailConfig.mockResolvedValue(null);

    db.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'PENDING' }, { id: 2, status: 'PENDING' }]])
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    emailCampaignStatsService.syncCampaignStats.mockResolvedValue({
      total_destinatarios: 2,
      total_enviados: 0,
      total_fallidos: 0,
      total_pendientes: 2,
      total_cancelados: 0
    });

    const result = await emailCampaignPrepareService.prepareCampaign({
      cliente_id: 55,
      campaign_id: 21,
      request: {
        fecha_programada: '2026-03-23T10:30:00Z'
      }
    });

    expect(result.campaign.estado).toBe('pendiente');
    expect(result.campaign.next_envio_id).toBe(1);
    expect(result.campaign.scheduling_strategy).toBe('first_recipient_only_then_scheduler_chain');
    expect(emailCampaignStatsService.syncCampaignStats).toHaveBeenCalledWith({ campaign_id: 21 });
  });

  test('resuelve email_from desde config activa del cliente cuando la campaña no lo tiene', async () => {
    emailCampaignsService.getOwnedCampaignById.mockResolvedValue({
      id: 22,
      nombre: 'Campaña sin remitente',
      estado: 'borrador',
      asunto: 'Promo',
      body: '<p>Contenido</p>',
      email_from: null,
      fecha_programada: null
    });

    emailCampaignsService.getActiveClientEmailConfig.mockResolvedValue({
      id: 99,
      from_email: 'smtp@test.com',
      from_name: 'Marketing',
      reply_to_email: 'reply@test.com'
    });

    emailCampaignsService.updateCampaignSenderFields.mockResolvedValue({
      email_from: 'smtp@test.com',
      name_from: 'Marketing',
      reply_to_email: 'reply@test.com'
    });

    db.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'PENDING' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    emailCampaignStatsService.syncCampaignStats.mockResolvedValue({
      total_destinatarios: 1,
      total_enviados: 0,
      total_fallidos: 0,
      total_pendientes: 1,
      total_cancelados: 0
    });

    const result = await emailCampaignPrepareService.prepareCampaign({
      cliente_id: 55,
      campaign_id: 22,
      request: {
        fecha_programada: '2026-03-23T10:30:00Z'
      }
    });

    expect(result.campaign.estado).toBe('pendiente');
    expect(emailCampaignsService.getActiveClientEmailConfig).toHaveBeenCalledWith({ cliente_id: 55 });
    expect(emailCampaignsService.updateCampaignSenderFields).toHaveBeenCalledWith({
      cliente_id: 55,
      campaign_id: 22,
      email_from: 'smtp@test.com',
      name_from: 'Marketing',
      reply_to_email: 'reply@test.com'
    });
  });

  test('falla con error claro si la campaña no tiene email_from y no existe config activa del cliente', async () => {
    emailCampaignsService.getOwnedCampaignById.mockResolvedValue({
      id: 23,
      nombre: 'Campaña sin remitente',
      estado: 'borrador',
      asunto: 'Promo',
      body: '<p>Contenido</p>',
      email_from: null,
      fecha_programada: null
    });

    emailCampaignsService.getActiveClientEmailConfig.mockResolvedValue(null);

    await expect(emailCampaignPrepareService.prepareCampaign({
      cliente_id: 55,
      campaign_id: 23,
      request: {
        fecha_programada: '2026-03-23T10:30:00Z'
      }
    })).rejects.toMatchObject({
      status: 404,
      code: 'CLIENT_EMAIL_CONFIG_NOT_FOUND'
    });
  });
});
