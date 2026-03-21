jest.mock('../services/emailCampaigns.service', () => ({
  createEmailCampaign: jest.fn().mockResolvedValue({
    mode: 'preparatory',
    persisted: false,
    channel: 'email',
    campaign: {
      nombre: 'Campana test',
      subject: 'Asunto test',
      text: 'Texto test'
    }
  })
}));

const emailCampaignsController = require('../controllers/emailCampaigns.controller');

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('emailCampaigns.controller.create', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('rechaza usuario autenticado sin cliente_id valido fuera de test', async () => {
    process.env.NODE_ENV = 'development';

    const req = {
      user: { id: 1, tipo: 'admin' },
      body: {
        nombre: 'Campana test',
        subject: 'Asunto test',
        text: 'Texto test'
      }
    };
    const res = createRes();

    await emailCampaignsController.create(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Usuario autenticado sin cliente_id valido'
    });
  });
});