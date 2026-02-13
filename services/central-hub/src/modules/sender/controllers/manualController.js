const db = require('../../../config/db');

/**
 * Manual Controller
 * Central Hub – LeadMaster
 * 
 * FASE 1 – Modo Manual Controlado
 * 
 * Gestiona el registro de envíos manuales por Web WhatsApp (wa.me).
 * NO modifica estado automático de prospectos.
 * NO usa session-manager ni WhatsApp Cloud API.
 */

const manualController = {
  /**
   * Registrar intento de envío manual
   * 
   * Body:
   * - prospecto_id (number): ID del prospecto (societe.rowid)
   * - telefono (string): Teléfono normalizado (solo números)
   * - mensaje (string): Mensaje enviado
   * 
   * Endpoint: POST /api/sender/registro-manual
   */
  async registrarEnvioManual(req, res) {
    try {
      const { prospecto_id, telefono, mensaje } = req.body;

      // Validación de campos obligatorios
      if (!prospecto_id || !telefono) {
        return res.status(400).json({
          success: false,
          error: 'prospecto_id y telefono son obligatorios'
        });
      }

      // Insertar registro de envío manual en la base de datos
      const sql = `
        INSERT INTO ll_envios_manual
        (prospecto_id, telefono, mensaje, fecha)
        VALUES (?, ?, ?, NOW())
      `;

      await db.query(sql, [prospecto_id, telefono, mensaje || '']);

      console.log(`[MANUAL] Registro exitoso para prospecto ${prospecto_id}, tel: ${telefono}`);

      return res.status(200).json({
        success: true,
        message: 'Envío manual registrado exitosamente'
      });

    } catch (error) {
      console.error('[MANUAL] Error al registrar envío:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al registrar envío manual',
        details: error.message
      });
    }
  }
};

module.exports = manualController;
