const sessionService = require('../services/sessionService');

exports.listSessions = (req, res) => {
  const sessions = sessionService.getAllSessions();
  res.json(sessions);
};

exports.adminLogin = (req, res) => {
  const { cliente_id } = req.body;
  if (!cliente_id) {
    return res.status(400).json({ success: false, error: 'cliente_id requerido' });
  }
  try {
    sessionService.getOrCreateClient(Number(cliente_id));
    const state = sessionService.getSessionState(Number(cliente_id));
    res.json({ success: true, message: 'Inicializando conexión WhatsApp', state });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.adminLogout = async (req, res) => {
  const { cliente_id } = req.body;
  if (!cliente_id) {
    return res.status(400).json({ success: false, error: 'cliente_id requerido' });
  }
  try {
    await sessionService.disconnect(Number(cliente_id));
    const state = sessionService.getSessionState(Number(cliente_id));
    res.json({ success: true, message: 'WhatsApp desconectado', state });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
