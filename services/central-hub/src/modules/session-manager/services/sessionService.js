// Servicio central de gestión de sesiones WhatsApp multi-tenant con whatsapp-web.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Almacenar múltiples clientes (clienteId => { client, qr, ready, connecting })
const clientSessions = new Map();

/**
 * Cargar sesiones existentes del disco al iniciar
 * DESHABILITADO: Causa problemas de "Disconnected by cell phone"
 */
function loadExistingSessions() {
  console.log('📁 [session-manager] Reconexión automática DESHABILITADA');
  console.log('💡 [session-manager] Usa el botón "Conectar WhatsApp" para iniciar sesiones');
  // const tokensPath = path.join(__dirname, '../../../tokens');
  
  // try {
  //   if (!fs.existsSync(tokensPath)) {
  //     console.log('📁 [session-manager] No hay sesiones previas');
  //     return;
  //   }

  //   const folders = fs.readdirSync(tokensPath);
  //   const clientFolders = folders.filter(f => f.startsWith('client_'));
    
  //   if (clientFolders.length === 0) {
  //     console.log('📁 [session-manager] No hay sesiones de clientes guardadas');
  //     return;
  //   }

  //   console.log(`📁 [session-manager] Encontradas ${clientFolders.length} sesiones guardadas`);
    
  //   clientFolders.forEach(folder => {
  //     const match = folder.match(/client_(\d+)/);
  //     if (match) {
  //       const clienteId = parseInt(match[1]);
  //       console.log(`🔄 [session-manager] Reconectando cliente ${clienteId}...`);
        
  //       // Inicializar sesión sin esperar (async)
  //       setTimeout(() => {
  //         getOrCreateClient(clienteId, folder);
  //       }, 2000); // Esperar 2 segundos entre cada reconexión
  //     }
  //   });
  // } catch (error) {
  //   console.error('❌ [session-manager] Error cargando sesiones:', error.message);
  // }
}

/**
 * Obtener o crear cliente para un cliente específico
 * @param {number} clienteId - ID del cliente
 * @param {string} sessionName - Nombre de la sesión (opcional)
 */
function getOrCreateClient(clienteId, sessionName = null) {
  const session = clientSessions.get(clienteId);
  
  // Si ya existe y está listo o conectando, retornar
  if (session && (session.ready || session.connecting)) {
    return session.client;
  }

  // Si no existe, crear nueva sesión
  if (!session || !session.connecting) {
    const name = sessionName || `client_${clienteId}`;
    console.log(`🟢 [session-manager] Inicializando WhatsApp para cliente ${clienteId} (${name})...`);
    
    // Inicializar estado
    clientSessions.set(clienteId, {
      client: null,
      qr: null,
      ready: false,
      connecting: true,
      sessionName: name
    });
    
    // Crear cliente de whatsapp-web.js con LocalAuth
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: name,
        dataPath: path.join(__dirname, '../../../tokens')
      }),
      puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-blink-features=AutomationControlled',
          '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      }





    });

    // Evento: QR recibido
    client.on('qr', async (qr) => {
      const sess = clientSessions.get(clienteId);
      if (sess) {
        try {
          // Convertir QR a base64
          const qrBase64 = await QRCode.toDataURL(qr);
          sess.qr = qrBase64;
          sess.ready = false;
          console.log(`🔑 [session-manager] QR generado para cliente ${clienteId}`);
          console.log(`📱 [session-manager] QR disponible en: GET /session-manager/qr`);
        } catch (error) {
          console.error(`❌ [session-manager] Error generando QR:`, error.message);
        }
      }
    });

    // Evento: Cliente autenticado
    client.on('authenticated', () => {
      console.log(`✅ [session-manager] Cliente ${clienteId} autenticado`);
    });

    // Evento: Cliente listo
    client.on('ready', () => {
      const sess = clientSessions.get(clienteId);
      if (sess) {
        sess.client = client;
        sess.ready = true;
        sess.qr = null;
        sess.connecting = false;
        console.log(`✅ [session-manager] Cliente ${clienteId} WhatsApp listo`);
      }
    });

    // Evento: Fallo de autenticación
    client.on('auth_failure', (msg) => {
      console.error(`❌ [session-manager] Fallo autenticación cliente ${clienteId}:`, msg);
      const sess = clientSessions.get(clienteId);
      if (sess) {
        sess.ready = false;
        sess.connecting = false;
        // Señal para mostrar QR de nuevo
        sess.qr = null;
      }
    });

    // Evento: Desconectado
    client.on('disconnected', async (reason) => {
      console.log(`⚠️ [session-manager] Cliente ${clienteId} desconectado:`, reason);
      const sess = clientSessions.get(clienteId);
      
      if (sess) {
        sess.ready = false;
        sess.connecting = true;
      }
      
      // IMPORTANTE: NO eliminar tokens, dejar que LocalAuth reconecte
      console.log(`🔄 [session-manager] Intentando reconectar cliente ${clienteId} en 5 segundos...`);
      
      // Esperar 5 segundos y reintentar
      setTimeout(async () => {
        try {
          await client.initialize();
          console.log(`✅ [session-manager] Reconexión iniciada para cliente ${clienteId}`);
        } catch (error) {
          console.error(`❌ [session-manager] Error en reconexión cliente ${clienteId}:`, error.message);
        }
      }, 5000);
    });

    // Inicializar cliente
    client.initialize().catch((error) => {
      console.error(`❌ [session-manager] Error iniciando cliente ${clienteId}:`, error.message);
      const sess = clientSessions.get(clienteId);
      if (sess) {
        sess.ready = false;
        sess.client = null;
        sess.connecting = false;
      }
    });

    // Guardar referencia del cliente
    const sess = clientSessions.get(clienteId);
    if (sess) {
      sess.client = client;
    }
  }
  
  return clientSessions.get(clienteId)?.client;
}

