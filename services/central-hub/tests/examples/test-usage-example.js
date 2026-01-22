/**
 * EJEMPLO: Uso de funciones internas para testing
 * 
 * Este archivo demuestra cómo acceder a las funciones expuestas
 * en __test__ para crear tests de integración sin ejecutar
 * el scheduler automático (setInterval).
 */

// ============================================
// IMPORT DE FUNCIONES INTERNAS
// ============================================

const scheduler = require('../src/modules/sender/services/programacionScheduler');

// Acceso al namespace __test__
const { 
  procesarProgramacion, 
  marcarEnviado, 
  obtenerPendientes 
} = scheduler.__test__;

// ============================================
// EJEMPLO 1: Test de procesamiento directo
// ============================================

async function ejemploProcesamiento() {
  // Mock de programación (estructura real de DB)
  const mockProgramacion = {
    id: 9001,
    campania_id: 100,
    cliente_id: 1,
    cupo_diario: 50,
    dias_semana: 'mon,tue,wed,thu,fri',
    hora_inicio: '09:00:00',
    hora_fin: '18:00:00'
  };

  // Ejecutar procesamiento directamente (sin esperar setInterval)
  await procesarProgramacion(mockProgramacion);
  
  // Ahora podemos verificar en DB:
  // - ¿Cuántos registros cambiaron a "enviado"?
  // - ¿Se respetó el cupo diario?
  // - ¿Se llamó al Session Manager correctamente?
}

// ============================================
// EJEMPLO 2: Test de marcado individual
// ============================================

async function ejemploMarcado() {
  const envioId = 12345;
  
  // Marcar como enviado directamente
  const marcado = await marcarEnviado(envioId);
  
  console.log(`Registro ${envioId} marcado:`, marcado); // true o false
  
  // Verificaciones:
  // - Si retorna true: UPDATE afectó 1 fila (estado cambió)
  // - Si retorna false: Registro no existe o ya estaba enviado
}

// ============================================
// EJEMPLO 3: Test de consulta de pendientes
// ============================================

async function ejemploPendientes() {
  const campaniaId = 100;
  const limite = 10;
  
  // Obtener pendientes (como lo hace el scheduler)
  const pendientes = await obtenerPendientes(campaniaId, limite);
  
  console.log(`Pendientes encontrados:`, pendientes.length);
  
  // Estructura de retorno:
  // [
  //   { id: 1, telefono_wapp: '549...', mensaje_final: 'Hola!' },
  //   { id: 2, telefono_wapp: '549...', mensaje_final: 'Hola!' }
  // ]
  
  // Verificaciones:
  // - length <= limite
  // - Todos tienen estado 'pendiente' (implícito en la query)
  // - Están ordenados por ID ASC
}

// ============================================
// EJEMPLO 4: Test de flujo completo
// ============================================

async function ejemploFlujoCompleto() {
  const campaniaId = 9001;
  const programacionId = 9001;
  
  // 1. Verificar pendientes antes
  const pendientesAntes = await obtenerPendientes(campaniaId, 100);
  console.log(`Pendientes ANTES:`, pendientesAntes.length);
  
  // 2. Ejecutar procesamiento
  await procesarProgramacion({
    id: programacionId,
    campania_id: campaniaId,
    cliente_id: 1,
    cupo_diario: 5, // Limitar a 5
    dias_semana: 'mon,tue,wed,thu,fri',
    hora_inicio: '00:00:00',
    hora_fin: '23:59:59'
  });
  
  // 3. Verificar pendientes después
  const pendientesDespues = await obtenerPendientes(campaniaId, 100);
  console.log(`Pendientes DESPUÉS:`, pendientesDespues.length);
  
  // Validaciones:
  const procesados = pendientesAntes.length - pendientesDespues.length;
  console.log(`Procesados:`, procesados); // Debe ser <= cupo_diario (5)
}

// ============================================
// EJEMPLO 5: Test con Session Manager stub
// ============================================

// Mock de sessionManagerClient
jest.mock('../src/integrations/sessionManager/sessionManagerClient', () => ({
  getStatus: jest.fn(async () => ({
    status: 'READY',
    connected: true
  })),
  sendMessage: jest.fn(async ({ to, message }) => {
    console.log(`[STUB] Enviando a ${to}: ${message}`);
    return { success: true };
  })
}));

const sessionManagerClient = require('../src/integrations/sessionManager/sessionManagerClient');

async function ejemploConStub() {
  // Configurar stub para retornar READY
  sessionManagerClient.getStatus.mockResolvedValue({
    status: 'READY',
    connected: true
  });
  
  // Configurar stub para simular envío exitoso
  sessionManagerClient.sendMessage.mockResolvedValue({
    success: true
  });
  
  // Ejecutar procesamiento
  await procesarProgramacion({
    id: 9001,
    campania_id: 9001,
    cliente_id: 1,
    cupo_diario: 10,
    dias_semana: 'mon,tue,wed,thu,fri',
    hora_inicio: '00:00:00',
    hora_fin: '23:59:59'
  });
  
  // Verificar que el stub fue llamado
  console.log(`Llamadas a getStatus:`, sessionManagerClient.getStatus.mock.calls.length);
  console.log(`Llamadas a sendMessage:`, sessionManagerClient.sendMessage.mock.calls.length);
  
  // Verificar argumentos de las llamadas
  const primeraLlamada = sessionManagerClient.sendMessage.mock.calls[0][0];
  console.log(`Primera llamada sendMessage:`, primeraLlamada);
  // { cliente_id: 1, to: '549...@c.us', message: 'Hola!' }
}

// ============================================
// NO HACER ESTO EN PRODUCCIÓN
// ============================================

// ❌ INCORRECTO: Usar funciones internas en código de producción
// const scheduler = require('./programacionScheduler');
// scheduler.__test__.procesarProgramacion(...); // MAL!

// ✅ CORRECTO: Solo usar API pública en producción
// const scheduler = require('./programacionScheduler');
// scheduler.start(); // BIEN!

// ============================================
// EXPORTAR EJEMPLOS PARA TESTING
// ============================================

module.exports = {
  ejemploProcesamiento,
  ejemploMarcado,
  ejemploPendientes,
  ejemploFlujoCompleto,
  ejemploConStub
};

// ============================================
// EJECUCIÓN DIRECTA (para testing rápido)
// ============================================

if (require.main === module) {
  console.log('🧪 Ejecutando ejemplos de uso de __test__...');
  console.log('');
  
  // Descomentar para ejecutar ejemplos individuales:
  
  // ejemploProcesamiento().catch(console.error);
  // ejemploMarcado().catch(console.error);
  // ejemploPendientes().catch(console.error);
  // ejemploFlujoCompleto().catch(console.error);
  // ejemploConStub().catch(console.error);
  
  console.log('✅ Para ejecutar, descomenta un ejemplo en la sección final');
}
