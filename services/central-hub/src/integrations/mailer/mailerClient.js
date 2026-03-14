/**
 * Cliente HTTP para leadmaster-mailer
 *
 * Responsabilidades:
 * - Verificar salud del servicio (/health)
 * - Enviar emails vía HTTP (/send)
 *
 * NO implementa:
 * - Retries automáticos
 * - Lógica SMTP (per-tenant) -> pertenece a leadmaster-mailer
 */

const {
  MailerUnreachableError,
  MailerTimeoutError,
  MailerInvalidConfigError,
  MailerHttpError
} = require('./errors');

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return i;
}

class MailerClient {
  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };

    // Timeout default (puede sobrescribirse por env)
    this.defaultTimeoutMs = 10000;
  }

  _getBaseUrl() {
    let baseUrl = process.env.MAILER_BASE_URL;

    // En tests, permitir default sin forzar config.
    if (!baseUrl && process.env.NODE_ENV === 'test') {
      baseUrl = 'http://localhost:3005';
    }

    if (!baseUrl) {
      throw new MailerInvalidConfigError(
        'MAILER_BASE_URL no está definida en las variables de entorno'
      );
    }

    try {
      const url = new URL(baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('El protocolo debe ser http o https');
      }
      return baseUrl.replace(/\/$/, '');
    } catch (error) {
      throw new MailerInvalidConfigError(
        `MAILER_BASE_URL no es una URL válida: ${baseUrl}`,
        error
      );
    }
  }

  _getTimeoutMs() {
    const fromEnv = parsePositiveInt(process.env.MAILER_TIMEOUT_MS);
    return fromEnv || this.defaultTimeoutMs;
  }

  async _readJsonSafe(response) {
    let text;
    try {
      text = await response.text();
    } catch (_err) {
      return undefined;
    }

    if (!text || text.trim() === '') return undefined;

    try {
      return JSON.parse(text);
    } catch (_err) {
      return { raw: text };
    }
  }

  async _fetchWithTimeout(path, options = {}, timeout = this._getTimeoutMs()) {
    const baseUrl = this._getBaseUrl();
    const url = `${baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.defaultHeaders,
          ...options.headers
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error && error.name === 'AbortError') {
        throw new MailerTimeoutError(
          `Timeout al conectar con Mailer (${timeout}ms)`
        );
      }

      if (
        error?.cause?.code === 'ECONNREFUSED' ||
        error?.cause?.code === 'ENOTFOUND' ||
        (typeof error?.message === 'string' && error.message.includes('fetch failed'))
      ) {
        throw new MailerUnreachableError(
          `No se pudo conectar con Mailer en ${url}`,
          error
        );
      }

      throw new MailerUnreachableError(
        `Error de red al conectar con Mailer: ${error?.message || 'unknown error'}`,
        error
      );
    }
  }

  /**
   * GET /health
   */
  async health() {
    const response = await this._fetchWithTimeout('/health', {
      method: 'GET'
    });

    const body = await this._readJsonSafe(response);

    if (response.ok) return body;

    throw new MailerHttpError({
      message: `Mailer respondió con status ${response.status} en /health`,
      status: response.status,
      body
    });
  }

  /**
   * POST /send
   * @param {Object} payload - Debe incluir cliente_id y el contrato del mailer
   */
  async sendEmail(payload) {
    const response = await this._fetchWithTimeout('/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const body = await this._readJsonSafe(response);

    if (response.ok) return body;

    throw new MailerHttpError({
      message: `Mailer respondió con status ${response.status} en /send`,
      status: response.status,
      body
    });
  }
}

module.exports = new MailerClient();
