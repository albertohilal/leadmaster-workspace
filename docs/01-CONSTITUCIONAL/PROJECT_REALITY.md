# PROJECT REALITY — LeadMaster Workspace

**Status:** Draft  
**Purpose:** Documento que define el contexto de negocio, modelo operativo y realidad actual del cliente  
**Last Updated:** 2026-02-27  
**Related:** [PROJECT_STATUS.md](./PROJECT_STATUS.md)

---

## 1. Contexto del Negocio

LeadMaster Workspace es una plataforma orientada a la gestión y procesamiento de leads comerciales mediante la integración de canales de comunicación digital, con especial foco en WhatsApp.

El objetivo estratégico actual no es automatizar envíos de mensajes, sino **capturar, clasificar y procesar conversaciones entrantes** con el fin de alimentar flujos comerciales y de seguimiento.

---

## 2. Modelo Operativo Actual

### WhatsApp Listener

- La plataforma utiliza **WhatsApp Web (whatsapp-web.js)** como motor de escucha de mensajes entrantes (inbound).
- La sesión de WhatsApp Web se mantiene desplegada en un servidor (VPS) y su estado es expuesto para permitir el análisis de mensajes recibidos.
- El sistema hace uso de una sesión particular de WhatsApp y el número actualmente configurado es **un número personal del operador**, no un número de empresa exclusivo o dedicado.
- Se reconoce que existe un desafío persistente relacionado con la lectura y persistencia de QR para establecer la sesión de forma consistente.

### Envíos de Mensajes

- **No existe ni se utiliza un mecanismo de envío programático de mensajes basado en whatsapp-web.js.**
- La posibilidad de envío automático desde el servicio de sesión (`session-manager`) ha sido desactivada y documentada formalmente como irrelevante para el modelo actual.
- El envío de mensajes salientes se realiza **manualmente por el operador**, utilizando la interfaz de https://web.whatsapp.com/ para responder o iniciar conversaciones cuando corresponde.

### Futuro Envío Automático

- El envío automático planificado para producción se realizará mediante **Meta WhatsApp Cloud API** cuando la plataforma la tenga disponible y aprobada.
- El uso de Meta API será la única forma de envío automatizado y está separado conceptualmente del listener de WhatsApp Web.

---

## 3. Restricciones y Limitaciones Reales

### Técnicas

- La automatización de envíos vía WhatsApp Web demostró ser riesgosa y condujo a bloqueos de número en pruebas anteriores. Por esta razón, **el envío automatizado está deshabilitado**.
- La sesión de whatsapp-web.js requiere manejo de QR y persistencia local, lo que aún no ha alcanzado una estabilidad robusta en todas las instancias operativas.
- El servicio de escucha opera bajo un único contexto/sesión de WhatsApp Web, sin provisionamiento de múltiples sesiones o multi-tenant.

### Operativas

- Actualmente se utiliza un **número de WhatsApp particular** en lugar de uno corporativo o dedicado. Esto limita el alcance de producción y genera dependencias manuales del operador.
- No hay un mecanismo automatizado de reconexión o recuperación avanzada en el caso de desconexión de la sesión de WhatsApp Web.

---

## 4. Expectativas y Objetivos de la Fase Actual

### Expectativas

- Estabilizar el listener de WhatsApp para asegurar captura continua de mensajes entrantes.
- Documentar formalmente la separación entre escucha (inbound) y envío (outbound).
- Preparar la plataforma para integrar **Meta WhatsApp Cloud API para envío automatizado** en fases posteriores.

### Objetivos Actuales

- El listener de WhatsApp Web debe funcionar de manera confiable durante períodos extendidos de operación.
- El envío de mensajes salientes queda **100 % fuera de la responsabilidad técnica del listener**.
- Validar que todos los flujos de entrada de mensajes se puedan procesar y registrar sin intervención manual en el backend.

---

## 5. Síntesis de Realidad (2026-02-27)

| Componente | Estado Actual |
|------------|---------------|
| WhatsApp Listener (whatsapp-web.js) | Activo y en operación |
| Envío Automatizado (whatsapp-web.js) | Desactivado |
| Envíos Manuales | Activos (Web WhatsApp) |
| Meta WhatsApp Cloud API | Planeado / Futuro |
| Número de Producción | Uso de número particular |
| Estabilidad de Sesión | Work-in-progress |

---

## 6. Observaciones Clave

- El sistema ha evolucionado desde un diseño con capacidades de envío automatizado hacia un **modelo operativo claro y limitado**: escucha (inbound) exclusivamente.
- Esta decisión se documenta formalmente para evitar que en futuras iteraciones se reactive código o rutas de envío no alineadas con los objetivos actuales.
- El documento refleja la **realidad actual de operación de la plataforma**, no el plan aspiracional ni el contrato deseado para fases futuras.

---
