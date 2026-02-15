const pool = require('../../../config/db');
const { cambiarEstado } = require('../services/estadoService');
const { renderizarMensaje, normalizarTelefono } = require('../services/mensajeService');

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
 * GET /api/envios/:id/manual/prepare
 * 
 * Obtiene los datos necesarios para el envío manual:
 * - Valida que el envío exista y esté en estado 'pendiente'
 * - Renderiza el mensaje de la campaña con variables personalizadas
 * - Normaliza el teléfono a formato E.164 (solo números)
 * - Retorna los datos para que el frontend abra WhatsApp Web
 * 
 * TAREA 6: Seguridad e idempotencia
 * - Valida pertenencia al cliente (multi-tenancy)
 * - Solo permite preparar envíos en estado 'pendiente'
 */
exports.prepareManual = async (req, res) => {
  try {
    const { id: envioId } = req.params;
    const clienteId = req.user?.cliente_id;

    // TAREA 6: Validación de autenticación estricta
    if (!clienteId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Validar que envioId sea un número válido
    if (!envioId || isNaN(parseInt(envioId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de envío inválido'
      });
    }

    // Obtener envío con datos de campaña (verificando pertenencia al cliente)
    const [envios] = await pool.execute(`
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
    `, [envioId, clienteId]);

    if (envios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado o no tienes permisos para acceder'
      });
    }

    const envio = envios[0];

    // Validar que el estado sea 'pendiente'
    if (envio.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: `No se puede preparar el envío. Estado actual: ${envio.estado}`,
        estado_actual: envio.estado
      });
    }

    // Normalizar teléfono a formato E.164 (solo números, sin +)
    const telefonoNormalizado = normalizarTelefono(envio.telefono_wapp);

    if (!telefonoNormalizado) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono inválido o vacío'
      });
    }

    // Renderizar mensaje reemplazando variables (usar servicio compartido)
    const mensajePersonalizado = renderizarMensaje(envio.mensaje_final, {
      nombre_destino: envio.nombre_destino
    });

    if (!mensajePersonalizado) {
      return res.status(400).json({
        success: false,
        message: 'Mensaje de campaña vacío'
      });
    }

    // Retornar datos preparados para el frontend
    res.json({
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
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * TAREA 3: Confirmar envío manual de WhatsApp
 * POST /api/envios/:id/manual/confirm
 * 
 * Marca el envío como 'enviado' después de que el operador 
 * confirma explícitamente que envió el mensaje:
 * - Valida que el envío exista y pertenezca al cliente
 * - Valida que el estado sea 'pendiente'
 * - Cambia estado a 'enviado' usando cambiarEstado()
 * - Registra en historial con origen='manual' y usuario_id
 * - Cumple con política de estados y auditoría completa
 * 
 * TAREA 6: Seguridad e idempotencia
 * - Validación estricta de permisos (multi-tenancy)
 * - Idempotencia: solo permite confirmar si estado='pendiente'
 * - La máquina de estados previene doble confirmación
 * - Usa transacciones para evitar condiciones de carrera
 */
exports.confirmManual = async (req, res) => {
  let connection = null;
  
  try {
    const { id: envioId } = req.params;
    const clienteId = req.user?.cliente_id;
    const usuarioId = req.user?.id; // ID del usuario para auditoría

    // TAREA 6: Validación de autenticación estricta
    if (!clienteId || !usuarioId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Validar que envioId sea un número válido
    if (!envioId || isNaN(parseInt(envioId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de envío inválido'
      });
    }

    // Obtener conexión para transacción
    connection = await pool.getConnection();

    // Verificar que el envío existe y pertenece al cliente
    const [envios] = await connection.execute(`
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
    `, [envioId, clienteId]);

    if (envios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado o no tienes permisos para acceder'
      });
    }

    const envio = envios[0];

    // TAREA 6: Validación de estado (idempotencia)
    if (envio.estado !== 'pendiente') {
      // Si ya está enviado, retornar éxito (idempotente)
      if (envio.estado === 'enviado') {
        return res.status(200).json({
          success: true,
          message: 'El envío ya fue confirmado previamente',
          data: {
            envio_id: envioId,
            estado_actual: 'enviado',
            es_idempotente: true
          }
        });
      }
      
      // Para otros estados (error), rechazar
      return res.status(400).json({
        success: false,
        message: `No se puede confirmar el envío. Estado actual: ${envio.estado}`,
        estado_actual: envio.estado
      });
    }

    // Cambiar estado usando el servicio oficial (con transacción y auditoría)
    await cambiarEstado(
      { connection },
      envioId,
      'enviado',
      'manual',
      `Envío manual confirmado por operador (campaña: ${envio.campania_nombre})`,
      { usuarioId }
    );

    // Liberar conexión
    connection.release();
    connection = null;

    console.log(`[ConfirmManual] Envío ${envioId} marcado como enviado por usuario ${usuarioId}`);

    res.json({
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
    // Liberar conexión si hay error
    if (connection) {
      connection.release();
    }

    console.error('Error en confirmManual:', error);
    
    // Mensaje específico si es error de transición de estado
    if (error.message && error.message.includes('Transición no permitida')) {
      return res.status(400).json({
        success: false,
        message: 'Transición de estado no permitida',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
