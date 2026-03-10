# Phase 4B — Email Prospecting Channel

**Status:** APPROVED  
**Date:** 2026-03-10  
**Owner:** Alberto Hilal  
**Approved by:** Alberto Hilal  
**Approved on:** 2026-03-10  
**Workspace:** LeadMaster  
**Depends on:** Phase 2 completed / Phase 3 planned / Contratos HTTP multi-cliente / ADR-001

---

## 1. Objetivo

Incorporar formalmente un canal de prospección por email dentro de LeadMaster, manteniendo la lógica comercial central del sistema:

1. detectar leads
2. abrir contacto
3. clasificar interés
4. derivar solo leads con interés validado

El objetivo de esta etapa no es “mandar emails” en abstracto, sino construir un canal operativo de apertura comercial alineado con la propuesta de valor de LeadMaster.

---

## 2. Justificación de la etapa

Phase 3 del proyecto está centrada en **WhatsApp Session Lifecycle** y deja fuera de alcance el envío/recepción de mensajes y campañas. Las fases futuras ya contemplan el bloque “Message sending/receiving + Campaigns”, pero todavía sin separar el canal email de la lógica WhatsApp-first.

La incorporación de clientes que requieren apertura comercial por correo obliga a abrir una etapa específica para documentar y construir este nuevo canal.

Esta fase representa el pasaje de:

- **LeadMaster como sistema principalmente orientado a WhatsApp**
  
a

- **LeadMaster como plataforma multicanal de prospección y derivación**

---

## 3. Alcance

### Incluido en esta fase
- definición funcional del canal email
- modelo de operación LeadMaster-first
- definición de ownership sobre base, inbox y derivación
- definición del servicio `mailer`
- contratos HTTP iniciales del canal email
- integración conceptual con `central-hub`
- requisitos mínimos para clientes que usen email
- modelado de landing como parte del sistema
- estados operativos básicos del lead por email
- primer plan técnico de implementación

### No incluido en esta fase
- automatización avanzada de aperturas/clicks
- scoring predictivo
- enriquecimiento automático por IA
- campañas masivas complejas con colas avanzadas
- UI final de analytics completa
- entregabilidad avanzada enterprise
- secuencias multistep sofisticadas
- integración con Meta, LinkedIn o CRM externos más allá del mínimo necesario

---

## 4. Problema que resuelve

Sin esta fase, el proyecto corre el riesgo de resolver email de forma improvisada:

- como un parche dentro de `sender`
- como una copia pobre del flujo WhatsApp
- como un simple “mail marketing”
- o como una cesión temprana del canal completo al cliente

Esta fase ordena el problema antes de la implementación.

---

## 5. Modelo operativo adoptado

### 5.1 Base de leads
La base de leads utilizada para prospección inicial es obtenida y/o procesada por LeadMaster, principalmente mediante `desarrolloydisenio-api`.

### 5.2 Primer contacto
LeadMaster opera el primer contacto por email.

### 5.3 Recepción
Las respuestas iniciales se reciben en un inbox bajo control operativo de LeadMaster o en una configuración equivalente que preserve ese control.

### 5.4 Clasificación
LeadMaster clasifica las respuestas e identifica señales de interés.

### 5.5 Derivación
Solo se derivan al cliente los leads o conversaciones que alcanzan estado de interés suficiente.

---

## 6. Principios de diseño

1. **Email no es una copia exacta de WhatsApp.**
2. **La decisión de derivación pertenece al negocio, no al canal.**
3. **La base operativa inicial no se entrega cruda por defecto al cliente.**
4. **Identidad de marca e inbox son conceptos distintos.**
5. **Landing e identidad de envío son componentes funcionales del sistema.**
6. **Todo flujo debe respetar multi-tenant con `cliente_id`.**
7. **El código futuro debe seguir contratos documentados, no redefinirlos a conveniencia.**

---

## 7. Arquitectura objetivo (alto nivel)

### 7.1 Componentes
- `desarrolloydisenio-api` → obtención / segmentación de leads
- `central-hub` → autenticación, contexto de cliente, orquestación
- `mailer` → entrega de correo e interfaz HTTP del canal email
- landing / sitio / subdominio de campaña
- dashboard / vista operativa futura

### 7.2 Patrón de integración
Se replica el patrón ya usado con `session-manager`:

- servicio desacoplado
- contratos HTTP/JSON
- `cliente_id` obligatorio
- límites claros de responsabilidad
- hub como orquestador

### 7.3 Separación de responsabilidades
**Central Hub**
- autentica
- resuelve `req.cliente_id`
- valida payload
- registra interacción
- decide flujos de negocio
- llama al servicio mailer

