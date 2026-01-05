Contrato técnico
Session Manager ↔ Central Hub (API estable)
Rol de cada componente

Session Manager

Única autoridad sobre:

Estado de sesiones WhatsApp

Ciclo de vida del QR

Vinculación instance_id ↔ sesión

Persiste en ll_whatsapp_qr_sessions

Expone estados declarativos, no interpretativos

Central Hub

NO decide estados

NO infiere

NO cachea con autoridad

Consume el estado y reacciona

Entidad central: WhatsAppSession
WhatsAppSession {
  id: number
  instance_id: string
  phone_number: string | null

  status: SessionStatus
  qr_status: QRStatus

  qr_string: string | null
  qr_generated_at: datetime | null
  qr_expires_at: datetime | null

  connected_at: datetime | null
  disconnected_at: datetime | null

  last_error_code: string | null
  last_error_message: string | null

  created_at: datetime
  updated_at: datetime
}

Enumeraciones oficiales (congeladas)
SessionStatus
enum SessionStatus {
  INIT = 'init',                 // sesión creada, sin QR aún
  QR_REQUIRED = 'qr_required',   // necesita escaneo
  CONNECTING = 'connecting',     // QR escaneado, handshake
  CONNECTED = 'connected',       // sesión activa
  DISCONNECTED = 'disconnected', // desconexión normal
  ERROR = 'error'                // error irrecuperable
}

QRStatus
enum QRStatus {
  NONE = 'none',          // no aplica
  GENERATED = 'generated',// QR vigente
  EXPIRED = 'expired',    // QR vencido
  USED = 'used'           // QR escaneado
}


⚠️ Regla dura:
Central Hub NO traduce estos estados a otros nombres.

Endpoints públicos del Session Manager
1️⃣ Obtener estado de sesión
GET /api/session-manager/sessions/:instance_id


Response 200

{
  "instance_id": "sender_51",
  "status": "qr_required",
  "qr_status": "generated",
  "qr_string": "data:image/png;base64,...",
  "qr_expires_at": "2026-01-04T12:34:56Z"
}


Errores

404 SESSION_NOT_FOUND

500 SESSION_MANAGER_ERROR

2️⃣ Solicitar generación de QR
POST /api/session-manager/sessions/:instance_id/qr


Semántica

Idempotente

Si hay QR válido → lo devuelve

Si está expirado → genera nuevo

Si está conectado → error lógico

Response 200

{
  "qr_string": "data:image/png;base64,...",
  "qr_expires_at": "2026-01-04T12:34:56Z"
}


Errores

409 SESSION_ALREADY_CONNECTED

500 QR_GENERATION_FAILED

3️⃣ Registrar evento de conexión (interno)
POST /api/session-manager/internal/events/connected

{
  "instance_id": "sender_51",
  "phone_number": "+54911XXXXXXX"
}

4️⃣ Registrar desconexión
POST /api/session-manager/internal/events/disconnected

{
  "instance_id": "sender_51",
  "reason": "LOGOUT | NETWORK | TIMEOUT | UNKNOWN"
}

Reglas contractuales innegociables
Central Hub DEBE

Consumir status y qr_status tal cual vienen

Tratar qr_expires_at como fuente única de vencimiento

Reaccionar por estado (no por suposiciones)

Central Hub NO PUEDE

Generar QR por su cuenta

Decidir si un QR “sirve”

Mantener estados paralelos

Reintentar fuera del contrato

Tabla de reacción esperada (Central Hub)
status	Acción permitida en Central Hub
init	Solicitar QR
qr_required	Mostrar QR
connecting	Esperar
connected	Habilitar envío
disconnected	Bloquear envío
error	Bloquear + alertar
Qué queda cerrado con este paso

✔ Contrato estable
✔ Estados congelados
✔ Responsabilidades claras
✔ Sin ambigüedad semántica

A partir de aquí:

no se vuelve a discutir arquitectura

solo se implementa consumo