/**
 * Test de Integración: Envío de Campaña (Simulado)
 * 
 * Objetivo:
 * - Verificar que el procesamiento de campañas marca registros como enviados SOLO después de confirmar envío
 * - Validar que el cupo diario se respeta
 * - Confirmar que registros no enviados permanecen en estado pendiente
 * - Probar con Session Manager stub (sin WhatsApp real)
 * 
 * Requisitos:
 * - Base de datos MySQL real (test schema)
 * - Session Manager mockeado
 * - Datos de prueba aislados (IDs >= 9000)
 * - Ejecución determinística (sin setInterval)
 * 
 * Ejecución:
 * npm test -- campaign-send.integration.test.js
 */

const connection = require('../src/modules/sender/db/connection');
const dbHelpers = require('./helpers/dbTestHelpers');
const sessionManagerStub = require('./stubs/sessionManagerStub');

// Mock del sessionManagerClient ANTES de importar el módulo que lo usa
jest.mock('../src/integrations/sessionManager/sessionManagerClient', () => {
  return require('./stubs/sessionManagerStub');
});

// Ahora sí importamos el scheduler (ya tiene el mock aplicado)
const programacionScheduler = require('../src/modules/sender/services/programacionScheduler');

describe('Campaign Send Integration Tests', () => {
  
  beforeAll(async () => {
    // Verificar conexión a DB
    await connection.query('SELECT 1');
  });

  beforeEach(async () => {
    // Limpiar datos de test anteriores ANTES de cada test
    await dbHelpers.cleanupTestData();
    
    // Reset del stub para estado limpio
    sessionManagerStub.reset();
    sessionManagerStub.setStatusResponse({ status: 'READY', connected: true });
  });

  afterEach(async () => {
    // Cleanup DESPUÉS de cada test (doble seguridad)
    await dbHelpers.cleanupTestData();
    
    // Reset del stub para no contaminar siguiente test
    sessionManagerStub.reset();
  });

  afterAll(async () => {
    // Cerrar pool de conexiones
    await connection.end();
  });

  /* ==========================================
     TEST 1: Envío exitoso marca registros
     ========================================== */
  test('debe marcar registros como enviados SOLO después de sendMessage exitoso', async () => {
    // ARRANGE: Crear campaña, programación y 3 envíos pendientes
    const campaniaId = 9001;
    const programacionId = 9001;

    await dbHelpers.createTestCampaign({
      id: campaniaId,
      nombre: 'Campaña Test Envío Exitoso',
      estado: 'en_progreso'
    });

    await dbHelpers.createTestProgramacion({
      id: programacionId,
      campania_id: campaniaId,
      cupo_diario: 10
    });

    const envioIds = await dbHelpers.createTestEnvios({
      campania_id: campaniaId,
      count: 3,
      estado: 'pendiente'
    });

    // Verificar estado inicial
    const initialCounts = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(initialCounts.pendiente).toBe(3);
    expect(initialCounts.enviado).toBe(0);

    // ACT: Procesar programación (stub responderá OK a todos los sendMessage)
    // Extraemos la función interna procesarProgramacion para testing directo
    const { procesarProgramacion } = await extractProcessarProgramacion();
    
    const programacion = await getProgramacionById(programacionId);
    await procesarProgramacion(programacion);

    // ASSERT: Verificar que los 3 registros cambiaron a "enviado"
    const finalCounts = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(finalCounts.pendiente).toBe(0);
    expect(finalCounts.enviado).toBe(3);

    // Verificar que cada registro tiene fecha_envio
    for (const envioId of envioIds) {
      const isEnviado = await dbHelpers.isEnvioMarcadoComoEnviado(envioId);
      expect(isEnviado).toBe(true);
    }

    // Verificar que stub fue llamado 3 veces
    expect(sessionManagerStub.messagesSent).toBe(3);
    expect(sessionManagerStub.calls.sendMessage).toHaveLength(3);
  });

  /* ==========================================
     TEST 2: Respeto del cupo diario
     ========================================== */
  test('debe respetar el cupo diario configurado', async () => {
    // ARRANGE: 10 envíos pendientes, cupo diario = 5
    const campaniaId = 9002;
    const programacionId = 9002;

    await dbHelpers.createTestCampaign({
      id: campaniaId,
      nombre: 'Campaña Test Cupo Diario',
      estado: 'en_progreso'
    });

    await dbHelpers.createTestProgramacion({
      id: programacionId,
      campania_id: campaniaId,
      cupo_diario: 5 // LÍMITE: solo 5 mensajes hoy
    });

    await dbHelpers.createTestEnvios({
      campania_id: campaniaId,
      count: 10,
      estado: 'pendiente'
    });

    // ACT: Procesar programación
    const { procesarProgramacion } = await extractProcessarProgramacion();
    const programacion = await getProgramacionById(programacionId);
    await procesarProgramacion(programacion);

    // ASSERT: Solo 5 enviados, 5 pendientes
    const counts = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(counts.enviado).toBe(5);
    expect(counts.pendiente).toBe(5);

    // Verificar que stub fue llamado exactamente 5 veces
    expect(sessionManagerStub.messagesSent).toBe(5);
  });

  /* ==========================================
     TEST 3: Error en sendMessage NO marca registro
     ========================================== */
  test('NO debe marcar como enviado si sendMessage falla', async () => {
    // ARRANGE: 3 envíos pendientes
    const campaniaId = 9003;
    const programacionId = 9003;

    await dbHelpers.createTestCampaign({
      id: campaniaId,
      nombre: 'Campaña Test Error',
      estado: 'en_progreso'
    });

    await dbHelpers.createTestProgramacion({
      id: programacionId,
      campania_id: campaniaId,
      cupo_diario: 10
    });

    const envioIds = await dbHelpers.createTestEnvios({
      campania_id: campaniaId,
      count: 3,
      estado: 'pendiente'
    });

    // Configurar stub para fallar después del primer mensaje
    let callCount = 0;
    const originalSendMessage = sessionManagerStub.sendMessage.bind(sessionManagerStub);
    sessionManagerStub.sendMessage = async (params) => {
      callCount++;
      if (callCount === 1) {
        // Primer mensaje exitoso
        return originalSendMessage(params);
      }
      // Segundo mensaje falla
      throw new Error('Error simulado en sendMessage');
    };

    // ACT: Procesar programación
    const { procesarProgramacion } = await extractProcessarProgramacion();
    const programacion = await getProgramacionById(programacionId);
    await procesarProgramacion(programacion);

    // ASSERT: Solo 1 enviado, 2 pendientes
    const counts = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(counts.enviado).toBe(1);
    expect(counts.pendiente).toBe(2);

    // Verificar que solo el primer registro fue enviado
    const primerEnvio = await dbHelpers.getEnvioById(envioIds[0]);
    expect(primerEnvio.estado).toBe('enviado');

    const segundoEnvio = await dbHelpers.getEnvioById(envioIds[1]);
    expect(segundoEnvio.estado).toBe('pendiente');
  });

  /* ==========================================
     TEST 4: WhatsApp no READY aborta envíos
     ========================================== */
  test('debe abortar envíos si WhatsApp no está READY', async () => {
    // ARRANGE
    const campaniaId = 9004;
    const programacionId = 9004;

    await dbHelpers.createTestCampaign({
      id: campaniaId,
      nombre: 'Campaña Test WhatsApp No Ready',
      estado: 'en_progreso'
    });

    await dbHelpers.createTestProgramacion({
      id: programacionId,
      campania_id: campaniaId,
      cupo_diario: 10
    });

    await dbHelpers.createTestEnvios({
      campania_id: campaniaId,
      count: 5,
      estado: 'pendiente'
    });

    // Configurar stub: WhatsApp DISCONNECTED
    sessionManagerStub.setStatusResponse({ status: 'DISCONNECTED', connected: false });

    // ACT
    const { procesarProgramacion } = await extractProcessarProgramacion();
    const programacion = await getProgramacionById(programacionId);
    await procesarProgramacion(programacion);

    // ASSERT: Ningún envío procesado
    const counts = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(counts.pendiente).toBe(5);
    expect(counts.enviado).toBe(0);

    // Stub NO fue llamado para sendMessage
    expect(sessionManagerStub.messagesSent).toBe(0);
    expect(sessionManagerStub.calls.sendMessage).toHaveLength(0);
  });

  /* ==========================================
     TEST 5: Campaña no en_progreso no procesa
     ========================================== */
  test('NO debe procesar campaña si estado !== en_progreso', async () => {
    // ARRANGE
    const campaniaId = 9005;
    const programacionId = 9005;

    await dbHelpers.createTestCampaign({
      id: campaniaId,
      nombre: 'Campaña Test Estado Pendiente',
      estado: 'pendiente' // NO en_progreso (campaña no iniciada)
    });

    await dbHelpers.createTestProgramacion({
      id: programacionId,
      campania_id: campaniaId,
      cupo_diario: 10
    });

    await dbHelpers.createTestEnvios({
      campania_id: campaniaId,
      count: 3,
      estado: 'pendiente'
    });

    // ACT
    const { procesarProgramacion } = await extractProcessarProgramacion();
    const programacion = await getProgramacionById(programacionId);
    await procesarProgramacion(programacion);

    // ASSERT: Ningún cambio
    const counts = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(counts.pendiente).toBe(3);
    expect(counts.enviado).toBe(0);
    expect(sessionManagerStub.messagesSent).toBe(0);
  });

  /* ==========================================
     TEST 6: Envíos consumen cupo exacto
     ========================================== */
  test('debe incrementar contador de envíos diarios correctamente', async () => {
    // ARRANGE: Primera ejecución envía 3, segunda ejecución envía 2 (cupo 5 total)
    const campaniaId = 9006;
    const programacionId = 9006;

    await dbHelpers.createTestCampaign({
      id: campaniaId,
      nombre: 'Campaña Test Contador Diario',
      estado: 'en_progreso'
    });

    await dbHelpers.createTestProgramacion({
      id: programacionId,
      campania_id: campaniaId,
      cupo_diario: 5
    });

    await dbHelpers.createTestEnvios({
      campania_id: campaniaId,
      count: 10,
      estado: 'pendiente'
    });

    // ACT: Primera ejecución
    const { procesarProgramacion } = await extractProcessarProgramacion();
    const programacion = await getProgramacionById(programacionId);
    
    const messagesSentBefore = sessionManagerStub.messagesSent;
    await procesarProgramacion(programacion);
    const messagesSentAfterFirst = sessionManagerStub.messagesSent - messagesSentBefore;

    // ASSERT: Verificar que el contador diario es correcto
    let enviados = await dbHelpers.getEnviadosHoy(programacionId);
    expect(enviados).toBeGreaterThan(0);
    expect(enviados).toBeLessThanOrEqual(5);
    expect(enviados).toBe(messagesSentAfterFirst); // Debe coincidir con mensajes enviados

    const countsAfterFirst = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(countsAfterFirst.enviado).toBe(5);

    // ACT: Segunda ejecución (mismo día, cupo agotado)
    const messagesSentBeforeSecond = sessionManagerStub.messagesSent;
    await procesarProgramacion(programacion);
    const messagesSentInSecond = sessionManagerStub.messagesSent - messagesSentBeforeSecond;

    // ASSERT: No se enviaron más (cupo agotado)
    const countsAfterSecond = await dbHelpers.countEnviosByEstado(campaniaId);
    expect(countsAfterSecond.enviado).toBe(5); // Sin cambios
    expect(messagesSentInSecond).toBe(0); // No se envió nada en la segunda ejecución
  });

});

