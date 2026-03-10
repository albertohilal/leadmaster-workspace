
## 3) `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`

````md
# Arquitectura del Canal Email — LeadMaster

**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-03-10  
**Owner:** Alberto Hilal  
**Depends on:** ADR-001 / Phase 4B — Email Prospecting Channel

---

## 1. Objetivo

Definir la arquitectura funcional del canal email dentro de LeadMaster, preservando la lógica central del sistema:

1. detectar leads
2. abrir contacto
3. clasificar interés
4. derivar solo cuando exista señal suficiente de interés

Este documento define arquitectura de integración, responsabilidades y límites operativos.

No define todavía implementación final de proveedor, UI definitiva ni detalle exhaustivo de base de datos.

---

## 2. Principio rector

El canal email no se incorpora para “mandar correos” en abstracto, sino para operar un proceso de prospección controlado por LeadMaster.

La regla general es:

> LeadMaster genera o controla la base operativa inicial, opera el primer contacto y deriva al cliente únicamente los leads con interés validado.

---

## 3. Alcance arquitectónico

### Incluido
- flujo funcional del canal email
- relación entre base, landing, hub y mailer
- límites entre LeadMaster y cliente final
- responsabilidades por componente
- definición conceptual de inbox, identidad y derivación

### No incluido
- proveedor definitivo de envío
- tracking avanzado de aperturas/clicks
- secuencias automatizadas complejas
- implementación concreta de frontend
- definición SQL final exhaustiva

---

## 4. Componentes principales

### 4.1 `desarrolloydisenio-api`
Responsable de obtención, enriquecimiento o segmentación de leads base.

Función en esta arquitectura:
- generar materia prima de prospección
- aportar segmentación inicial
- alimentar el proceso comercial de LeadMaster

### 4.2 `central-hub`
Responsable de la lógica central de negocio y orquestación.

Función en esta arquitectura:
- autenticar usuario
- determinar `cliente_id`
- validar payload
- decidir flujos de negocio
- registrar estados e interacciones
- invocar al servicio mailer
- aplicar reglas de derivación

### 4.3 `mailer`
Servicio desacoplado para entrega técnica de email.

Función en esta arquitectura:
- exponer interfaz HTTP/JSON
- recibir requests de envío
- enviar correo vía proveedor configurado
- devolver resultado técnico
- tipificar errores de entrega

### 4.4 Landing / Activo web
Activo digital que sostiene legitimidad y conversión del contacto.

Función en esta arquitectura:
- validar identidad de marca
- presentar propuesta
- ampliar información
- servir como destino del CTA
- contribuir a la legitimidad del email

### 4.5 Inbox operativo
Casilla o configuración equivalente donde llegan respuestas iniciales.

Función en esta arquitectura:
- recibir respuestas del lead
- permitir clasificación inicial
- sostener el control del embudo por LeadMaster

### 4.6 Cliente final
Empresa o marca beneficiaria de los leads derivados.

Función en esta arquitectura:
- definir oferta
- aprobar identidad de marca
- recibir leads derivados
- intervenir comercialmente cuando corresponda

---

## 5. Diagrama lógico de alto nivel

