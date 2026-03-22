jest.mock('../../../config/db', () => ({
  execute: jest.fn()
}));

const db = require('../../../config/db');
const emailCampaignStatsService = require('../services/emailCampaignStats.service');

describe('emailCampaignStats.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('syncCampaignStats actualiza contadores desde ll_envios_email', async () => {
    db.execute
      .mockResolvedValueOnce([[{
        total_destinatarios: 5,
        total_enviados: 3,
        total_fallidos: 1,
        total_pendientes: 1,
        total_cancelados: 0
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await emailCampaignStatsService.syncCampaignStats({
      campaign_id: 99
    });

    expect(result).toEqual({
      total_destinatarios: 5,
      total_enviados: 3,
      total_fallidos: 1,
      total_pendientes: 1,
      total_cancelados: 0
    });
  });

  test('finalizeCampaignIfCompleted marca finalizado cuando no quedan pendientes', async () => {
    db.execute
      .mockResolvedValueOnce([[{
        total_destinatarios: 2,
        total_enviados: 2,
        total_fallidos: 0,
        total_pendientes: 0,
        total_cancelados: 0
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await emailCampaignStatsService.finalizeCampaignIfCompleted({
      campaign_id: 7
    });

    expect(result.finalized).toBe(true);
    expect(result.status).toBe('finalizado');
  });
});
