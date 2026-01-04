// Controlador de mensajes
const whatsappService = require('../services/whatsappService');

exports.send = async (req, res) => {
  const { destinatario, mensaje } = req.body;
  if (!destinatario || !mensaje) {
    return res.status(400).json({ error: 'destinatario y mensaje son requeridos' });
  }

  try {
    const sessionState = whatsappService.getSessionState();
    if (!sessionState.ready) {
      return res.status(503).json({ 
        error: 'Sesión de WhatsApp no lista', 
        estado: sessionState.state,
        mensaje: sessionState.state === 'qr' ? 'Escanea el QR en /session-manager/qr' : 'Verifica /session-manager/state'
      });
    }

    const success = await whatsappService.sendMessage(destinatario, mensaje);
    if (success) {
      res.status(201).json({ 
        id: Math.floor(Math.random() * 10000), 
        destinatario, 
        mensaje, 
        estado: 'enviado', 
        fecha: new Date().toISOString() 
      });
    } else {
      res.status(500).json({ error: 'No se pudo enviar el mensaje' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al enviar mensaje', details: error.message });
  }
};

exports.sendBulk = async (req, res) => {
  const { campañaId, mensajes } = req.body;
  if (!campañaId || !Array.isArray(mensajes)) {
    return res.status(400).json({ error: 'campañaId y mensajes[] son requeridos' });
  }

  try {
    const sessionState = whatsappService.getSessionState();
    if (!sessionState.ready) {
      return res.status(503).json({ 
        campañaId,
        error: 'Sesión de WhatsApp no lista', 
        estado: sessionState.state 
      });
    }

    // Convertir el formato de mensajes
    const messages = mensajes.map(m => ({
      phoneNumber: m.destinatario || m.telefono || m.phoneNumber,
      message: m.mensaje || m.message || m.texto
    }));

    const result = await whatsappService.sendBulkMessages(messages);
    
    res.status(201).json({ 
      campañaId, 
      enviados: result.sent,
      fallidos: result.failed, 
      estado: 'completado',
      resultados: result.results
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en envío masivo', details: error.message });
  }
};

exports.status = (req, res) => {
  const { id } = req.params;
  res.json({ id, estado: 'enviado', fecha: '2025-12-13T00:00:00.000Z' });
};
