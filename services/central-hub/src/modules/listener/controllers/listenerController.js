// POST /listener/test-message
exports.testMessage = async (req, res) => {
  let { cliente_id, telefono, texto, esHumano } = req.body;
  if (!cliente_id || !telefono || !texto) {
    return res.status(400).json({ error: 'Faltan datos requeridos: cliente_id, telefono, texto' });
  }
  cliente_id = Number(cliente_id);
  try {
    const result = await listenerService.onMessageReceived({ cliente_id, telefono, texto, esHumano });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /listener/human-intervention - Registrar intervención humana manual
exports.registerHumanIntervention = async (req, res) => {
  const { telefono, mensaje, cliente_id } = req.body;
  if (!telefono) {
    return res.status(400).json({ error: 'Teléfono requerido' });
  }
  try {
    // Simular mensaje humano
    const result = await listenerService.onMessageReceived({ 
      cliente_id: cliente_id || 1,
      telefono, 
      texto: mensaje || 'Intervención humana registrada manualmente',
      esHumano: true,
      origenMensaje: 'humano'
    });
    
    res.json({
      success: true,
      ...result,
      mensaje: 'Intervención humana registrada correctamente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /listener/ia/reactivate - Reactivar IA después de intervención humana
exports.reactivateIA = async (req, res) => {
  const { telefono, motivo } = req.body;
  if (!telefono) {
    return res.status(400).json({ error: 'Teléfono requerido' });
  }
  try {
    const result = await listenerService.reactivarIA(telefono, motivo || 'reactivacion_manual');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /listener/history/:telefono - Obtener historial de intervenciones
exports.getInterventionHistory = async (req, res) => {
  const { telefono } = req.params;
  try {
    const historial = await listenerService.obtenerHistorialIntervenciones(telefono);
    res.json({ 
      success: true, 
      telefono,
      ...historial 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// Habilitar IA para un lead
exports.enableIA = async (req, res) => {
  const { telefono } = req.body;
  const result = await listenerService.setIAControl(telefono, true);
  res.json(result);
};

// Deshabilitar IA para un lead
exports.disableIA = async (req, res) => {
  const { telefono } = req.body;
  const result = await listenerService.setIAControl(telefono, false);
  res.json(result);
};
// ListenerController: gestiona eventos de mensajes entrantes y respuestas automáticas
const listenerService = require('../services/listenerService');

// GET /listener/status
exports.getStatus = (req, res) => {
  const status = listenerService.getStatus();
  res.json(status);
};

// POST /listener/mode
exports.setMode = (req, res) => {
  const { mode } = req.body;
  const result = listenerService.setMode(mode);
  res.json(result);
};

// GET /listener/logs
exports.getLogs = (req, res) => {
  const logs = listenerService.getLogs();
  res.json(logs);
};

// POST /listener/reactivate-ia - Reactivar IA para un teléfono
exports.reactivateIA = async (req, res) => {
  const { telefono, cliente_id } = req.body;
  if (!telefono) {
    return res.status(400).json({ error: 'Teléfono requerido' });
  }
  try {
    const db = require('../../../config/db');
    
    // Verificar que hay una conversación pausada
    const [conversaciones] = await db.execute(
      `SELECT * FROM ll_ia_conversaciones 
       WHERE telefono = ? AND cliente_id = ? AND pauso_ia = 1
       ORDER BY fecha_hora DESC LIMIT 1`,
      [telefono, cliente_id || 1]
    );
    
    if (conversaciones.length === 0) {
      return res.status(404).json({ 
        error: 'No hay conversación pausada para este teléfono' 
      });
    }
    
    // Actualizar conversación para reactivar IA
    await db.execute(
      `UPDATE ll_ia_conversaciones 
       SET pauso_ia = 0, fecha_reactivacion = NOW()
       WHERE telefono = ? AND cliente_id = ? AND pauso_ia = 1`,
      [telefono, cliente_id || 1]
    );
    
    // Actualizar control IA
    await db.execute(
      `UPDATE ll_ia_control 
       SET ia_activa = 1, contador_reactivaciones = contador_reactivaciones + 1,
           fecha_ultima_reactivacion = NOW()
       WHERE telefono = ? AND cliente_id = ?`,
      [telefono, cliente_id || 1]
    );
    
    // Registrar reactivación
    await db.execute(
      `INSERT INTO ll_reactivaciones_ia 
       (telefono, cliente_id, fecha_reactivacion, motivo)
       VALUES (?, ?, NOW(), 'Reactivación manual')`,
      [telefono, cliente_id || 1]
    );
    
    console.log(`✅ IA reactivada para ${telefono}`);
    
    res.json({
      success: true,
      mensaje: 'IA reactivada exitosamente',
      telefono,
      estado: 'ia_activa'
    });
  } catch (err) {
    console.error('Error reactivando IA:', err);
    res.status(500).json({ error: err.message });
  }
};