**Mailer**
- valida request técnico
- envía correo
- devuelve resultado de entrega
- tipifica errores técnicos

**Cliente final**
- recibe leads derivados
- no opera necesariamente el inbox inicial

---

## 8. Requisitos funcionales

### 8.1 Envío mínimo
El sistema debe permitir enviar un email individual de prospección asociado a un `cliente_id`.

### 8.2 Identidad de envío
Cada cliente debe poder tener al menos una identidad de envío definida:

- nombre visible
- dirección remitente
- reply-to
- firma básica

### 8.3 Registro operativo
Cada envío debe quedar registrado con al menos:

- `cliente_id`
- destinatario
- asunto
- fecha/hora
- estado
- error técnico si aplica

### 8.4 Recepción y clasificación
El sistema debe poder asociar una respuesta inicial a un lead/contacto y moverlo a un estado comercial.

### 8.5 Derivación
Debe existir un criterio explícito para marcar un lead como derivable.

---

## 9. Estados sugeridos del flujo email

Estados mínimos propuestos:

- `LEAD_DETECTADO`
- `EMAIL_PENDIENTE`
- `EMAIL_ENVIADO`
- `RESPUESTA_RECIBIDA`
- `INTERES_DETECTADO`
- `DERIVADO_AL_CLIENTE`
- `DESCARTADO`

### Regla clave
`EMAIL_ENVIADO` no implica interés  
`RESPUESTA_RECIBIDA` no implica derivación  
`INTERES_DETECTADO` habilita evaluación de derivación

---

## 10. Requisitos técnicos mínimos

### 10.1 Contrato
Nuevo documento de contrato:
- `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`

### 10.2 Servicio mailer
Nueva unidad técnica sugerida:
- `services/mailer`

### 10.3 Endpoints mínimos
- `GET /health`
- `POST /send`

Posibles futuros:
- `POST /incoming-email`
- `GET /message-status/:id`

### 10.4 Multi-tenant
Todo request debe incluir `cliente_id`.

### 10.5 Persistencia
Debe existir tabla o estructura equivalente para registrar envíos email.

---

## 11. Requisitos comerciales mínimos para clientes

Para activar el canal email con un cliente, deben cumplirse condiciones mínimas:

### Marca / oferta
- oferta inicial definida
- segmento claro
- propuesta coherente

### Infraestructura
- identidad de envío definida
- acceso técnico a DNS o coordinación con técnico del cliente, si aplica
- landing disponible o a desarrollar

### Operación
- aceptación del modelo de derivación selectiva
- aceptación de que LeadMaster opera el primer contacto
- aceptación de que el cliente no recibe automáticamente la base bruta

---

## 12. Riesgos principales

### Riesgo 1 — Mala entregabilidad
**Mitigación**
- exigir identidad y configuración técnica mínima
- no permitir campañas improvisadas
- arrancar con volumen controlado

### Riesgo 2 — Pérdida del control del embudo
**Mitigación**
- no ceder inbox completo desde el inicio
- documentar claramente ownership y derivación

### Riesgo 3 — Confusión conceptual con WhatsApp
**Mitigación**
- documentar email como canal de apertura
- mantener estados propios
- no mezclar prematuramente la lógica conversacional

### Riesgo 4 — Cliente no apto
**Mitigación**
- definir requisitos mínimos de entrada
- rechazar implementaciones sin condiciones mínimas

---

## 13. Entregables documentales de la fase

### Documentos núcleo
- `docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md`
- `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`

### Documentos siguientes
- `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
- `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`
- `docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md`

---

## 14. Criterios de éxito de la fase

La fase se considera correctamente establecida cuando:

- existe decisión constitucional aprobada
- existe plan de etapa aprobado
- existe arquitectura funcional del canal email
- existe contrato HTTP inicial del mailer
- existe documento de requisitos mínimos para clientes
- queda definido que LeadMaster controla primer contacto y derivación selectiva
- queda definido el vínculo entre base propia, landing y canal email

---

## 15. Próximos pasos recomendados

1. (Completado) ADR-001 aprobado
2. (Completado) Plan Phase 4B aprobado
3. Redactar `ARQUITECTURA-CANAL-EMAIL.md`
4. Redactar `Contratos-HTTP-Mailer.md`
5. Redactar `REQUISITOS-MINIMOS-CANAL-EMAIL.md`
6. Recién después pasar a diseño técnico de implementación

---

## 16. Nota final

Esta fase no implementa todavía el servicio mailer.

Su función es dejar correctamente fijados:

- el alcance
- la lógica operativa
- la protección del activo de LeadMaster
- la relación con el cliente
- la transición hacia arquitectura multicanal
