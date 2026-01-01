
// Controlador para status de envíos
exports.status = (req, res) => {
  res.json({ status: 'envios ok' });
};

// Controlador para listar envíos (mock)
exports.list = (req, res) => {
  res.json([
    { id: 1, campaña: 'Campaña Demo', destinatario: '+5491112345678', estado: 'enviado', fecha: '2025-12-13' },
    { id: 2, campaña: 'Campaña Navidad', destinatario: '+5491198765432', estado: 'pendiente', fecha: '2025-12-13' }
  ]);
};
