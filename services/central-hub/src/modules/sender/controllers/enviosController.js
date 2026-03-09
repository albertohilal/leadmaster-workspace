const pool = require('../../../config/db');
const { cambiarEstado } = require('../services/estadoService');
const { renderizarMensaje, normalizarTelefono } = require('../services/mensajeService');

// OPS-POST-ENVÍO-01 (ENUMs exactos)
const POST_ENVIO_ESTADOS = new Set([
  'CONTACTO_VALIDO_SIN_INTERES',
  'PARA_DERIVAR',
  'PENDIENTE_SIN_RESPUESTA',
  'NUMERO_INEXISTENTE',
  'NUMERO_CAMBIO_DUEÑO',
  'TERCERO_NO_RESPONSABLE',
  'ATENDIO_MENOR_DE_EDAD',
  'NO_ENTREGADO_ERROR_ENVIO'
]);

const POST_ENVIO_ACCIONES = new Set([
  'DERIVAR',
  'FOLLOWUP_1',
  'CERRAR',
  'INVALIDAR_TELEFONO',
  'REINTENTO_TECNICO',
  'NO_CONTACTAR'
]);

function parseId(raw) {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

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

/**
 * TAREA 2: Preparar envío manual de WhatsApp
 * GET /api/sender/envios/:id/manual/prepare
 *
 * - Valida envío y pertenencia al cliente (multi-tenancy)
 * - Solo permite estado 'pendiente'
 * - Normaliza teléfono
 * - Renderiza mensaje final (variables)
 */
exports.prepareManual = async (req, res) => {
  try {
    const envioId = parseId(req.params?.id);
    const clienteId = req.user?.cliente_id;

    if (!clienteId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!envioId) {
      return res.status(400).json({ success: false, message: 'ID de envío inválido' });
    }

    const [envios] = await pool.execute(
      `
      SELECT 
        env.id,
        env.campania_id,
        env.telefono_wapp,
        env.nombre_destino,
        env.mensaje_final,
        env.estado,
        camp.nombre as campania_nombre,
        camp.cliente_id
      FROM ll_envios_whatsapp env
      INNER JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
      WHERE env.id = ? AND camp.cliente_id = ?
      `,
      [envioId, clienteId]
    );

    if (envios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado o no tienes permisos para acceder'
      });
    }

    const envio = envios[0];

    if (envio.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: `No se puede preparar el envío. Estado actual: ${envio.estado}`,
        estado_actual: envio.estado
      });
    }

    const telefonoNormalizado = normalizarTelefono(envio.telefono_wapp);
    if (!telefonoNormalizado) {
      return res.status(400).json({ success: false, message: 'Teléfono inválido o vacío' });
    }

    const mensajePersonalizado = renderizarMensaje(envio.mensaje_final, {
      nombre_destino: envio.nombre_destino
    });

    if (!mensajePersonalizado || String(mensajePersonalizado).trim() === '') {
      return res.status(400).json({ success: false, message: 'Mensaje de campaña vacío' });
    }

    return res.json({
      success: true,
      data: {
        envio_id: envio.id,
        campania_id: envio.campania_id,
        campania_nombre: envio.campania_nombre,
        telefono: telefonoNormalizado,
        nombre_destino: envio.nombre_destino,
        mensaje_final: mensajePersonalizado
      }
    });
  } catch (error) {
    console.error('Error en prepareManual:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * TAREA 3: Confirmar envío manual de WhatsApp
 * POST /api/sender/envios/:id/manual/confirm
 *
 * - Multi-tenant
 * - Idempotente: si ya está 'enviado' retorna success
 * - Usa transacción para evitar condiciones de carrera
 */
exports.confirmManual = async (req, res) => {
  let connection = null;

  try {
    const envioId = parseId(req.params?.id);
    const clienteId = req.user?.cliente_id;
    const usuarioId = req.user?.id;

    if (!clienteId || usuarioId === undefined || usuarioId === null) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!envioId) {
      return res.status(400).json({ success: false, message: 'ID de envío inválido' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [envios] = await connection.execute(
      `
      SELECT 
        env.id,
        env.campania_id,
        env.estado,
        camp.cliente_id,
        camp.nombre as campania_nombre,
        env.telefono_wapp,
        env.nombre_destino
      FROM ll_envios_whatsapp env
      INNER JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
      WHERE env.id = ? AND camp.cliente_id = ?
      FOR UPDATE
      `,
      [envioId, clienteId]
    );

    if (envios.length === 0) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado o no tienes permisos para acceder'
      });
    }

    const envio = envios[0];

    if (envio.estado !== 'pendiente') {
      if (envio.estado === 'enviado') {
        await connection.commit();
        connection.release();
        connection = null;
        return res.status(200).json({
          success: true,
          message: 'El envío ya fue confirmado previamente',
          data: { envio_id: envioId, estado_actual: 'enviado', es_idempotente: true }
        });
      }

      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(400).json({
        success: false,
        message: `No se puede confirmar el envío. Estado actual: ${envio.estado}`,
        estado_actual: envio.estado
      });
    }

    const messageId = `MANUAL-${envioId}-${Date.now()}`;

    await connection.execute(
      `UPDATE ll_envios_whatsapp SET message_id = ? WHERE id = ?`,
      [messageId, envioId]
    );

    await cambiarEstado(
      { connection },
      envioId,
      'enviado',
      'manual',
      `Envío manual confirmado por operador (campaña: ${envio.campania_nombre})`,
      { usuarioId }
    );

    await connection.commit();
    connection.release();
    connection = null;

    console.log(`[ConfirmManual] Envío ${envioId} marcado como enviado por usuario ${usuarioId}`);

    return res.json({
      success: true,
      message: 'Envío confirmado correctamente',
      data: {
        envio_id: envioId,
        estado_nuevo: 'enviado',
        campania_id: envio.campania_id,
        telefono: envio.telefono_wapp,
        nombre_destino: envio.nombre_destino
      }
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
      connection.release();
    }

    console.error('Error en confirmManual:', error);

    if (error.message && error.message.includes('Transición no permitida')) {
      return res.status(400).json({
        success: false,
        message: 'Transición de estado no permitida',
        error: error.message
      });
    }

    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * TAREA 3b: Marcar error en envío manual de WhatsApp
 * POST /api/sender/envios/:id/manual/error
 *
 * - Multi-tenant
 * - Idempotente: si ya está 'error' retorna success
 * - Solo permite transición desde 'pendiente'
 * - NO crea registros en ll_post_envio_clasificaciones
 */
exports.markManualError = async (req, res) => {
  let connection = null;

  try {
    const envioId = parseId(req.params?.id);
    const clienteId = req.user?.cliente_id;
    const usuarioId = req.user?.id;

    if (!clienteId || usuarioId === undefined || usuarioId === null) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!envioId) {
      return res.status(400).json({ success: false, message: 'ID de envío inválido' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [envios] = await connection.execute(
      `
      SELECT 
        env.id,
        env.campania_id,
        env.estado,
        camp.cliente_id,
        camp.nombre as campania_nombre,
        env.telefono_wapp,
        env.nombre_destino
      FROM ll_envios_whatsapp env
      INNER JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
      WHERE env.id = ? AND camp.cliente_id = ?
      FOR UPDATE
      `,
      [envioId, clienteId]
    );

    if (envios.length === 0) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado o no tienes permisos para acceder'
      });
    }

    const envio = envios[0];

    if (envio.estado !== 'pendiente') {
      if (envio.estado === 'error') {
        await connection.commit();
        connection.release();
        connection = null;
        return res.status(200).json({
          success: true,
          message: 'El envío ya estaba marcado como error',
          data: { envio_id: envioId, estado_actual: 'error', es_idempotente: true }
        });
      }

      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(400).json({
        success: false,
        message: `No se puede marcar error. Estado actual: ${envio.estado}`,
        estado_actual: envio.estado
      });
    }

    await cambiarEstado(
      { connection },
      envioId,
      'error',
      'manual',
      `Envío manual marcado como error por operador (campaña: ${envio.campania_nombre})`,
      { usuarioId }
    );

    await connection.commit();
    connection.release();
    connection = null;

    console.log(`[MarkManualError] Envío ${envioId} marcado como error por usuario ${usuarioId}`);

    return res.json({
      success: true,
      message: 'Envío marcado como error',
      data: {
        envio_id: envioId,
        estado_nuevo: 'error',
        campania_id: envio.campania_id,
        telefono: envio.telefono_wapp,
        nombre_destino: envio.nombre_destino
      }
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
      connection.release();
    }

    console.error('Error en markManualError:', error);

    if (error.message && error.message.includes('Transición no permitida')) {
      return res.status(400).json({
        success: false,
        message: 'Transición de estado no permitida',
        error: error.message
      });
    }

    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Reintentar envío con error (Política v1.2.0)
 * POST /api/sender/envios/:id/reintentar
 *
 * error -> pendiente (solo manual, con auditoría)
 */
exports.reintentar = async (req, res) => {
  let connection = null;

  try {
    const envioId = parseId(req.params?.id);
    const { justificacion } = req.body || {};
    const clienteId = req.user?.cliente_id;
    const usuarioId = req.user?.id;

    if (!clienteId || usuarioId === undefined || usuarioId === null) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!envioId) {
      return res.status(400).json({ success: false, message: 'ID de envío inválido' });
    }

    if (!justificacion || typeof justificacion !== 'string' || justificacion.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Justificación requerida (mínimo 10 caracteres)'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [envios] = await connection.execute(
      `
      SELECT 
        env.id,
        env.campania_id,
        env.estado,
        env.detalle_error,
        camp.cliente_id,
        camp.nombre as campania_nombre,
        env.telefono_wapp,
        env.nombre_destino
      FROM ll_envios_whatsapp env
      INNER JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
      WHERE env.id = ? AND camp.cliente_id = ?
      FOR UPDATE
      `,
      [envioId, clienteId]
    );

    if (envios.length === 0) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado o no tienes permisos para acceder'
      });
    }

    const envio = envios[0];

    if (envio.estado !== 'error') {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(400).json({
        success: false,
        message: `Solo se pueden reintentar envíos en estado 'error'. Estado actual: ${envio.estado}`,
        estado_actual: envio.estado
      });
    }

    await cambiarEstado(
      { connection },
      envioId,
      'pendiente',
      'manual',
      justificacion.trim(),
      { usuarioId }
    );

    await connection.commit();
    connection.release();
    connection = null;

    console.log(
      `[Reintentar] Envío ${envioId} cambiado error→pendiente por usuario ${usuarioId}. ` +
      `Justificación: "${justificacion.trim()}"`
    );

    return res.json({
      success: true,
      message: 'Envío marcado para reintento',
      data: {
        envio_id: envioId,
        estado_nuevo: 'pendiente',
        campania_id: envio.campania_id,
        telefono: envio.telefono_wapp,
        nombre_destino: envio.nombre_destino,
        error_anterior: envio.detalle_error,
        justificacion: justificacion.trim()
      }
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
      connection.release();
    }

    console.error('Error en reintentar:', error);

    if (error.message && error.message.includes('Transición no permitida')) {
      return res.status(400).json({
        success: false,
        message: 'Transición de estado no permitida',
        error: error.message
      });
    }

    if (error.message && (
      error.message.includes('Justificación') ||
      error.message.includes('justificación') ||
      error.message.includes('genérica')
    )) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * OPS-POST-ENVÍO-01: Clasificar post-envío (depuradora)
 * POST /api/sender/envios/:id/post-envio-clasificar
 *
 * Body: { post_envio_estado, accion_siguiente, detalle? }
 *
 * Reglas:
 * - Multi-tenant: el envío debe pertenecer al cliente autenticado
 * - Historial: inserta un registro (no sobreescribe)
 * - Sensible: ATENDIO_MENOR_DE_EDAD => accion_siguiente debe ser NO_CONTACTAR
 *
 * Query:
 * - historial=true => retorna historial completo (desc)
 */
exports.clasificarPostEnvio = async (req, res) => {
  try {
    const envioId = parseId(req.params?.id);
    const clienteId = req.user?.cliente_id;
    const usuarioId = req.user?.id;
    const tipoUsuario = req.user?.tipo;

    if (!clienteId || usuarioId === undefined || usuarioId === null) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!envioId) {
      return res.status(400).json({ success: false, message: 'ID de envío inválido' });
    }

    const { post_envio_estado, accion_siguiente, detalle } = req.body || {};

    if (!post_envio_estado || typeof post_envio_estado !== 'string' || !POST_ENVIO_ESTADOS.has(post_envio_estado)) {
      return res.status(400).json({ success: false, message: 'post_envio_estado inválido' });
    }

    if (!accion_siguiente || typeof accion_siguiente !== 'string' || !POST_ENVIO_ACCIONES.has(accion_siguiente)) {
      return res.status(400).json({ success: false, message: 'accion_siguiente inválida' });
    }

    if (post_envio_estado === 'ATENDIO_MENOR_DE_EDAD' && accion_siguiente !== 'NO_CONTACTAR') {
      return res.status(400).json({
        success: false,
        message: 'Para ATENDIO_MENOR_DE_EDAD la accion_siguiente debe ser NO_CONTACTAR'
      });
    }

    let detalleFinal = null;
    if (typeof detalle === 'string' && detalle.trim().length > 0) {
      detalleFinal = detalle.trim().slice(0, 255);
    }

    // Validar pertenencia del envío al cliente (multi-tenant)
    const [envios] = await pool.execute(
      `
      SELECT env.id
      FROM ll_envios_whatsapp env
      INNER JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
      WHERE env.id = ? AND camp.cliente_id = ?
      `,
      [envioId, clienteId]
    );

    if (envios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado o no tienes permisos para acceder'
      });
    }

    const clasificadoPor =
      tipoUsuario && String(tipoUsuario).trim() !== ''
        ? `${String(tipoUsuario).trim()}:${usuarioId}`
        : String(usuarioId);

    const [insertResult] = await pool.execute(
      `
      INSERT INTO ll_post_envio_clasificaciones
        (envio_id, cliente_id, post_envio_estado, accion_siguiente, detalle, clasificado_por)
      VALUES
        (?, ?, ?, ?, ?, ?)
      `,
      [envioId, clienteId, post_envio_estado, accion_siguiente, detalleFinal, clasificadoPor]
    );

    const insertId = insertResult?.insertId;

    const [rows] = await pool.execute(
      `
      SELECT id, envio_id, cliente_id, post_envio_estado, accion_siguiente, detalle, clasificado_por, created_at
      FROM ll_post_envio_clasificaciones
      WHERE id = ?
      `,
      [insertId]
    );

    const data = rows?.[0] || null;

    const wantsHistorial = String(req.query?.historial || '').toLowerCase() === 'true';
    if (wantsHistorial) {
      const [historial] = await pool.execute(
        `
        SELECT id, envio_id, cliente_id, post_envio_estado, accion_siguiente, detalle, clasificado_por, created_at
        FROM ll_post_envio_clasificaciones
        WHERE envio_id = ? AND cliente_id = ?
        ORDER BY created_at DESC, id DESC
        `,
        [envioId, clienteId]
      );

      return res.status(201).json({ success: true, data, historial });
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Error en clasificarPostEnvio:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};