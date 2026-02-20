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
        enviados: destinatarios.filter(d => d.estado === 'enviado').length,
        pendientes: destinatarios.filter(d => d.estado === 'pendiente').length,
        errores: destinatarios.filter(d => d.estado === 'error').length
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
          SUM(CASE WHEN env.estado = 'enviado' THEN 1 ELSE 0 END) as enviados,
          SUM(CASE WHEN env.estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
          SUM(CASE WHEN env.estado = 'error' THEN 1 ELSE 0 END) as errores
        FROM ll_envios_whatsapp env
        LEFT JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
        WHERE camp.id = ? AND camp.cliente_id = ?
      `, [campaniaId, clienteId]);

      res.json({
        success: true,
        data: resumen[0] || { total: 0, enviados: 0, pendientes: 0, errores: 0 }
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
      // LOG 1: Request completo
      console.log('📥 POST /destinatarios/campania/:campaniaId/agregar');
      console.log('📋 req.params:', JSON.stringify(req.params));
      console.log('📋 req.body:', JSON.stringify(req.body));
      console.log('👤 req.user:', req.user ? { cliente_id: req.user.cliente_id, email: req.user.email } : 'NO USER');

      const { campaniaId } = req.params;
      const { destinatarios } = req.body;
      const clienteId = req.user?.cliente_id;

      // Validación de autenticación
      if (!clienteId) {
        console.log('❌ Error: Usuario no autenticado');
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // LOG 2: Valores extraídos
      console.log('🔍 Valores extraídos - campaniaId:', campaniaId, 'clienteId:', clienteId, 'destinatarios count:', destinatarios?.length);

      // Verificar que la campaña existe y pertenece al cliente
      const [campaniaCheck] = await db.execute(
        'SELECT id, nombre, mensaje FROM ll_campanias_whatsapp WHERE id = ? AND cliente_id = ?',
        [campaniaId, clienteId]
      );

      console.log('🔍 Campaña encontrada:', campaniaCheck.length > 0 ? campaniaCheck[0].nombre : 'NO ENCONTRADA');

      if (campaniaCheck.length === 0) {
        console.log('❌ Error 404: Campaña no encontrada o sin permisos');
        return res.status(404).json({
          success: false,
          message: 'Campaña no encontrada o no tienes permisos'
        });
      }

      const campania = campaniaCheck[0];
      const mensajeFinal = campania.mensaje ? campania.mensaje.trim() : null;
      
      console.log('📝 Mensaje de campaña:', mensajeFinal ? `"${mensajeFinal.substring(0, 50)}..."` : 'NULL');

      // Validar que el array existe
      if (!destinatarios || !Array.isArray(destinatarios)) {
        console.log('❌ Error 400: destinatarios no es un array válido');
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de destinatarios'
        });
      }

      if (destinatarios.length === 0) {
        console.log('⚠️  Warning: Array de destinatarios vacío');
        return res.status(400).json({
          success: false,
          message: 'El array de destinatarios está vacío'
        });
      }

      console.log('✅ Array destinatarios válido con', destinatarios.length, 'elementos');

      // Validar cada destinatario y normalizar el campo de teléfono
      const errores = [];
      destinatarios.forEach((dest, index) => {
        // ✅ Tolerante: aceptar telefono_wapp, telefono o phone
        const telefono = dest.telefono_wapp || dest.telefono || dest.phone;
        
        if (!telefono || typeof telefono !== 'string' || telefono.trim() === '') {
          errores.push(`Destinatario ${index + 1}: no tiene teléfono válido (telefono_wapp, telefono o phone)`);
        } else {
          // Normalizar: guardar en telefono_wapp si venía con otro nombre
          dest.telefono_wapp = telefono.trim();
        }
      });

      if (errores.length > 0) {
        console.log('❌ Error de validación:', errores);
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errores
        });
      }

      console.log('✅ Todos los destinatarios tienen telefono_wapp válido');

      const agregados = [];
      const duplicados = [];
      const erroresInsercion = [];

      // Procesar cada destinatario
      // REFACTORIZACIÓN 2026-02-20: Confiar en índice UNIQUE (campania_id, telefono_wapp)
      // No hacer SELECT previo, capturar ER_DUP_ENTRY en catch
      for (let i = 0; i < destinatarios.length; i++) {
        const dest = destinatarios[i];
        const telefonoLimpio = dest.telefono_wapp.trim();
        
        try {
          console.log(`🔄 Procesando ${i + 1}/${destinatarios.length}: ${telefonoLimpio}`);

          // Intentar INSERT directamente (confiar en índice UNIQUE)
          const [result] = await db.execute(`
            INSERT INTO ll_envios_whatsapp 
            (campania_id, telefono_wapp, nombre_destino, mensaje_final, estado, lugar_id)
            VALUES (?, ?, ?, ?, 'pendiente', ?)
          `, [
            campaniaId, 
            telefonoLimpio, 
            dest.nombre_destino || null, 
            mensajeFinal, 
            dest.lugar_id || null
          ]);

          console.log(`✅ Insertado ID ${result.insertId}: ${telefonoLimpio}`);

          agregados.push({
            id: result.insertId,
            telefono: telefonoLimpio,
            nombre: dest.nombre_destino || null
          });
        } catch (error) {
          // Detectar duplicado por índice UNIQUE
          if (error.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️  Duplicado: ${telefonoLimpio}`);
            duplicados.push({
              telefono: telefonoLimpio,
              nombre: dest.nombre_destino || null,
              razon: 'Ya existe en la campaña'
            });
          } else {
            console.error(`❌ Error al procesar ${telefonoLimpio}:`, error.message);
            erroresInsercion.push({
              telefono: telefonoLimpio,
              error: error.message
            });
          }
        }
      }

      console.log('✅ Proceso completado - Agregados:', agregados.length, 'Duplicados:', duplicados.length, 'Errores:', erroresInsercion.length);

      // Responder siempre 200 si se procesó el array completo
      res.status(200).json({
        success: true,
        message: `Se procesaron ${destinatarios.length} destinatarios`,
        data: {
          agregados: agregados.length,
          duplicados: duplicados.length,
          errores: erroresInsercion.length,
          detalles: {
            agregados,
            duplicados,
            errores: erroresInsercion
          }
        }
      });

    } catch (error) {
      console.error('❌ ERROR CRÍTICO en agregarDestinatarios:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message,
        tipo: error.name
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
          if (existente[0].estado === 'pendiente' || existente[0].estado === 'error') {
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

  // ❌ FUNCIÓN ELIMINADA - Violaba política de estados
  // - Usaba estado 'sent_manual' no válido
  // - Hacía UPDATE directo sin pasar por cambiarEstado()
  // - No generaba auditoría
  // Reemplazado por endpoints /manual/prepare y /manual/confirm (TAREA 2 y 3)
};

module.exports = destinatariosController;