/**
 * Obtener cliente ya existente (sin inicializar)
 */
function getClient(clienteId) {
  return clientSessions.get(clienteId)?.client;
}

/**
 * Obtener estado de la sesión de un cliente
 */
function getSessionState(clienteId) {
  const session = clientSessions.get(clienteId);
  
  if (!session) {
    return {
      state: 'desconectado',
      hasQR: false,
      ready: false,
      connecting: false
    };
  }
  
  return {
    state: session.ready ? 'conectado' : (session.connecting ? 'conectando' : (session.qr ? 'qr' : 'desconectado')),
    hasQR: !!session.qr,
    ready: session.ready,
    connecting: session.connecting
  };
}

/**
 * Obtener QR de un cliente
 */
function getQR(clienteId) {
  return clientSessions.get(clienteId)?.qr;
}

/**
 * Verificar si el cliente está listo
 */
function isReady(clienteId) {
  return clientSessions.get(clienteId)?.ready || false;
}

/**
 * Enviar mensaje para un cliente específico
 */
async function sendMessage(clienteId, phoneNumber, message) {
  const session = clientSessions.get(clienteId);
  
  if (!session || !session.ready || !session.client) {
    throw new Error(`Cliente ${clienteId} WhatsApp no está listo. Estado: ${getSessionState(clienteId).state}`);
  }

  try {
    // whatsapp-web.js requiere formato: 54911XXXXXXXX@c.us
    const formattedNumber = phoneNumber.includes('@c.us') 
      ? phoneNumber 
      : `${phoneNumber}@c.us`;
    
    // whatsapp-web.js usa sendMessage() en vez de sendText()
    await session.client.sendMessage(formattedNumber, message);
    console.log(`✅ [session-manager] Mensaje enviado a ${phoneNumber} desde cliente ${clienteId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ [session-manager] Error enviando mensaje cliente ${clienteId}:`, error.message);
    throw error;
  }
}

/**
 * Desconectar sesión de un cliente
 */
async function disconnect(clienteId) {
  const session = clientSessions.get(clienteId);
  
  try {
    if (session && session.client) {
      console.log(`🔴 [session-manager] Desconectando cliente ${clienteId}...`);
      
      // whatsapp-web.js usa destroy() para cerrar completamente
      try {
        await session.client.logout();
        console.log(`✅ [session-manager] Logout ejecutado para cliente ${clienteId}`);
      } catch (logoutError) {
        console.warn(`⚠️ [session-manager] Error en logout: ${logoutError.message}`);
      }
      
      try {
        await session.client.destroy();
        console.log(`✅ [session-manager] Cliente ${clienteId} destruido`);
      } catch (destroyError) {
        console.warn(`⚠️ [session-manager] Error destruyendo cliente: ${destroyError.message}`);
      }
      
      // Eliminar tokens guardados por LocalAuth
      const sessionName = session.sessionName || `client_${clienteId}`;
      const tokensPath = path.join(__dirname, '../../../tokens', `.wwebjs_auth/session-${sessionName}`);
      
      if (fs.existsSync(tokensPath)) {
        try {
          fs.rmSync(tokensPath, { recursive: true, force: true });
          console.log(`🗑️ [session-manager] Tokens LocalAuth eliminados para cliente ${clienteId}`);
        } catch (fsError) {
          console.warn(`⚠️ [session-manager] Error eliminando tokens: ${fsError.message}`);
        }
      }
    }
    
    // Eliminar de memoria
    clientSessions.delete(clienteId);
    console.log(`✅ [session-manager] Cliente ${clienteId} desconectado completamente`);
    
    return { success: true, message: 'Desconectado correctamente' };
  } catch (error) {
    console.error(`❌ [session-manager] Error al desconectar cliente ${clienteId}:`, error.message);
    // Forzar eliminación aunque falle
    clientSessions.delete(clienteId);
    throw error;
  }
}

/**
 * Limpiar tokens corruptos para un cliente
 */
function cleanTokens(clienteId) {
  const sessionName = `client_${clienteId}`;
  const tokenPath = path.join(__dirname, '../../../tokens', `.wwebjs_auth/session-${sessionName}`);
  const cachePath = path.join(__dirname, '../../../tokens', `.wwebjs_cache/session-${sessionName}`);
  
  try {
    if (fs.existsSync(tokenPath)) {
      fs.rmSync(tokenPath, { recursive: true, force: true });
      console.log(`🗑️ [session-manager] Tokens eliminados: ${tokenPath}`);
    }
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
      console.log(`🗑️ [session-manager] Cache eliminado: ${cachePath}`);
    }
  } catch (error) {
    console.error(`❌ [session-manager] Error limpiando tokens para cliente ${clienteId}:`, error.message);
  }
}

/**
 * Obtener todas las sesiones activas
 */
function getAllSessions() {
  const sessions = [];
  clientSessions.forEach((session, clienteId) => {
    sessions.push({
      clienteId,
      sessionName: session.sessionName,
      state: getSessionState(clienteId)
    });
  });
  return sessions;
}

module.exports = {
  getOrCreateClient,
  getClient,
  getSessionState,
  getQR,
  isReady,
  sendMessage,
  disconnect,
  cleanTokens,
  getAllSessions,
  loadExistingSessions
};
