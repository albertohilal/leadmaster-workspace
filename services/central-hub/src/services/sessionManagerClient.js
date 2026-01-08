/**
 * @deprecated DUPLICATE CLIENT - VIOLATES SESSION_MANAGER_API_CONTRACT
 * 
 * Este archivo es un cliente duplicado que debe ser eliminado.
 * 
 * REEMPLAZO OFICIAL: src/integrations/sessionManager/sessionManagerClient.js
 * 
 * El contrato establece que debe existir EXACTAMENTE UN cliente para
 * interactuar con Session Manager.
 * 
 * MIGRACIÓN:
 * Cambiar:
 *   const sessionManagerClient = require('../services/sessionManagerClient');
 * 
 * Por:
 *   const { sessionManagerClient } = require('../integrations/sessionManager');
 * 
 * ESTADO: Marcado para eliminación. NO USAR.
 */

module.exports = {
  __deprecated: true,
  __replacement: 'src/integrations/sessionManager/sessionManagerClient.js',
  __error: 'Este cliente está deprecado. Usa el cliente oficial del contrato.'
};

throw new Error(
  'DEPRECATED CLIENT: Este archivo viola el contrato Session Manager. ' +
  'Usa: require("../integrations/sessionManager").sessionManagerClient'
);

// Environment validation
const SESSION_MANAGER_BASE_URL = process.env.SESSION_MANAGER_BASE_URL;

if (!SESSION_MANAGER_BASE_URL) {
  console.error('[FATAL] SESSION_MANAGER_BASE_URL environment variable is required');
  console.error('[FATAL] Example: SESSION_MANAGER_BASE_URL=http://localhost:3001');
  process.exit(1);
}

// Validate URL format
let baseUrl;
try {
  baseUrl = new URL(SESSION_MANAGER_BASE_URL);
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('Invalid protocol. Must be http: or https:');
  }
} catch (error) {
  console.error('[FATAL] Invalid SESSION_MANAGER_BASE_URL:', error.message);
  process.exit(1);
}

console.log(`[session-manager-client] Configured to use: ${SESSION_MANAGER_BASE_URL}`);

// Timeouts (milliseconds)
const CONNECT_TIMEOUT = 5000;  // 5 seconds
const READ_TIMEOUT = 30000;    // 30 seconds

/**
 * Make HTTP request to session-manager
 * @param {string} method - HTTP method
 * @param {string} path - Endpoint path
 * @param {number} clienteId - Cliente ID for X-Cliente-Id header
 * @param {Object} body - Request body (optional)
 * @returns {Promise<Object>} Response data
 */
async function makeRequest(method, path, clienteId, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'X-Cliente-Id': String(clienteId)
      },
      timeout: CONNECT_TIMEOUT
    };

    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = httpModule.request(options, (res) => {
      let data = '';

      // Set read timeout
      res.setTimeout(READ_TIMEOUT, () => {
        req.destroy();
        reject(new Error('SESSION_MANAGER_TIMEOUT: Read timeout exceeded'));
      });

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            // Propagate error from session-manager
            const error = new Error(parsed.message || 'Session manager error');
            error.statusCode = res.statusCode;
            error.code = parsed.code;
            error.response = parsed;
            reject(error);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
        }
      });
    });

    // Connection timeout
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('SESSION_MANAGER_TIMEOUT: Connection timeout'));
    });

    // Network errors
    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        reject(new Error('SESSION_MANAGER_UNREACHABLE: Connection refused'));
      } else {
        reject(new Error(`SESSION_MANAGER_ERROR: ${error.message}`));
      }
    });

    // Send body if present
    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * GET /health
 * Check if session-manager service is available
 * @param {number} clienteId - Cliente ID
 * @returns {Promise<Object>} Health status
 */
async function getHealth(clienteId) {
  return makeRequest('GET', '/health', clienteId);
}

/**
 * GET /status
 * Get WhatsApp session status for a client
 * @param {number} clienteId - Cliente ID
 * @returns {Promise<Object>} Session status
 */
async function getStatus(clienteId) {
  return makeRequest('GET', '/status', clienteId);
}

/**
 * GET /qr
 * Get WhatsApp QR code for a client
 * @param {number} clienteId - Cliente ID
 * @returns {Promise<Object>} QR code data (qr string or base64 image)
 */
async function getQR(clienteId) {
  return makeRequest('GET', '/qr', clienteId);
}

/**
 * POST /send
 * Send a WhatsApp message
 * @param {number} clienteId - Cliente ID
 * @param {string} to - Phone number (with country code)
 * @param {string} message - Message text
 * @returns {Promise<Object>} Send result with message_id
 */
async function sendMessage(clienteId, to, message) {
  const body = {
    cliente_id: clienteId,
    to,
    message
  };
  return makeRequest('POST', '/send', clienteId, body);
}

/**
 * GET /qr-code
 * Obtiene el código QR ya generado (read-only)
 * @param {number} clienteId - Cliente ID
 * @returns {Promise<Object>} { qr: "data:image/png;base64,..." }
 */
async function getQRCode(clienteId) {
  return makeRequest('GET', '/qr-code', clienteId);
}

module.exports = {
  getHealth,
  getStatus,
  getQR,
  sendMessage,
  getQRCode,
  SESSION_MANAGER_BASE_URL
};
