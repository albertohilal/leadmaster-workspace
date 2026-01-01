/**
 * Test end-to-end del módulo Selector de Prospectos
 * Prueba: autenticación, carga de campañas, filtros, y selección de destinatarios
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3012';
let token = null;

// Colores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(test, result) {
  log(`✅ ${test}`, 'green');
  if (result) log(`   → ${result}`, 'cyan');
}

function logError(test, error) {
  log(`❌ ${test}`, 'red');
  log(`   → ${error}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 1. Test de autenticación
async function testLogin() {
  try {
    logInfo('TEST 1: Autenticación con usuario Haby');
    
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      usuario: 'Haby',
      password: 'haby1973'
    });

    if (response.data.success && response.data.token) {
      token = response.data.token;
      logSuccess('Login exitoso', `Token recibido, Cliente ID: ${response.data.user.cliente_id}`);
      return true;
    } else {
      logError('Login falló', 'No se recibió token');
      return false;
    }
  } catch (error) {
    logError('Login falló', error.response?.data?.message || error.message);
    return false;
  }
}

// 2. Test de carga de campañas
async function testCargarCampanas() {
  try {
    logInfo('TEST 2: Cargar campañas del cliente');
    
    const response = await axios.get(`${BASE_URL}/sender/campaigns`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const campanas = response.data;
    if (Array.isArray(campanas) && campanas.length > 0) {
      logSuccess('Campañas cargadas', `${campanas.length} campañas encontradas`);
      campanas.forEach(c => log(`   • ID: ${c.id} - ${c.nombre}`, 'cyan'));
      return campanas[0].id; // Retornar ID de la primera campaña para siguientes tests
    } else {
      logError('No se encontraron campañas', 'Array vacío');
      return null;
    }
  } catch (error) {
    logError('Error al cargar campañas', error.response?.data?.message || error.message);
    return null;
  }
}

// 3. Test de filtro por tipo de cliente
async function testFiltroTipoCliente() {
  try {
    logInfo('TEST 3: Filtro por tipo de cliente');
    
    // Test 3.1: Clientes Originales (client = 1)
    const responseClientes = await axios.get(`${BASE_URL}/sender/prospectos/filtrar?tipoCliente=clientes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const clientes = responseClientes.data.prospectos || [];
    logSuccess('Filtro "Clientes Originales"', `${clientes.length} registros`);
    
    // Test 3.2: Solo Prospectos (client = 0 o NULL)
    const responseProspectos = await axios.get(`${BASE_URL}/sender/prospectos/filtrar?tipoCliente=prospectos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const prospectos = responseProspectos.data.prospectos || [];
    logSuccess('Filtro "Solo Prospectos"', `${prospectos.length} registros`);
    
    return true;
  } catch (error) {
    logError('Error en filtro de tipo de cliente', error.response?.data?.message || error.message);
    return false;
  }
}

// 4. Test de filtro por campaña (exclusión de enviados/pendientes)
async function testFiltroPorCampania(campaniaId) {
  try {
    logInfo(`TEST 4: Filtro por campaña (ID: ${campaniaId}) - Exclusión de enviados/pendientes`);
    
    // Sin campaña - todos los prospectos disponibles
    const responseSin = await axios.get(`${BASE_URL}/sender/prospectos/filtrar?estado=sin_envio`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const totalSin = responseSin.data.prospectos?.length || 0;
    logSuccess('Sin filtro de campaña', `${totalSin} prospectos disponibles`);
    
    // Con campaña - solo los que NO han sido enviados en ESTA campaña
    const responseCon = await axios.get(`${BASE_URL}/sender/prospectos/filtrar?campania_id=${campaniaId}&estado=sin_envio`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const totalCon = responseCon.data.prospectos?.length || 0;
    logSuccess(`Con filtro de campaña ${campaniaId}`, `${totalCon} prospectos disponibles (excluye enviados/pendientes)`);
    
    if (totalCon <= totalSin) {
      logSuccess('Validación', 'Los prospectos filtrados por campaña son iguales o menos que sin filtro');
    } else {
      logError('Validación falló', 'Hay MÁS prospectos con filtro que sin filtro (error lógico)');
    }
    
    return true;
  } catch (error) {
    logError('Error en filtro por campaña', error.response?.data?.message || error.message);
    return false;
  }
}

// 5. Test de filtros combinados
async function testFiltrosCombinados(campaniaId) {
  try {
    logInfo('TEST 5: Filtros combinados (campaña + tipo cliente + rubro)');
    
    const response = await axios.get(
      `${BASE_URL}/sender/prospectos/filtrar?campania_id=${campaniaId}&tipoCliente=clientes&rubro=Tatuajes&estado=sin_envio`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const prospectos = response.data.prospectos || [];
    logSuccess('Filtros combinados aplicados', `${prospectos.length} prospectos encontrados`);
    
    if (prospectos.length > 0) {
      const ejemplo = prospectos[0];
      log(`   Ejemplo: ${ejemplo.nombre} - ${ejemplo.rubro} (${ejemplo.area_rubro || 'sin área'})`, 'cyan');
    }
    
    return true;
  } catch (error) {
    logError('Error en filtros combinados', error.response?.data?.message || error.message);
    return false;
  }
}

// 6. Test de visualización de campos
async function testVisualizacionCampos() {
  try {
    logInfo('TEST 6: Verificar campos en respuesta');
    
    const response = await axios.get(`${BASE_URL}/sender/prospectos/filtrar?tipoCliente=clientes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const prospectos = response.data.prospectos || [];
    if (prospectos.length === 0) {
      logError('No hay prospectos para verificar campos', 'Array vacío');
      return false;
    }
    
    const ejemplo = prospectos[0];
    const camposRequeridos = ['id', 'nombre', 'telefono_wapp', 'direccion', 'ciudad', 'rubro', 'area_rubro', 'estado'];
    const camposPresentes = camposRequeridos.filter(campo => ejemplo.hasOwnProperty(campo));
    
    logSuccess('Campos presentes', `${camposPresentes.length}/${camposRequeridos.length}`);
    
    camposPresentes.forEach(campo => {
      const valor = ejemplo[campo] || '(vacío)';
      log(`   • ${campo}: ${valor}`, 'cyan');
    });
    
    const camposFaltantes = camposRequeridos.filter(campo => !ejemplo.hasOwnProperty(campo));
    if (camposFaltantes.length > 0) {
      logError('Campos faltantes', camposFaltantes.join(', '));
    }
    
    return camposFaltantes.length === 0;
  } catch (error) {
    logError('Error verificando campos', error.response?.data?.message || error.message);
    return false;
  }
}

// 7. Test de selección y agregado de destinatarios
async function testAgregarDestinatarios(campaniaId) {
  try {
    logInfo(`TEST 7: Agregar destinatarios a campaña ${campaniaId}`);
    
    // Primero obtener algunos prospectos disponibles
    const responseProspectos = await axios.get(
      `${BASE_URL}/sender/prospectos/filtrar?campania_id=${campaniaId}&estado=sin_envio&tipoCliente=clientes`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const disponibles = responseProspectos.data.prospectos || [];
    if (disponibles.length === 0) {
      logError('No hay prospectos disponibles', 'No se puede probar agregar destinatarios');
      return false;
    }
    
    // Tomar los primeros 3 prospectos
    const prospectosParaAgregar = disponibles.slice(0, 3).map(p => p.id);
    
    logInfo(`Intentando agregar ${prospectosParaAgregar.length} destinatarios...`);
    
    const response = await axios.post(
      `${BASE_URL}/sender/destinatarios/agregar`,
      {
        campania_id: campaniaId,
        lugar_ids: prospectosParaAgregar
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (response.data.success) {
      logSuccess('Destinatarios agregados', `${response.data.agregados || prospectosParaAgregar.length} destinatarios`);
      
      // Verificar que ahora aparezcan como pendientes
      const responseVerificacion = await axios.get(
        `${BASE_URL}/sender/prospectos/filtrar?campania_id=${campaniaId}&estado=pendiente`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const pendientes = responseVerificacion.data.prospectos || [];
      const agregadosEncontrados = pendientes.filter(p => prospectosParaAgregar.includes(p.id));
      
      logSuccess('Verificación de estado', `${agregadosEncontrados.length}/${prospectosParaAgregar.length} aparecen como pendientes`);
      
      return true;
    } else {
      logError('Error al agregar destinatarios', response.data.message);
      return false;
    }
  } catch (error) {
    logError('Error agregando destinatarios', error.response?.data?.message || error.message);
    return false;
  }
}

// Ejecutar todos los tests
async function runAllTests() {
  log('\n========================================', 'blue');
  log('  TEST END-TO-END: SELECTOR DE PROSPECTOS', 'blue');
  log('========================================\n', 'blue');
  
  const results = [];
  
  // Test 1: Login
  const loginOk = await testLogin();
  results.push({ name: 'Autenticación', passed: loginOk });
  if (!loginOk) {
    log('\n❌ Tests abortados: fallo en autenticación\n', 'red');
    return;
  }
  
  console.log('');
  
  // Test 2: Cargar campañas
  const campaniaId = await testCargarCampanas();
  results.push({ name: 'Carga de campañas', passed: campaniaId !== null });
  
  console.log('');
  
  // Test 3: Filtro tipo cliente
  const filtroTipoOk = await testFiltroTipoCliente();
  results.push({ name: 'Filtro tipo cliente', passed: filtroTipoOk });
  
  console.log('');
  
  // Test 4: Filtro por campaña
  if (campaniaId) {
    const filtroCampaniaOk = await testFiltroPorCampania(campaniaId);
    results.push({ name: 'Filtro por campaña', passed: filtroCampaniaOk });
    
    console.log('');
    
    // Test 5: Filtros combinados
    const filtrosCombinadosOk = await testFiltrosCombinados(campaniaId);
    results.push({ name: 'Filtros combinados', passed: filtrosCombinadosOk });
    
    console.log('');
  }
  
  // Test 6: Campos
  const camposOk = await testVisualizacionCampos();
  results.push({ name: 'Visualización de campos', passed: camposOk });
  
  console.log('');
  
  // Test 7: Agregar destinatarios
  if (campaniaId) {
    const agregarOk = await testAgregarDestinatarios(campaniaId);
    results.push({ name: 'Agregar destinatarios', passed: agregarOk });
  }
  
  // Resumen final
  console.log('');
  log('========================================', 'blue');
  log('  RESUMEN DE TESTS', 'blue');
  log('========================================', 'blue');
  
  results.forEach(result => {
    if (result.passed) {
      log(`✅ ${result.name}`, 'green');
    } else {
      log(`❌ ${result.name}`, 'red');
    }
  });
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log('');
  if (passed === total) {
    log(`🎉 TODOS LOS TESTS PASARON (${passed}/${total})`, 'green');
  } else {
    log(`⚠️  ${passed}/${total} tests pasaron`, 'yellow');
  }
  console.log('');
}

// Ejecutar
runAllTests().catch(error => {
  logError('Error fatal en tests', error.message);
  process.exit(1);
});
