/**
 * Servicio de gestión de estados de envíos WhatsApp
 * Implementa máquina de estados con transacciones y auditoría
 */

const transicionesPermitidas = {
  pendiente: ['enviado', 'error'],
  enviado: [],
  error: ['pendiente']
};

function validarTransicion(estadoAnterior, estadoNuevo) {
  if (!estadoAnterior) return true;
  
  const permitidos = transicionesPermitidas[estadoAnterior];
  if (!permitidos) {
    throw new Error(`Estado anterior inválido: ${estadoAnterior}`);
  }
  
  if (!permitidos.includes(estadoNuevo)) {
    throw new Error(
      `Transición no permitida: ${estadoAnterior} → ${estadoNuevo}`
    );
  }
  
  return true;
}

/**
 * Cambia el estado de un envío de forma controlada
 * 
 * @param {Object} context - Contexto con conexión de BD
 * @param {Object} context.connection - Conexión MySQL
 * @param {number} envioId - ID del registro en ll_envios_whatsapp
 * @param {string} nuevoEstado - 'pendiente' | 'enviado' | 'error'
 * @param {string} origen - 'scheduler' | 'manual' | 'sistema'
 * @param {string} detalle - Descripción del cambio
 * @param {Object} options - Opciones adicionales
 * @param {number|null} options.usuarioId - ID del usuario (para origen='manual')
 * @param {string|null} options.messageId - ID del mensaje en WhatsApp
 * @returns {Promise<boolean>}
 * @throws {Error} Si la transición no está permitida
 */
async function cambiarEstado(
  { connection },
  envioId,
  nuevoEstado,
  origen,
  detalle,
  { usuarioId = null, messageId = null } = {}
) {
  const estadosValidos = ['pendiente', 'enviado', 'error'];
  const origenesValidos = ['scheduler', 'manual', 'sistema'];

  if (!estadosValidos.includes(nuevoEstado)) {
    throw new Error(`Estado inválido: ${nuevoEstado}`);
  }

  if (!origenesValidos.includes(origen)) {
    throw new Error(`Origen inválido: ${origen}`);
  }

  const conn = connection;

  try {
    await conn.beginTransaction();

    const [envios] = await conn.query(
      'SELECT estado FROM ll_envios_whatsapp WHERE id = ? FOR UPDATE',
      [envioId]
    );

    if (!envios.length) {
      throw new Error(`Envío ${envioId} no encontrado`);
    }

    const estadoAnterior = envios[0].estado;

    validarTransicion(estadoAnterior, nuevoEstado);

    await conn.query(
      `INSERT INTO ll_envios_whatsapp_historial 
       (envio_id, estado_anterior, estado_nuevo, origen, detalle, usuario_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [envioId, estadoAnterior, nuevoEstado, origen, detalle, usuarioId]
    );

    if (nuevoEstado === 'enviado') {
      await conn.query(
        'UPDATE ll_envios_whatsapp SET estado = ?, fecha_envio = NOW(), message_id = ? WHERE id = ?',
        [nuevoEstado, messageId, envioId]
      );
    } else {
      await conn.query(
        'UPDATE ll_envios_whatsapp SET estado = ? WHERE id = ?',
        [nuevoEstado, envioId]
      );
    }

    await conn.commit();

    console.log(
      `[EstadoService] Envío ${envioId}: ${estadoAnterior} → ${nuevoEstado} (${origen})`
    );

    return true;
  } catch (error) {
    await conn.rollback();
    console.error(
      `[EstadoService] Error cambiando estado envío ${envioId}:`,
      error.message
    );
    throw error;
  }
}

module.exports = {
  cambiarEstado,
  validarTransicion
};
