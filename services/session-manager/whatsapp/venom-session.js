const venom = require('venom-bot');

// Single admin WhatsApp session (cliente_id is business context only)
let adminClient = null;
let adminState = 'DISCONNECTED'; // Estado real reportado por Venom
let qrData = null; // QR temporal durante conexión

/**
 * Inicia la sesión ADMIN de WhatsApp (única sesión del sistema)
 * @returns {Promise<Object>} Estado de la conexión
 */
async function connect() {
  // Si ya existe, devolver estado actual sin recrear
  if (adminClient) {
    console.log('[VenomSession] Sesión ADMIN ya existe');
    return {
      alreadyConnected: true,
      state: adminState,
      session: 'admin'
    };
  }
  
  console.log('[VenomSession] Iniciando conexión ADMIN');
  adminState = 'CONNECTING';
  
  try {
    const client = await venom.create({
      session: 'admin',
      headless: true,
      useChrome: true,
      executablePath: '/usr/bin/google-chrome-stable',
      disableSpins: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      },
      // Capturar QR durante la conexión
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        console.log(`[VenomSession] QR generado para sesión ADMIN (intento ${attempts})`);
        adminState = 'QR_REQUIRED';
        qrData = {
          base64: base64Qr,
          url: urlCode,
          attempts,
          timestamp: Date.now()
        };
      },
      statusFind: (statusSession, session) => {
        console.log('[VenomSession] Estado ADMIN:', statusSession);
        
        // Mapear estados de Venom a nuestros estados
        const stateMap = {
          'initBrowser': 'CONNECTING',
          'openBrowser': 'CONNECTING',
          'initWhatsapp': 'CONNECTING',
          'successPageWhatsapp': 'CONNECTING',
          'waitForLogin': 'QR_REQUIRED',
          'desconnectedMobile': 'DISCONNECTED',
          'deleteToken': 'DISCONNECTED',
          'chatsAvailable': 'READY',
          'isLogged': 'READY',
          'qrReadSuccess': 'CONNECTING',
          'qrReadFail': 'QR_REQUIRED'
        };
        
        const newState = stateMap[statusSession] || adminState;
        if (newState !== adminState) {
          adminState = newState;
          console.log(`[VenomSession] Cambio de estado: ${statusSession} → ${adminState}`);
        }
      }
    });
    
    // ✅ Al llegar aquí, el cliente está READY
    adminClient = client;
    adminState = 'READY';
    qrData = null; // Limpiar QR temporal
    
    console.log('✅ [VenomSession] Sesión ADMIN conectada y READY');
    
    return {
      alreadyConnected: false,
      state: adminState,
      session: 'admin'
    };
    
  } catch (error) {
    console.error('❌ [VenomSession] Error al conectar sesión ADMIN:', error.message);
    adminState = 'DISCONNECTED';
    qrData = null;
    throw error;
  }
}

/**
 * Verifica si la sesión ADMIN está conectada y READY
 */
function isConnected() {
  return adminState === 'READY';
}

/**
 * Desconecta la sesión ADMIN
 */
async function disconnect() {
  if (!adminClient) {
    console.log('[VenomSession] Sesión ADMIN no está conectada');
    return { success: true, message: 'No active session' };
  }
  
  try {
    await adminClient.close();
    adminClient = null;
    adminState = 'DISCONNECTED';
    console.log('[VenomSession] Sesión ADMIN desconectada');
    return { success: true, message: 'Disconnected' };
  } catch (error) {
    console.error('[VenomSession] Error al desconectar sesión ADMIN:', error.message);
    adminClient = null;
    adminState = 'DISCONNECTED';
    return { success: true, message: 'Disconnected with errors' };
  }
}

/**
 * Envía un mensaje de WhatsApp usando la sesión ADMIN
 * @param {number} clienteId - Metadata para logging/billing (NO crea sesión)
 * @param {string} to - Número de destino
 * @param {string} text - Mensaje a enviar
 */
async function sendMessage(clienteId, to, text) {
  if (!adminClient) {
    throw new Error('SESSION_NOT_READY');
  }
  
  // Formatear número
  const rawNumber = String(to).replace(/\D/g, '');
  const destinatario = rawNumber.includes('@c.us') ? rawNumber : `${rawNumber}@c.us`;
  
  console.log(`[VenomSession] Enviando mensaje via ADMIN: cliente_id=${clienteId} (metadata), to=${destinatario}`);
  
  try {
    // ✅ Este método funciona correctamente
    const result = await adminClient.sendText(destinatario, text);
    
    console.log(`✅ [VenomSession] Mensaje enviado exitosamente a ${destinatario}`);
    
    return {
      success: true,
      cliente_id: clienteId,
      to: rawNumber,
      messageId: result?.id || 'sent',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ [VenomSession] Error al enviar mensaje:`, error.message);
    throw error;
  }
}

/**
 * Obtiene el estado de la sesión ADMIN
 */
function getState() {
  const response = {
    connected: adminState === 'READY',
    state: adminState,
    session: 'admin'
  };
  
  // Incluir QR si está disponible
  if (qrData && adminState === 'QR_REQUIRED') {
    response.qr = qrData;
  }
  
  return response;
}

module.exports = {
  connect,
  disconnect,
  sendMessage,
  getState,
  isConnected
};
