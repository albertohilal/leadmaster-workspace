const venom = require('venom-bot');

// Single admin WhatsApp session (cliente_id is business context only)
let adminClient = null;
let adminState = 'DISCONNECTED'; // Estado real reportado por Venom
let qrData = null; // QR temporal durante conexión

// LOGIN_MODE: 'local' para primera autenticación con Chrome visible, 'server' para producción headless
const LOGIN_MODE = process.env.LOGIN_MODE || 'server';
const isLocalLogin = LOGIN_MODE === 'local';

console.log(`[VenomSession] Modo de login: ${LOGIN_MODE} (headless: ${!isLocalLogin})`);

/**
 * FLUJO DE AUTENTICACIÓN:
 * 
 * 1. LOGIN LOCAL (primera vez):
 *    - Ejecutar con LOGIN_MODE=local
 *    - Chrome se abre visible (headless: false)
 *    - Escanear QR en ventana de Chrome
 *    - Tokens se guardan en tokens/admin/
 *    - Copiar tokens/admin/ al servidor: rsync -avz tokens/admin/ user@vps:/path/to/session-manager/tokens/admin/
 * 
 * 2. PRODUCCIÓN (servidor):
 *    - Ejecutar con LOGIN_MODE=server (default)
 *    - Chrome headless (sin ventana)
 *    - Venom reutiliza tokens/admin/ existentes
 *    - Estado pasa directo a READY sin pedir QR
 *    - NO es necesario volver a escanear
 */

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
      headless: !isLocalLogin, // false en modo local, true en servidor
      useChrome: true,
      executablePath: '/usr/bin/google-chrome-stable',
      disableSpins: true,
      logQR: isLocalLogin, // Mostrar QR en consola solo en modo local
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        ...(isLocalLogin ? [] : ['--disable-gpu']) // GPU solo deshabilitado en servidor
      ],
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: !isLocalLogin // false en modo local, true en servidor
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
    
    // Validar que el cliente se creó correctamente
    if (!client) {
      throw new Error('Venom client creation returned undefined');
    }
    
    // ✅ Al llegar aquí, el cliente está READY
    adminClient = client;
    adminState = 'READY';
    qrData = null; // Limpiar QR temporal
    
    console.log('✅ [VenomSession] Sesión ADMIN conectada y READY');
    console.log('[VenomSession] Esperando 5s para sincronización de WhatsApp...');
    
    // Esperar 5 segundos para que WhatsApp sincronice chats
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      alreadyConnected: false,
      state: adminState,
      session: 'admin'
    };
    
  } catch (error) {
    console.error('❌ [VenomSession] Error al conectar sesión ADMIN:', error?.message || error);
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
    // SOLUCIÓN DEFINITIVA: Simular interacción humana con la UI de WhatsApp Web
    // Esto funciona tanto con WhatsApp normal como Business
    const page = adminClient.page;
    
    console.log(`[VenomSession] Navegando a chat con ${destinatario}...`);
    
    // Navegar al chat usando la URL directa de WhatsApp Web
    const chatUrl = `https://web.whatsapp.com/send?phone=${rawNumber}`;
    await page.goto(chatUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Esperar a que cargue el cuadro de texto
    await page.waitForSelector('div[contenteditable="true"][data-tab="10"]', { timeout: 15000 });
    
    console.log(`[VenomSession] Escribiendo mensaje...`);
    
    // Escribir el mensaje en el cuadro de texto
    await page.type('div[contenteditable="true"][data-tab="10"]', text, { delay: 50 });
    
    // Esperar un momento
    await page.waitForTimeout(500);
    
    // Buscar y hacer clic en el botón de enviar
    await page.click('button[aria-label="Send"], button[aria-label="Enviar"], span[data-icon="send"]');
    
    // Esperar a que se envíe
    await page.waitForTimeout(1000);
    
    console.log(`✅ [VenomSession] Mensaje enviado exitosamente via UI`);
    
    return {
      success: true,
      cliente_id: clienteId,
      to: rawNumber,
      messageId: 'sent-via-ui',
      timestamp: new Date().toISOString(),
      method: 'UI-Simulation'
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
