/**
 * Stub del Session Manager para tests de integración
 * 
 * Propósito:
 * - Mockear sessionManagerClient sin dependencia de WhatsApp real
 * - Simular respuestas exitosas/fallidas programáticamente
 * - Rastrear llamadas para verificación en asserts
 * 
 * Uso:
 * ```javascript
 * const stub = require('./tests/stubs/sessionManagerStub');
 * 
 * beforeEach(() => {
 *   stub.reset();
 *   stub.setStatusResponse({ status: 'READY', connected: true });
 * });
 * 
 * // El código bajo test usa sessionManagerClient normalmente
 * await sessionManagerClient.getStatus(); // → retorna stub
 * ```
 */

class SessionManagerStub {
  constructor() {
    // Guardar referencia al método original sendMessage
    this._originalSendMessage = this.sendMessage.bind(this);
    this._originalGetStatus = this.getStatus.bind(this);
    this.reset();
  }

  reset() {
    // Estado del stub
    this._statusResponse = { status: 'READY', connected: true };
    this._sendMessageBehavior = 'success'; // 'success' | 'error' | 'timeout'
    this._sendMessageError = null;

    // Rastreo de llamadas
    this.calls = {
      getStatus: [],
      sendMessage: []
    };

    // Contador de mensajes enviados
    this.messagesSent = 0;
    
    // Restaurar métodos originales (en caso de sobrescritura en tests)
    this.sendMessage = this._originalSendMessage;
    this.getStatus = this._originalGetStatus;
  }

  /* ==================
     CONFIGURACIÓN
     ================== */

  /**
   * Configura la respuesta de getStatus()
   * @param {Object} response - { status: 'READY'|'DISCONNECTED', connected: boolean }
   */
  setStatusResponse(response) {
    this._statusResponse = response;
  }

  /**
   * Configura el comportamiento de sendMessage()
   * @param {string} behavior - 'success' | 'error' | 'timeout'
   * @param {Error} error - Error opcional para comportamiento 'error'
   */
  setSendMessageBehavior(behavior, error = null) {
    this._sendMessageBehavior = behavior;
    this._sendMessageError = error;
  }

  /* ==================
     API STUB
     ================== */

  async getStatus() {
    const callTime = Date.now();
    this.calls.getStatus.push({ timestamp: callTime });

    // Simular delay de red
    await this._delay(10);

    return { ...this._statusResponse };
  }

  async sendMessage({ cliente_id, to, message }) {
    const callTime = Date.now();
    this.calls.sendMessage.push({
      timestamp: callTime,
      cliente_id,
      to,
      message
    });

    // Simular delay de red
    await this._delay(50);

    // Comportamientos programables
    if (this._sendMessageBehavior === 'timeout') {
      throw new Error('TIMEOUT: Session Manager no respondió');
    }

    if (this._sendMessageBehavior === 'error') {
      const error = this._sendMessageError || new Error('Error simulado en sendMessage');
      throw error;
    }

    // Comportamiento exitoso por defecto
    this.messagesSent++;
    return {
      success: true,
      message_id: `msg_stub_${this.messagesSent}_${Date.now()}`,
      cliente_id,
      to,
      timestamp: new Date().toISOString()
    };
  }

  /* ==================
     UTILIDADES
     ================== */

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtiene el número de mensajes enviados a un destinatario específico
   * @param {string} to - Número de teléfono (ej: '5491112345678@c.us')
   * @returns {number}
   */
  getMessagesSentTo(to) {
    return this.calls.sendMessage.filter((call) => call.to === to).length;
  }

  /**
   * Verifica si se envió un mensaje con contenido específico
   * @param {string} message - Contenido del mensaje
   * @returns {boolean}
   */
  wasMessageSent(message) {
    return this.calls.sendMessage.some((call) => call.message === message);
  }

  /**
   * Obtiene todas las llamadas a sendMessage en orden cronológico
   * @returns {Array}
   */
  getSendMessageCalls() {
    return [...this.calls.sendMessage];
  }
}

// Singleton
const instance = new SessionManagerStub();

module.exports = instance;
