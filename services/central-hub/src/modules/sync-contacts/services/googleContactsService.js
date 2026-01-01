// sync-contacts/services/googleContactsService.js
const { google } = require('googleapis');
const db = require('../../../config/db');

class GoogleContactsService {
  constructor() {
    this.oauth2Client = null;
    this.people = null;
  }

  /**
   * Inicializar cliente OAuth con tokens del cliente
   */
  async initializeForClient(clienteId) {
    try {
      // Obtener tokens de la BD
      const [rows] = await db.execute(
        'SELECT * FROM ll_cliente_google_tokens WHERE cliente_id = ? AND activo = 1',
        [clienteId]
      );

      if (rows.length === 0) {
        throw new Error('Cliente no ha autorizado acceso a Google Contacts');
      }

      const tokenData = rows[0];

      // Configurar OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      this.oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date
      });

      // Manejar refresh automático del token
      this.oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          await this.updateTokens(clienteId, tokens);
        }
      });

      // Inicializar People API
      this.people = google.people({ version: 'v1', auth: this.oauth2Client });

      return true;
    } catch (error) {
      console.error('Error inicializando Google Contacts:', error);
      throw error;
    }
  }

  /**
   * Actualizar tokens en BD
   */
  async updateTokens(clienteId, tokens) {
    const updates = [];
    const params = [];

    if (tokens.access_token) {
      updates.push('access_token = ?');
      params.push(tokens.access_token);
    }
    if (tokens.refresh_token) {
      updates.push('refresh_token = ?');
      params.push(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      updates.push('expiry_date = ?');
      params.push(tokens.expiry_date);
    }

    params.push(clienteId);

    await db.execute(
      `UPDATE ll_cliente_google_tokens SET ${updates.join(', ')} WHERE cliente_id = ?`,
      params
    );
  }

  /**
   * Crear contacto en Google
   */
  async createContact(contactData, clienteId) {
    try {
      const person = this.buildPersonResource(contactData);
      
      const response = await this.people.people.createContact({
        requestBody: person
      });

      // Guardar mapping
      await this.saveMapping(clienteId, contactData.societe_id, response.data.resourceName, response.data.etag);

      // Log
      await this.logSync(clienteId, 'create', contactData.societe_id, response.data.resourceName, 'success', null);

      return response.data;
    } catch (error) {
      await this.logSync(clienteId, 'create', contactData.societe_id, null, 'error', error.message);
      throw error;
    }
  }

  /**
   * Actualizar contacto en Google
   */
  async updateContact(resourceName, contactData, clienteId) {
    try {
      // Obtener contacto actual para el etag
      const currentContact = await this.people.people.get({
        resourceName: resourceName,
        personFields: 'names,phoneNumbers,addresses,organizations,biographies'
      });

      const person = this.buildPersonResource(contactData);
      person.etag = currentContact.data.etag; // Requerido para updates

      const response = await this.people.people.updateContact({
        resourceName: resourceName,
        updatePersonFields: 'names,phoneNumbers,addresses,organizations,biographies',
        requestBody: person
      });

      // Actualizar mapping
      await this.updateMapping(clienteId, contactData.societe_id, response.data.etag);

      // Log
      await this.logSync(clienteId, 'update', contactData.societe_id, resourceName, 'success', null);

      return response.data;
    } catch (error) {
      await this.logSync(clienteId, 'update', contactData.societe_id, resourceName, 'error', error.message);
      throw error;
    }
  }

  /**
   * Eliminar contacto de Google
   */
  async deleteContact(resourceName, clienteId, societeId) {
    try {
      await this.people.people.deleteContact({
        resourceName: resourceName
      });

      // Eliminar mapping
      await this.deleteMapping(clienteId, societeId);

      // Log
      await this.logSync(clienteId, 'delete', societeId, resourceName, 'success', null);

      return true;
    } catch (error) {
      await this.logSync(clienteId, 'delete', societeId, resourceName, 'error', error.message);
      throw error;
    }
  }

  /**
   * Construir recurso Person para Google API
   */
  buildPersonResource(contactData) {
    const person = {
      names: [{
        givenName: contactData.nombre || 'Sin nombre',
        familyName: contactData.prefijo ? `(${contactData.prefijo})` : ''
      }],
      phoneNumbers: [{
        value: this.formatPhoneNumber(contactData.telefono),
        type: 'mobile'
      }]
    };

    // Agregar dirección si existe
    if (contactData.direccion || contactData.ciudad) {
      person.addresses = [{
        streetAddress: contactData.direccion || '',
        city: contactData.ciudad || '',
        formattedValue: [contactData.direccion, contactData.ciudad].filter(Boolean).join(', ')
      }];
    }

    // Agregar rubro/área como organización
    if (contactData.rubro) {
      person.organizations = [{
        name: contactData.rubro,
        title: contactData.area_rubro || ''
      }];
    }

    // Agregar metadata en biografía
    person.biographies = [{
      value: `ID: ${contactData.societe_id} | Cliente: ${contactData.cliente_nombre || ''}`,
      contentType: 'TEXT_PLAIN'
    }];

    return person;
  }

  /**
   * Formatear número de teléfono para WhatsApp
   */
  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Si ya tiene +, retornar
    if (phone.startsWith('+')) return phone;
    
    // Si empieza con 549, agregar +
    if (phone.startsWith('549')) return '+' + phone;
    
    // Asumir Argentina si no tiene código
    return '+549' + phone.replace(/^0+/, '');
  }

  /**
   * Guardar mapping en BD
   */
  async saveMapping(clienteId, societeId, resourceName, etag) {
    await db.execute(
      `INSERT INTO ll_sync_contactos_mapping 
       (cliente_id, societe_id, google_resource_name, google_etag) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       google_resource_name = VALUES(google_resource_name),
       google_etag = VALUES(google_etag)`,
      [clienteId, societeId, resourceName, etag]
    );
  }

  /**
   * Actualizar mapping en BD
   */
  async updateMapping(clienteId, societeId, etag) {
    await db.execute(
      `UPDATE ll_sync_contactos_mapping 
       SET google_etag = ?, fecha_actualizacion = NOW()
       WHERE cliente_id = ? AND societe_id = ?`,
      [etag, clienteId, societeId]
    );
  }

  /**
   * Eliminar mapping de BD
   */
  async deleteMapping(clienteId, societeId) {
    await db.execute(
      'DELETE FROM ll_sync_contactos_mapping WHERE cliente_id = ? AND societe_id = ?',
      [clienteId, societeId]
    );
  }

  /**
   * Obtener mapping de un contacto
   */
  async getMapping(clienteId, societeId) {
    const [rows] = await db.execute(
      'SELECT * FROM ll_sync_contactos_mapping WHERE cliente_id = ? AND societe_id = ?',
      [clienteId, societeId]
    );
    return rows[0] || null;
  }

  /**
   * Registrar operación en log
   */
  async logSync(clienteId, accion, societeId, resourceName, estado, mensaje) {
    await db.execute(
      `INSERT INTO ll_sync_contactos_log 
       (cliente_id, accion, societe_id, google_resource_name, estado, mensaje) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clienteId, accion, societeId, resourceName, estado, mensaje]
    );
  }

  /**
   * Obtener URL de autorización OAuth
   */
  static getAuthUrl(clienteId) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
      'https://www.googleapis.com/auth/contacts'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: clienteId.toString(), // Pasamos cliente_id en state
      prompt: 'consent' // Forzar consent para obtener refresh_token
    });
  }

  /**
   * Procesar callback de OAuth
   */
  static async handleOAuthCallback(code, clienteId) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Guardar tokens en BD
    await db.execute(
      `INSERT INTO ll_cliente_google_tokens 
       (cliente_id, access_token, refresh_token, token_type, expiry_date, scope) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token),
       refresh_token = VALUES(refresh_token),
       expiry_date = VALUES(expiry_date),
       activo = 1`,
      [
        clienteId,
        tokens.access_token,
        tokens.refresh_token,
        tokens.token_type || 'Bearer',
        tokens.expiry_date,
        tokens.scope
      ]
    );

    return tokens;
  }
}

module.exports = GoogleContactsService;
