
const db = require('../../../config/db');

function withFrontendCompatibility(campania, overrides = {}) {
  return {
    ...campania,
    descripcion: overrides.descripcion ?? '',
    programada: overrides.programada ?? false,
    fecha_envio: overrides.fecha_envio ?? null
  };
}

/**
 * Controlador de Campañas WhatsApp
 * Maneja CRUD completo de campañas con segmentación multi-cliente
 * y validaciones de seguridad para edición
 */

/**
 * Listar campañas del cliente autenticado (o todas si es admin)
 * GET /sender/campaigns
 */
exports.list = async (req, res) => {
  try {
    console.log('🔍 [campaigns] Starting list request for client:', req.user.cliente_id);
    const clienteId = req.user.cliente_id;
    const esAdmin = req.user.tipo === 'admin';
    
    // Si es admin, ver todas las campañas, sino solo las de su cliente
    const query = esAdmin ? `
      SELECT 
        id, nombre, mensaje, fecha_creacion, estado, cliente_id
      FROM ll_campanias_whatsapp 
      ORDER BY fecha_creacion DESC
    ` : `
      SELECT 
        id, nombre, mensaje, fecha_creacion, estado, cliente_id
      FROM ll_campanias_whatsapp 
      WHERE cliente_id = ?
      ORDER BY fecha_creacion DESC
    `;
    
    console.log('🔍 [campaigns] Executing query...');
    const [rows] = esAdmin ? 
      await db.execute(query) : 
      await db.execute(query, [clienteId]);
    console.log('🔍 [campaigns] Query result count:', rows.length);
    
    // Agregar campos compatibles con el frontend
    const campanias = rows.map((campania) => withFrontendCompatibility(campania));
    
    console.log('✅ [campaigns] Sending response...');
    res.json(campanias);
  } catch (error) {
    console.error('❌ [campaigns] Error al listar campañas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener detalle de una campaña específica
 * GET /sender/campaigns/:id
 */
exports.detail = async (req, res) => {
  try {
    const { id } = req.params;
    const clienteId = req.user.cliente_id;
    const esAdmin = req.user.tipo === 'admin';
    
    const query = esAdmin ? `
      SELECT 
        id, nombre, mensaje, fecha_creacion, estado, cliente_id
      FROM ll_campanias_whatsapp 
      WHERE id = ?
    ` : `
      SELECT 
        id, nombre, mensaje, fecha_creacion, estado, cliente_id
      FROM ll_campanias_whatsapp 
      WHERE id = ? AND cliente_id = ?
    `;
    
    const [rows] = esAdmin
      ? await db.execute(query, [id])
      : await db.execute(query, [id, clienteId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campaña no encontrada' 
      });
    }
    
    // Agregar campos para compatibilidad con frontend
    const campania = withFrontendCompatibility(rows[0]);
    
    res.json(campania);
  } catch (error) {
    console.error('Error al obtener detalle de campaña:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
};

/**
 * Actualizar campaña existente
 * PUT /sender/campaigns/:id
 * 
 * VALIDACIONES DE SEGURIDAD:
 * - Solo permite editar campañas del mismo cliente
 * - No permite editar campañas que ya han enviado mensajes
 * - Estados editables legacy: 'pendiente', 'pendiente_aprobacion', 'programada'
 * - Cambia estado a 'pendiente' tras edición para requerir nueva aprobación
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion = '',
      mensaje,
      programada = false,
      fecha_envio = null
    } = req.body;
    const clienteId = req.user.cliente_id;
    const esAdmin = req.user.tipo === 'admin';
    
    // Validaciones de entrada
    if (!nombre || nombre.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'El nombre de la campaña es requerido' 
      });
    }
    
    if (!mensaje || mensaje.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'El mensaje de la campaña es requerido' 
      });
    }
    
    // 1. Verificar que la campaña existe y pertenece al cliente
    const campaignQuery = `
      SELECT 
        c.id, c.nombre, c.estado, c.cliente_id,
        COALESCE(env.enviados, 0) as enviados
      FROM ll_campanias_whatsapp c
      LEFT JOIN (
        SELECT campania_id, COUNT(*) as enviados 
        FROM ll_envios_whatsapp 
        WHERE estado = 'enviado'
        GROUP BY campania_id
      ) env ON c.id = env.campania_id
      WHERE c.id = ? ${esAdmin ? '' : 'AND c.cliente_id = ?'}
    `;
    
    const campaignParams = esAdmin ? [id] : [id, clienteId];
    const [campaignRows] = await db.execute(campaignQuery, campaignParams);
    
    if (campaignRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campaña no encontrada' 
      });
    }
    
    const campaign = campaignRows[0];
    
    // 2. VALIDAR ESTADOS EDITABLES - CRÍTICO PARA INTEGRIDAD
    const estadosNoEditables = ['activa', 'completada', 'pausada', 'en_progreso'];
    if (estadosNoEditables.includes(campaign.estado) || campaign.enviados > 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'No se pueden editar campañas que ya han comenzado a enviarse',
        details: {
          estado_actual: campaign.estado,
          mensajes_enviados: campaign.enviados,
          razon: campaign.enviados > 0 
            ? 'La campaña ya tiene mensajes enviados' 
            : `Estado "${campaign.estado}" no permite edición`
        }
      });
    }
    
    // 3. Preparar datos para actualización
    const fechaEnvioFinal = programada && fecha_envio ? new Date(fecha_envio) : null;
    
    // Validar fecha de envío si es programada
    if (programada && (!fecha_envio || isNaN(new Date(fecha_envio)))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fecha y hora de envío requeridas para campañas programadas' 
      });
    }
    
    // 4. Actualizar campaña en base de datos
    const updateQuery = `
      UPDATE ll_campanias_whatsapp 
      SET 
        nombre = ?,
        mensaje = ?,
        estado = 'pendiente'
      WHERE id = ? ${esAdmin ? '' : 'AND cliente_id = ?'}
    `;
    
    const updateParams = [
      nombre.trim(),
      mensaje.trim(),
      id
    ];
    
    if (!esAdmin) updateParams.push(clienteId);
    
    const [result] = await db.execute(updateQuery, updateParams);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No se pudo actualizar la campaña' 
      });
    }
    
    // 5. Obtener la campaña actualizada
    const [updatedRows] = await db.execute(
      `SELECT id, nombre, mensaje, fecha_creacion, estado, cliente_id
       FROM ll_campanias_whatsapp
       WHERE id = ?`,
      [id]
    );
    
    // 6. Log de auditoría
    console.log(`[AUDIT] Campaña editada - ID: ${id}, Usuario: ${req.user.usuario}, Cliente: ${clienteId}`);
    
    res.json({
      success: true,
      message: 'Campaña actualizada exitosamente. Quedó pendiente de aprobación.',
      data: withFrontendCompatibility(updatedRows[0], {
        descripcion: descripcion?.trim() || '',
        programada: Boolean(programada),
        fecha_envio: fechaEnvioFinal
      }),
      warnings: [
        'La campaña requiere nueva aprobación del administrador',
        'No se puede enviar hasta que sea aprobada'
      ]
    });
    
  } catch (error) {
    console.error('Error al actualizar campaña:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

/**
 * Eliminar campaña (solo si no tiene envíos)
 * DELETE /sender/campaigns/:id
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const clienteId = req.user.cliente_id;
    const esAdmin = req.user.tipo === 'admin';
    
    // Verificar que no tenga envíos asociados
    const [enviosRows] = await db.execute(
      'SELECT COUNT(*) as total FROM ll_envios_whatsapp WHERE campania_id = ?', 
      [id]
    );
    
    if (enviosRows[0].total > 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'No se puede eliminar una campaña que ya tiene envíos asociados' 
      });
    }
    
    // Eliminar campaña
    const deleteQuery = `
      DELETE FROM ll_campanias_whatsapp 
      WHERE id = ? ${esAdmin ? '' : 'AND cliente_id = ?'}
    `;
    
    const deleteParams = esAdmin ? [id] : [id, clienteId];
    const [result] = await db.execute(deleteQuery, deleteParams);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campaña no encontrada' 
      });
    }
    
    console.log(`[AUDIT] Campaña eliminada - ID: ${id}, Usuario: ${req.user.usuario}`);
    
    res.json({ 
      success: true, 
      message: 'Campaña eliminada exitosamente' 
    });
    
  } catch (error) {
    console.error('Error al eliminar campaña:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

/**
 * Crear nueva campaña
 * POST /sender/campaigns
 */
exports.create = async (req, res) => {
  try {
    const { nombre, descripcion, mensaje, programada, fecha_envio } = req.body;
    const clienteId = req.user.cliente_id;
    
    // Validaciones
    if (!nombre || nombre.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'El nombre de la campaña es requerido' 
      });
    }
    
    if (!mensaje || mensaje.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'El mensaje de la campaña es requerido' 
      });
    }
    
    // Validar fecha si es programada
    const fechaEnvioFinal = programada && fecha_envio ? new Date(fecha_envio) : null;
    if (programada && (!fecha_envio || isNaN(fechaEnvioFinal))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fecha y hora de envío requeridas para campañas programadas' 
      });
    }
    
    // Crear campaña
    const insertQuery = `
      INSERT INTO ll_campanias_whatsapp 
      (nombre, mensaje, cliente_id, estado, fecha_creacion)
      VALUES (?, ?, ?, 'pendiente', NOW())
    `;
    
    const [result] = await db.execute(insertQuery, [
      nombre.trim(),
      mensaje.trim(),
      clienteId
    ]);
    
    console.log(`[AUDIT] Nueva campaña creada - ID: ${result.insertId}, Usuario: ${req.user.usuario}, Cliente: ${clienteId}`);
    
    res.status(201).json({
      success: true,
      message: 'Campaña creada exitosamente',
      data: withFrontendCompatibility({
        id: result.insertId,
        nombre: nombre.trim(),
        mensaje: mensaje.trim(),
        cliente_id: clienteId,
        estado: 'pendiente'
      }, {
        descripcion: descripcion?.trim() || '',
        programada: Boolean(programada),
        fecha_envio: fechaEnvioFinal
      })
    });
    
  } catch (error) {
    console.error('Error al crear campaña:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

/**
 * Aprobar campaña (solo admin)
 * POST /sender/campaigns/:id/approve
 */
exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const { comentario } = req.body;
    const esAdmin = req.user.tipo === 'admin';
    
    // Validar que sea admin
    if (!esAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Solo los administradores pueden aprobar campañas'
      });
    }
    
    // Verificar que la campaña existe
    const [campaniaRows] = await db.execute(
      'SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?',
      [id]
    );
    
    if (campaniaRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }
    
    const campania = campaniaRows[0];
    
    // Validar que esté en estado pendiente legacy
    if (!['pendiente', 'pendiente_aprobacion'].includes(campania.estado)) {
      return res.status(400).json({
        success: false,
        error: `No se puede aprobar. Estado actual: ${campania.estado}`,
        estadoActual: campania.estado
      });
    }
    
    // Actualizar estado a 'en_progreso' (aprobada lista para enviar)
    const [result] = await db.execute(
      'UPDATE ll_campanias_whatsapp SET estado = ? WHERE id = ?',
      ['en_progreso', id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        error: 'No se pudo actualizar la campaña'
      });
    }
    
    console.log(`[AUDIT] Campaña aprobada - ID: ${id}, Nombre: ${campania.nombre}, Admin: ${req.user.usuario}`);
    
    res.json({
      success: true,
      message: 'Campaña aprobada correctamente',
      data: {
        id: parseInt(id),
        nombre: campania.nombre,
        estadoAnterior: campania.estado,
        estadoNuevo: 'en_progreso',
        aprobadoPor: req.user.usuario,
        comentario: comentario || null
      }
    });
    
  } catch (error) {
    console.error('Error al aprobar campaña:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

