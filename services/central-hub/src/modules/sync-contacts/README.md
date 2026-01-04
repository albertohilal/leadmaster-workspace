# Módulo de Sincronización de Contactos con Gmail

## Objetivo
Mantener sincronizados los contactos de cada cliente (ej: Haby) desde `llxbx_societe` hacia Gmail Contacts, para que aparezcan los nombres en WhatsApp Business.

## Arquitectura

```
Base de Datos (llxbx_societe) 
    ↓
Sync Service (Node.js)
    ↓
Google People API (Gmail Contacts)
    ↓
WhatsApp Business (móvil del cliente)
```

## Flujo de Sincronización

1. **Detección de Cambios**: Monitorea `llxbx_societe` filtrado por `cliente_id`
2. **Comparación**: Identifica nuevos contactos, actualizados o eliminados
3. **Sync Gmail**: Usa Google People API para aplicar cambios
4. **Log**: Registra todas las operaciones en `ll_sync_contactos_log`

## Configuración Requerida

### 1. Google Cloud Console
- Crear proyecto en https://console.cloud.google.com
- Habilitar "Google People API"
- Crear credenciales OAuth 2.0
- Agregar scope: `https://www.googleapis.com/auth/contacts`

### 2. Variables de Entorno (.env)
```
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_secret
GOOGLE_REDIRECT_URI=http://localhost:3012/sync-contacts/callback
```

### 3. Tabla de Control (crear en BD)
```sql
CREATE TABLE ll_sync_contactos_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  accion VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  societe_id INT NOT NULL,
  google_resource_name VARCHAR(255),
  fecha_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(50), -- 'success', 'error'
  mensaje TEXT,
  INDEX idx_cliente (cliente_id),
  INDEX idx_societe (societe_id)
);

CREATE TABLE ll_cliente_google_tokens (
  cliente_id INT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date BIGINT,
  fecha_autorizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Modos de Sincronización

### A. Manual (On-Demand)
- Endpoint: `POST /sync-contacts/sync/:cliente_id`
- Sincroniza todos los contactos del cliente ahora mismo

### B. Automática (Scheduled)
- Cron job cada 6 horas
- Solo sincroniza cambios detectados

### C. Webhook (Real-time)
- Trigger en INSERT/UPDATE/DELETE de `llxbx_societe`
- Sincronización inmediata (opcional, requiere MySQL triggers)

## Endpoints API

### 1. Autorizar Cliente
```
GET /sync-contacts/authorize/:cliente_id
→ Redirige a Google OAuth
→ Usuario autoriza acceso a sus contactos Gmail
→ Guarda tokens en ll_cliente_google_tokens
```

### 2. Sincronizar Manual
```
POST /sync-contacts/sync/:cliente_id
→ Sincroniza todos los contactos del cliente
→ Retorna: { added: 10, updated: 5, deleted: 2, errors: 0 }
```

### 3. Ver Estado
```
GET /sync-contacts/status/:cliente_id
→ Última sync, cantidad de contactos, próxima sync programada
```

### 4. Historial
```
GET /sync-contacts/log/:cliente_id?limit=50
→ Historial de sincronizaciones
```

## Formato de Contacto

**Desde BD → Gmail:**
```json
{
  "names": [{
    "givenName": "509 Tattoo",
    "familyName": "(Cliente Haby)"
  }],
  "phoneNumbers": [{
    "value": "+5491165028799",
    "type": "mobile"
  }],
  "addresses": [{
    "streetAddress": "Dirección del local",
    "city": "Buenos Aires",
    "formattedValue": "Dirección completa"
  }],
  "organizations": [{
    "name": "Tatuadores - tattoo shop",
    "title": "Tatuajes"
  }],
  "biographies": [{
    "value": "ID Dolibarr: 1047 | Cliente: Haby"
  }]
}
```

## Estrategia de Identificación

Para evitar duplicados, guardamos en `ll_sync_contactos_log`:
- `societe_id` (nuestro ID)
- `google_resource_name` (ID de Google)

Así podemos actualizar/eliminar correctamente.

## Seguridad

- ✅ Cada cliente tiene sus propios tokens OAuth
- ✅ Los tokens se guardan encriptados
- ✅ Solo sincroniza contactos donde `ll_lugares_clientes.cliente_id` coincide
- ✅ Refresh token automático cuando expira access_token

## Uso Típico

### Setup Inicial (por cliente)
1. Cliente visita: `/sync-contacts/authorize/51` (Haby = 51)
2. Autoriza acceso a Gmail
3. Sistema guarda tokens
4. Primera sincronización completa

### Mantenimiento Automático
- Cron job ejecuta sync cada 6 horas
- Solo procesa cambios desde última sync
- Log completo en `ll_sync_contactos_log`

## Monitoreo

```bash
# Ver últimas 10 sincronizaciones de Haby
SELECT * FROM ll_sync_contactos_log 
WHERE cliente_id = 51 
ORDER BY fecha_sync DESC 
LIMIT 10;

# Estadísticas del día
SELECT 
  accion, 
  estado,
  COUNT(*) as cantidad 
FROM ll_sync_contactos_log 
WHERE cliente_id = 51 
  AND DATE(fecha_sync) = CURDATE()
GROUP BY accion, estado;
```

## Limitaciones Google People API

- **Cuota diaria**: 10,000 requests/día (suficiente para 10,000 contactos)
- **Rate limit**: 600 requests/minuto
- **Batch operations**: Hasta 200 contactos por request

## Próximos Pasos

1. Crear tablas en BD
2. Configurar Google Cloud Project
3. Implementar controlador de autorización OAuth
4. Implementar servicio de sincronización
5. Configurar cron job
6. Probar con Haby (cliente_id = 51)
