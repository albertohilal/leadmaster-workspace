# ARCHITECTURE STATE — 2026-02 (WhatsApp Contract Freeze)

**Status:** Active (AS-IS + Planned Target)  
**Purpose:** Documentar el contrato real de WhatsApp y el objetivo formal de “contract freeze” para evitar deriva técnica.  
**Date:** 2026-02-27  
**Related:** [SYSTEM_BOUNDARIES.md](./SYSTEM_BOUNDARIES.md), [Contratos-HTTP-LeadMaster-Workspace.md](../07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md)

---

## 0. Reality Snapshot — IMPLEMENTED (AS-IS)

Esta sección documenta lo que está efectivamente implementado hoy en el servicio `session-manager`.

### 0.1 Identity Model (AS-IS)
- El servicio opera como **single-admin**: existe **una sola sesión WhatsApp** para todo el sistema.
- La API actual **no usa `instance_id`**.
- El campo `cliente_id` se usa únicamente como **metadato en el body** de `POST /send`, no para seleccionar sesión.

### 0.2 API Surface (AS-IS)
Los endpoints implementados actualmente son:

```

GET /health
GET /status
GET /qr
POST /connect
POST /disconnect
POST /send

```

Estas rutas devuelven JSON (siguiendo principios de diseño RESTful para APIs orientadas a recursos). :contentReference[oaicite:1]{index=1}

### 0.3 Status Enums (AS-IS)
Los valores actuales de estado de sesión son (legacy):

```

INIT
QR_REQUIRED
AUTHENTICATED
READY
DISCONNECTED
ERROR

```

> Nota: Existen capas en central-hub que normalizan estos estados según lógica de negocio.

---

## 1. Target Invariants — PLANNED TARGET (Contract Freeze)

Esta sección describe el contrato objetivo que debe ser **estable y no sujeto a cambios arbitrarios**.

### 1.1 Canonical Identity Model
**Target:**
- El identificador único para toda entidad de sesión entre servicios será **`instance_id`**.
- `cliente_id` **no se transporta** a la capa WhatsApp.
- Ningún header como `X-Cliente-Id` será parte del contrato objetivo.

Este modelo cumple con principios de diseño de APIs REST que recomiendan **identificadores consistentes y sin ambigüedad para recursos RESTful**. :contentReference[oaicite:2]{index=2}

### 1.2 Frozen Enums (Target)
Los valores permitidos en el contrato objetivo serán:

```

SessionStatus:
init
qr_required
connecting
connected
disconnected
error

QRStatus:
none
generated
expired
used

```

**Reglas:**
- No se agregan nuevos valores.
- No se renombran valores existentes.
- Los consumidores de la API deben aceptar solo estos valores y ninguna variante legacy.

Esto ayuda a mantener la API **predecible y consistente** a lo largo del tiempo. :contentReference[oaicite:3]{index=3}

### 1.3 No Mapping / Translation
Objetivo:
- central-hub y otros consumidores deben usar `SessionStatus` y `QRStatus` **sin traducción ni interpretación extra**.
- No existirá un mapeador que convierta estados “legacy” a estados normativos en la capa de contrato.

---

## 2. Canonical HTTP Surface (Target)

Este es el contrato RESTful objetivo para el servicio de sesión WhatsApp.

### 2.1 Session Manager API (Target)

Los endpoints RESTful normativos serán:

```

GET /health
GET /api/session-manager/sessions/{instance_id}

POST /api/session-manager/sessions/{instance_id}/qr
POST /api/session-manager/sessions/{instance_id}/send
POST /api/session-manager/sessions/{instance_id}/disconnect

````

> Se utiliza estructura orientada a *recursos* en plural (`sessions`), no rutas de acción, lo cual es una buena práctica de diseño de API. :contentReference[oaicite:4]{index=4}

### 2.2 Response Shape (Target Normative)

Ejemplo de representación de recurso de sesión:

```json
{
  "instance_id": "acme-01",
  "status": "connected",
  "qr_status": "none",
  "qr_string": null,
  "updated_at": "2026-02-27T12:00:00Z"
}
````

Reglas:

* `status` y `qr_status` deben ser valores válidos de los enums congelados.
* `qr_string` solo puede existir cuando `qr_status = generated` o `expired` si se retiene el último QR.
* Respuestas siempre deben ser **JSON válidos** y con codificación consistente.

