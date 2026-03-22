jest.mock('../services/emailCampaigns.service', () => ({
  createEmailCampaign: jest.fn().mockResolvedValue({
    id: 987,
    cliente_id: 25,
    nombre: 'Campana test',
    asunto: 'Asunto test',
    estado: 'borrador'
  })
}));

const emailCampaignsController = require('../controllers/emailCampaigns.controller');
const emailCampaignsService = require('../services/emailCampaigns.service');

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rechaza usuario autenticado sin cliente_id valido', async () => {
    const req = {
      user: { id: 1, tipo: 'admin' },
      body: {
        nombre: 'Campana test',
        asunto: 'Asunto test',
        body: '<h1>Texto test</h1>'
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
    expect(emailCampaignsService.createEmailCampaign).not.toHaveBeenCalled();
  });

  test('crea campana y responde 201 con shape reducido', async () => {
    const req = {
      user: { id: 1, tipo: 'admin', cliente_id: 25 },
      body: {
        nombre: 'Campana test',
        asunto: 'Asunto test',
        body: '<h1>Texto test</h1>',
        fecha_programada: null,
        email_from: 'marketing@dominio.com',
        name_from: 'Marketing',
        reply_to_email: 'respuesta@dominio.com',
        observaciones: 'Prueba inicial'
      }
    };
    const res = createRes();

    await emailCampaignsController.create(req, res);

    expect(emailCampaignsService.createEmailCampaign).toHaveBeenCalledWith({
      cliente_id: 25,
      request: {
        nombre: 'Campana test',
        asunto: 'Asunto test',
        body: '<h1>Texto test</h1>',
        fecha_programada: null,
        email_from: 'marketing@dominio.com',
        name_from: 'Marketing',
        reply_to_email: 'respuesta@dominio.com',
        observaciones: 'Prueba inicial'
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: 987,
        cliente_id: 25,
        nombre: 'Campana test',
        asunto: 'Asunto test',
        estado: 'borrador'
      }
    });
  });
});