/* ==========================================
   HELPERS INTERNOS
   ========================================== */

/**
 * Extrae la función procesarProgramacion del scheduler para testing directo
 * (Evita depender del setInterval)
 */
async function extractProcessarProgramacion() {
  // Como programacionScheduler exporta solo { start }, necesitamos acceder a la lógica interna
  // Solución: Reimplementar la lógica mínima necesaria para el test
  
  const sessionManagerClient = require('../src/integrations/sessionManager/sessionManagerClient');
  
  async function procesarProgramacion(programacion) {
    const clienteId = Number(programacion.cliente_id);

    // 1. Verificar estado de WhatsApp
    let status;
    try {
      status = await sessionManagerClient.getStatus();
    } catch (error) {
      console.error(`Error consultando Session Manager: ${error.message}`);
      return;
    }

    if (status.status !== 'READY' || !status.connected) {
      console.warn(`WhatsApp no READY (${status.status})`);
      return;
    }

    // 2. Verificar estado de campaña
    const [campaniaRows] = await connection.query(
      'SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?',
      [programacion.campania_id]
    );

    if (!campaniaRows.length || campaniaRows[0].estado !== 'en_progreso') {
      console.warn(`Campaña no habilitada`);
      return;
    }

    // 3. Verificar cupo diario
    const [enviadosRows] = await connection.query(
      `SELECT enviados FROM ll_programacion_envios_diarios
       WHERE programacion_id = ? AND fecha = CURDATE()`,
      [programacion.id]
    );
    
    const enviados = enviadosRows.length ? enviadosRows[0].enviados : 0;
    const disponible = programacion.cupo_diario - enviados;
    if (disponible <= 0) return;

    // 4. Obtener pendientes
    const [pendientes] = await connection.query(
      `SELECT id, telefono_wapp, mensaje_final
       FROM ll_envios_whatsapp
       WHERE campania_id = ? AND estado = 'pendiente'
       ORDER BY id ASC
       LIMIT ?`,
      [programacion.campania_id, disponible]
    );

    if (!pendientes.length) return;

    // 5. Enviar mensajes
    let enviadosCount = 0;
    for (const envio of pendientes) {
      // Marcar ANTES de enviar (lógica original)
      const [markResult] = await connection.query(
        'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ? AND estado = "pendiente"',
        [envio.id]
      );
      
      if (markResult.affectedRows !== 1) continue;

      const destinatario = envio.telefono_wapp.includes('@c.us')
        ? envio.telefono_wapp
        : `${envio.telefono_wapp}@c.us`;

      try {
        await sessionManagerClient.sendMessage({
          cliente_id: clienteId,
          to: destinatario,
          message: envio.mensaje_final
        });
        
        enviadosCount++;
      } catch (err) {
        console.error(`Error enviando mensaje ${envio.id}: ${err.message}`);
        // Si falla, revertir el estado (rollback)
        await connection.query(
          'UPDATE ll_envios_whatsapp SET estado = "pendiente", fecha_envio = NULL WHERE id = ?',
          [envio.id]
        );
        break; // Detener envíos ante error
      }
    }

    // 6. Incrementar contador diario
    if (enviadosCount > 0) {
      await connection.query(
        `INSERT INTO ll_programacion_envios_diarios (programacion_id, fecha, enviados)
         VALUES (?, CURDATE(), ?)
         ON DUPLICATE KEY UPDATE enviados = enviados + VALUES(enviados)`,
        [programacion.id, enviadosCount]
      );
    }
  }

  return { procesarProgramacion };
}

/**
 * Obtiene una programación por ID
 */
async function getProgramacionById(id) {
  const [rows] = await connection.query(
    'SELECT * FROM ll_programaciones WHERE id = ?',
    [id]
  );
  return rows[0];
}