```text
desarrolloydisenio-api
        ↓
   Base de leads
        ↓
   LeadMaster / Central Hub
        ├─ valida cliente_id
        ├─ decide contacto
        ├─ registra operación
        ↓
      Mailer
        ↓
 Proveedor de envío
        ↓
      Prospecto
        ↓
 Respuesta / señal de interés
        ↓
 Inbox controlado por LeadMaster
        ↓
 Clasificación / derivación
        ↓
     Cliente final
````

---

## 6. Flujo funcional

### 6.1 Captación

LeadMaster obtiene o prepara la base de leads desde sus propias fuentes y procesos.

### 6.2 Selección

LeadMaster selecciona segmento, campaña o conjunto de prospectos a contactar.

### 6.3 Envío inicial

`central-hub` invoca al servicio `mailer` con contexto multi-tenant (`cliente_id`) y datos del envío.

### 6.4 Entrega

`mailer` utiliza proveedor externo o infraestructura configurada para entregar el email.

### 6.5 Llegada del lead a la landing

El lead puede:

* ignorar
* hacer click
* responder por email
* mostrar interés por otra vía

### 6.6 Recepción

Las respuestas iniciales deben caer en un inbox bajo control operativo de LeadMaster o en una modalidad equivalente que preserve ese control.

### 6.7 Clasificación

LeadMaster evalúa la respuesta y decide si el caso pasa a estado de interés suficiente.

### 6.8 Derivación

Solo en esta instancia se deriva el lead al cliente final.

---

## 7. Separación crítica de conceptos

Este canal obliga a diferenciar elementos que muchas veces se confunden.

### 7.1 Identidad visible

Qué ve el prospecto.

Ejemplos:

* nombre de remitente
* correo visible
* firma
* marca
* dominio

### 7.2 Infraestructura de envío

Quién envía técnicamente el correo.

Ejemplos:

* SMTP externo
* proveedor transaccional
* API de envío

### 7.3 Inbox de respuesta

Dónde llega la respuesta real del prospecto.

### 7.4 Propiedad de la base

Quién controla la base operativa inicial y su enriquecimiento.

### 7.5 Derivación

Cuándo el cliente toma el control del caso.

Estas capas deben mantenerse separadas conceptualmente y también en la documentación.

---

## 8. Responsabilidades por componente

### 8.1 Central Hub

**MUST**

* validar `cliente_id`
* validar payload funcional
* aplicar reglas de negocio
* decidir cuándo enviar
* registrar resultado
* mantener criterio de derivación
* proteger consistencia multi-tenant

**MUST NOT**

* enviar correo directamente desde lógica improvisada embebida
* ceder por defecto el inbox bruto al cliente
* mezclar reglas comerciales con detalles del proveedor técnico

---

### 8.2 Mailer

**MUST**

* aceptar requests HTTP del hub
* validar request técnico mínimo
* enviar correo
* retornar resultado técnico claro
* tipificar errores
* desacoplar proveedor del resto del sistema

**MUST NOT**

* decidir campañas
* decidir a quién contactar
* clasificar interés
* acceder a la base comercial como dueño del proceso
* reemplazar lógica del hub

---

### 8.3 Cliente final

**MUST**

* definir oferta y marca
* aprobar activos de campaña
* responder cuando un lead es derivado
* colaborar con requisitos técnicos mínimos si se usa su dominio

**MUST NOT**

* asumir control del inbox inicial por defecto
* recibir la base bruta salvo acuerdo explícito
* intervenir caóticamente en el flujo inicial de prospección

---

## 9. Multi-tenant

El canal email debe respetar el mismo principio multi-tenant ya adoptado en el workspace.

### Reglas

* todo flujo debe quedar asociado a `cliente_id`
* toda identidad de envío debe poder resolverse por cliente
* todo registro operativo debe quedar asociado a cliente
* toda derivación debe estar aislada por cliente

Esto evita contaminación entre cuentas y preserva el modelo SaaS / multi-cliente.

---

## 10. Modelos de operación posibles

### Modelo A — Casilla genérica operada por LeadMaster

Ejemplo:

* cuenta tipo Gmail o equivalente
* control total por LeadMaster

**Uso recomendado:** MVP o validación inicial

---

### Modelo B — Dominio del cliente + operación LeadMaster

Ejemplo:

* identidad visible del cliente
* proveedor externo operado por LeadMaster
* inbox bajo control operativo de LeadMaster

**Uso recomendado:** modelo preferido

---

### Modelo C — Dominio e inbox del cliente

Ejemplo:

* todo queda en manos del cliente

**Uso recomendado:** no preferido para el modelo base de LeadMaster, salvo acuerdos especiales

---

## 11. Modelo arquitectónico preferido

LeadMaster adopta como dirección preferida el siguiente modelo:

* identidad coherente con la marca del cliente
* landing específica
* proveedor de envío externo
* `central-hub` como orquestador
* `mailer` como servicio desacoplado
* inbox inicial bajo control de LeadMaster
* derivación selectiva hacia el cliente

Este modelo equilibra:

* legitimidad comercial
* control del embudo
* protección de la base
* escalabilidad futura

---

## 12. Requisitos mínimos de integración

### 12.1 Contrato HTTP

Debe existir contrato documentado para `mailer`.

### 12.2 Endpoints mínimos

* `GET /health`
* `POST /send`

### 12.3 Contexto de cliente

Todo request debe transportar `cliente_id`.

### 12.4 Persistencia operativa

Todo envío debe dejar traza operativa suficiente para auditoría y seguimiento.

---

## 13. Estados funcionales sugeridos

Estados mínimos del flujo:

* `LEAD_DETECTADO`
* `EMAIL_PENDIENTE`
* `EMAIL_ENVIADO`
* `RESPUESTA_RECIBIDA`
* `INTERES_DETECTADO`
* `DERIVADO_AL_CLIENTE`
* `DESCARTADO`

### Interpretación

* `EMAIL_ENVIADO` no implica éxito comercial
* `RESPUESTA_RECIBIDA` no implica interés suficiente
* `INTERES_DETECTADO` habilita derivación

---

## 14. Riesgos arquitectónicos

### Riesgo 1 — Confundir identidad con control

Usar el dominio del cliente no implica que el cliente deba ver todo el inbox.

### Riesgo 2 — Resolver todo dentro de `sender`

Eso mezclaría canal, negocio y proveedor técnico.

### Riesgo 3 — Entregar demasiado temprano la base o el inbox

Eso debilita el valor de LeadMaster.

### Riesgo 4 — No exigir landing o identidad coherente

Eso reduce legitimidad y deteriora resultados.

---

## 15. Evolución futura esperada

Esta arquitectura debe permitir evolución posterior hacia:

* campañas más sofisticadas
* tracking de interacción
* analytics por canal
* panel operativo de email
* integración multicanal real (email + WhatsApp + otros)

Sin romper el principio central:

> LeadMaster controla la apertura y la clasificación inicial; el cliente recibe leads derivados.

---

## 16. Documentos relacionados

* `docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md`
* `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`
* `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`
* `docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md`

---

## 17. Estado

**Status actual:** APPROVED
**Approved by:** Alberto Hilal

Este documento define arquitectura funcional e integración conceptual.
No reemplaza contratos HTTP ni especificaciones técnicas detalladas.

````

---
