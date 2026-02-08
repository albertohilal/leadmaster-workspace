const db = require('../../../config/db');

const destinatariosController = {
  // Obtener destinatarios de una campaña específica
  async getDestinatariosCampania(req, res) {
    try {
      const { campaniaId } = req.params;
      const clienteId = req.user.cliente_id;

      // Verificar que la campaña pertenece al cliente
      const [campaniaCheck] = await db.execute(
        'SELECT id FROM ll_campanias_whatsapp WHERE id = ? AND cliente_id = ?',
        [campaniaId, clienteId]
      );

      if (campaniaCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campaña no encontrada o no tienes permisos para verla'
        });
      }

      // Obtener los destinatarios con información detallada
      const [destinatarios] = await db.execute(`
        SELECT 
          env.id,
          env.telefono_wapp as telefono,
          env.nombre_destino as nombre,
          env.estado,
          env.fecha_envio,
          env.mensaje_final,
          lug.nombre as lugar_nombre,
          lug.direccion as lugar_direccion
        FROM ll_envios_whatsapp env
        LEFT JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
        LEFT JOIN ll_lugares_clientes lug ON env.lugar_id = lug.id
        WHERE camp.id = ? AND camp.cliente_id = ?
        ORDER BY env.fecha_envio DESC
      `, [campaniaId, clienteId]);

      // Calcular estadísticas
      const estadisticas = {
        total: destinatarios.length,
        enviados: destinatarios.filter(d => d.estado === 'sent_manual').length,
        pendientes: destinatarios.filter(d => d.estado === 'pendiente').length,
        fallidos: destinatarios.filter(d => d.estado === 'fallido').length
      };

      res.json({
        success: true,
        data: {
          destinatarios,
          estadisticas
        }
      });
    } catch (error) {
      console.error('Error al obtener destinatarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener resumen de destinatarios (solo contadores)
  async getResumenDestinatarios(req, res) {
    try {
      const { campaniaId } = req.params;
      const clienteId = req.user.cliente_id;

      const [resumen] = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN env.estado = 'sent_manual' THEN 1 ELSE 0 END) as enviados,
          SUM(CASE WHEN env.estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
          SUM(CASE WHEN env.estado = 'fallido' THEN 1 ELSE 0 END) as fallidos
        FROM ll_envios_whatsapp env
        LEFT JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
        WHERE camp.id = ? AND camp.cliente_id = ?
      `, [campaniaId, clienteId]);

      res.json({
        success: true,
        data: resumen[0] || { total: 0, enviados: 0, pendientes: 0, fallidos: 0 }
      });
    } catch (error) {
      console.error('Error al obtener resumen de destinatarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Agregar destinatarios a una campaña
  async agregarDestinatarios(req, res) {
    try {
      const { campaniaId } = req.params;
      const { destinatarios } = req.body; // Array de objetos {telefono, nombre}
      const clienteId = req.user.cliente_id;

      // Verificar que la campaña existe y pertenece al cliente
      const [campaniaCheck] = await db.execute(
        'SELECT id, nombre FROM ll_campanias_whatsapp WHERE id = ? AND cliente_id = ?',
        [campaniaId, clienteId]
      );

      if (campaniaCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campaña no encontrada o no tienes permisos'
        });
      }

      if (!destinatarios || !Array.isArray(destinatarios) || destinatarios.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de destinatarios'
        });
      }

      // Validar formato de destinatarios
      for (let dest of destinatarios) {
        if (!dest.telefono || !dest.nombre) {
          return res.status(400).json({
            success: false,
            message: 'Cada destinatario debe tener teléfono y nombre'
          });
        }
      }

      const agregados = [];
      const duplicados = [];

      // Procesar cada destinatario
      for (let dest of destinatarios) {
        // Verificar si ya existe
        const [existente] = await db.execute(
          'SELECT id FROM ll_envios_whatsapp WHERE campania_id = ? AND telefono_wapp = ?',
          [campaniaId, dest.telefono]
        );

        if (existente.length > 0) {
          duplicados.push({
            telefono: dest.telefono,
            nombre: dest.nombre
          });
        } else {
          // Agregar nuevo destinatario
          await db.execute(`
            INSERT INTO ll_envios_whatsapp 
            (campania_id, telefono_wapp, nombre_destino, estado, fecha_creacion, cliente_id)
            VALUES (?, ?, ?, 'pendiente', NOW(), ?)
          `, [campaniaId, dest.telefono, dest.nombre, clienteId]);

          agregados.push({
            telefono: dest.telefono,
            nombre: dest.nombre
          });
        }
      }

      res.json({
        success: true,
        message: `Se procesaron ${destinatarios.length} destinatarios`,
        data: {
          agregados: agregados.length,
          duplicados: duplicados.length,
          detalles: {
            agregados,
            duplicados
          }
        }
      });

    } catch (error) {
      console.error('Error al agregar destinatarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Quitar destinatarios de una campaña
  async quitarDestinatarios(req, res) {
    try {
      const { campaniaId } = req.params;
      const { telefonos } = req.body; // Array de teléfonos a quitar
      const clienteId = req.user.cliente_id;

      // Verificar que la campaña existe y pertenece al cliente
      const [campaniaCheck] = await db.execute(
        'SELECT id FROM ll_campanias_whatsapp WHERE id = ? AND cliente_id = ?',
        [campaniaId, clienteId]
      );

      if (campaniaCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campaña no encontrada o no tienes permisos'
        });
      }

      if (!telefonos || !Array.isArray(telefonos) || telefonos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de teléfonos'
        });
      }

      const eliminados = [];
      const noEncontrados = [];

      // Procesar cada teléfono
      for (let telefono of telefonos) {
        // Verificar si existe y obtener datos antes de eliminar
        const [existente] = await db.execute(
          'SELECT id, nombre_destino, estado FROM ll_envios_whatsapp WHERE campania_id = ? AND telefono_wapp = ?',
          [campaniaId, telefono]
        );

        if (existente.length > 0) {
          // Solo permitir eliminar si no fue enviado
          if (existente[0].estado === 'pendiente' || existente[0].estado === 'fallido') {
            await db.execute(
              'DELETE FROM ll_envios_whatsapp WHERE campania_id = ? AND telefono_wapp = ?',
              [campaniaId, telefono]
            );

            eliminados.push({
              telefono,
              nombre: existente[0].nombre_destino
            });
          } else {
            noEncontrados.push({
              telefono,
              razon: `No se puede eliminar, estado: ${existente[0].estado}`
            });
          }
        } else {
          noEncontrados.push({
            telefono,
            razon: 'No encontrado en la campaña'
          });
        }
      }

      res.json({
        success: true,
        message: `Se procesaron ${telefonos.length} teléfonos`,
        data: {
          eliminados: eliminados.length,
          noEliminados: noEncontrados.length,
          detalles: {
            eliminados,
            noEliminados: noEncontrados
          }
        }
      });

    } catch (error) {
      console.error('Error al quitar destinatarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Marcar destinatario como enviado manualmente
  async marcarEnviadoManual(req, res) {
    try {
      const { destinatarioId } = req.params;
      const clienteId = req.user.cliente_id;

      // Verificar que el destinatario pertenece a una campaña del cliente
      const [check] = await db.execute(`
        SELECT env.id, env.estado, camp.cliente_id
        FROM ll_envios_whatsapp env
        LEFT JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
        WHERE env.id = ? AND camp.cliente_id = ?
      `, [destinatarioId, clienteId]);

      if (check.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Destinatario no encontrado o sin permisos'
        });
      }

      // Solo permitir si está pendiente
      if (check[0].estado !== 'pendiente') {
        return res.status(400).json({
          success: false,
          message: `No se puede marcar como enviado. Estado actual: ${check[0].estado}`
        });
      }

      // Actualizar estado
      await db.execute(`
        UPDATE ll_envios_whatsapp 
        SET estado = 'sent_manual', fecha_envio = NOW()
        WHERE id = ?
      `, [destinatarioId]);

      res.json({
        success: true,
        message: 'Destinatario marcado como enviado manualmente'
      });

    } catch (error) {
      console.error('Error al marcar como enviado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
};

module.exports = destinatariosController;