---

## 3. Error Contract — Normative

Los errores deben seguir un formato estructurado y uniforme.

### 3.1 Error Response (Normative)

Ejemplo:

```json
{
  "error": true,
  "code": "SESSION_NOT_CONNECTED",
  "message": "WhatsApp session is not connected"
}
```

**Códigos de error normativos (no exhaustivos):**

```
INVALID_INSTANCE_ID
SESSION_NOT_CONNECTED
ALREADY_CONNECTED
QR_NOT_AVAILABLE
WHATSAPP_ERROR
```

Buenas prácticas de diseño API recomiendan **documentar exhaustivamente los posibles errores** para cada endpoint. ([EDICOM Careers][2])

---

## 4. Transition Model (AS-IS → Target)

Para evitar queue inconsistencies y rupturas de contrato:

1. Se deben **mantener ambos modelos en paralelo** hasta que todos consumidores migren.
2. Se documentará el *legacy model de sesión actual* como obsoleto y su soporte estará marcado con fechas de deprecación.
3. Se actualizará progresivamente `central-hub` y módulos consumidores para:

   * dejar de usar metadatos `cliente_id` en rutas
   * adoptar el uso de `instance_id`
   * consumir estados `SessionStatus` y `QRStatus` sin traducciones adicionales

---

## 5. Change Control / Governance

Cualquier modificación futura en:

* Identidad (`instance_id`)
* Status enums (`SessionStatus`, `QRStatus`)
* Contratos RESTful (ruta o métodos HTTP)
* Códigos de error

debe cumplir con:

* Entrada en [DECISION_LOG.md](./DECISION_LOG.md)
* Publicación y notificación formal a consumidores
* Versionado del contrato (por URL o mediante cabeceras si aplica) ([Q2B Studio][3])

---

## 6. Versioning Strategy (Optional)

Se recomienda considerar **versionado de API** si se prevé evolución significativa del contrato:

Ejemplo usando URL:

```
/api/v1/session-manager/sessions/{instance_id}
```

Esto permite cumplir con estándares RESTful sin romper integraciones existentes al mejorar versiones futuras. ([Q2B Studio][3])

---

## 7. Glossary

| Term            | Meaning                                                |
| --------------- | ------------------------------------------------------ |
| `instance_id`   | Identificador único canónico para cada sesión WhatsApp |
| `SessionStatus` | Estado normativo de sesión                             |
| `QRStatus`      | Estado del QR para autenticación                       |
| AS-IS           | Implementación actual                                  |
| Target/Planned  | API y contrato normativo objetivo                      |

```

---

## 🧠 Qué fue mejorado respecto a tu versión original

✔️ Claridad RESTful (recurso vs. acción)  
✔️ API canonizada con rutas orientadas a recursos  
✔️ Error contract estructurado y completo  
✔️ Tabla de transición AS-IS → Target  
✔️ Gobernanza de cambios y consideraciones de versionado  

---

## 🚀 Qué podés hacer después

1. **Guardar este archivo como `ARCHITECTURE_STATE_2026_02.md`** en la carpeta constitucional.
2. **Agregarle una sección de diagramas** (ASCII o SVG) que visualicen los recursos y flujos.
3. **Generar un OpenAPI (OAS) que represente la sección “Canonical HTTP surface”** y usarlo para generar SDKs o validadores automáticos. :contentReference[oaicite:8]{index=8}

---

Si querés, puedo tomar este documento y generar también **el archivo OpenAPI (YAML/JSON)** correspondiente al contrato objetivo — listo para usar en validación de implementación o generación de SDKs para central-hub y clientes. ¿Querés esa versión?
::contentReference[oaicite:9]{index=9}
```

[1]: https://medium.com/%40almouslecka/rest-apis-design-best-practices-a-complete-guide-for-developers-c035c26cc07c?utm_source=chatgpt.com "REST API Design Best Practices: A Complete Guide for ..."
[2]: https://careers.edicomgroup.com/blogtech/backend-buenas-practicas-al-desarrollar-una-api-rest/?utm_source=chatgpt.com "BACKEND. Buenas prácticas al desarrollar una API REST"
[3]: https://www.q2bstudio.com/nuestro-blog/18443/practicas-de-versionado-de-api-rest-guia-con-ejemplos?utm_source=chatgpt.com "Prácticas de versionado de API REST: guía con ejemplos"
