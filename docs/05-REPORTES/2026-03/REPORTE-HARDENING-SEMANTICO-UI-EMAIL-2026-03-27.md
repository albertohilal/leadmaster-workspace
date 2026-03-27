# Reporte — Hardening semántico de UI Email: separación de flujo campaña vs flujo manual

**Tipo:** Reporte técnico de cambio implementado  
**Plano:** AS-IS IMPLEMENTADO  
**Fecha:** 2026-03-27  
**Branch:** `feat/email-campaigns-group-2`  
**Commit base:** `8eb686d` (docs(email): add post-merge group 2 status report (#36))  
**Workspace:** LeadMaster

---

## 1. Objetivo

Eliminar la ambigüedad semántica de la UI entre dos flujos Email que coexisten legítimamente en el sistema:

1. **Flujo de campaña Email persistida** — crea campaña, agrega recipients, prepara envío, scheduler secuencial
2. **Flujo de envío manual aislado** — envía un correo puntual vía `/mailer/send` sin asociarlo a ninguna campaña

Ambos flujos se mantienen operativos. El cambio no elimina funcionalidad sino que hace inequívoca la distinción visual y textual entre ambos.

## 2. Problema detectado

Antes de este cambio, la pantalla de selección de prospectos (`GestionDestinatariosPage`) mostraba un único botón azul sólido etiquetado **"Preparar envío Email"** en ambos modos de operación:

- cuando `useEmailCampaignSelector === true` → el botón preparaba una campaña Email persistida
- cuando `useEmailCampaignSelector === false` → el botón abría el modal de envío manual aislado

Visualmente eran idénticos; funcionalmente hacían cosas distintas. Esa ambigüedad podía inducir al operador a interpretar el envío manual como el flujo canónico del módulo Email, contradeciendo la decisión documental de que las campañas Email persistidas son el flujo principal.

## 3. Decisiones funcionales preservadas

- `EmailCampaignFormModal.jsx` se mantiene sin eliminar
- el flujo manual sigue usando `/mailer/send` por destinatario válido
- el flujo de campañas persistidas sigue usando create → add recipients → prepare → scheduler
- no se mezcla el flujo manual como si fuera el flujo canónico del módulo Email
- no se modifican contratos backend ni rutas HTTP
- no se altera el flujo WhatsApp

## 4. Archivos modificados

Se modificaron 3 archivos, todos en frontend. No se tocaron backend, rutas ni tests.

### 4.1. `GestionDestinatariosPage.jsx` (+34 / −17)

**Cambio central: el botón de Email ahora es distinto según el modo de operación.**

| Modo (`useEmailCampaignSelector`) | Botón antes | Botón después | Estilo |
|---|---|---|---|
| `true` (campaña) | "Preparar envío Email" (azul sólido) | **"Preparar envío de campaña"** (azul sólido) | `bg-blue-600` |
| `false` (compartido) | "Preparar envío Email" (azul sólido) | **"Envío manual Email (sin campaña)"** (azul outline) | `border-blue-300 bg-blue-50 text-blue-700` |

Otros cambios en este archivo:

- **Header del bloque de acciones**: cuando `useEmailCampaignSelector === true` dice "Acciones de campaña Email"; cuando `false` dice "Acciones sobre seleccionados"
- **Texto de ayuda en modo campaña**: dice explícitamente "Agregá destinatarios a la campaña Email y luego prepará el envío técnico de esa campaña"
- **Texto de ayuda en modo compartido**: ya no dice "Email usa la selección común" (ambiguo); se limita al conteo y al contexto WhatsApp
- **Banner contextual**: en modo compartido (no campaña, no `hideWhatsappActions`) aparece un banner amber que dice: *"Envío manual Email: abre un formulario para redactar y enviar un correo puntual sin asociarlo a ninguna campaña Email persistida. Para trabajar con campañas Email, usá el módulo de Campañas Email."* con enlace a `/email/campaigns`
- **Eliminación de despacho interno**: `prepararEnvioEmailCampania()` ya no despacha internamente a `abrirModalEmail()` cuando `!useEmailCampaignSelector`. Cada botón tiene su handler directo, eliminando la bifurcación oculta

### 4.2. `EmailCampaignFormModal.jsx` (+3 / −3)

| Elemento | Antes | Después |
|---|---|---|
| Título del modal | "Envío manual Email" | **"Envío manual Email (sin campaña)"** |
| Banner informativo | "Este flujo usa el endpoint existente /mailer/send por cada destinatario válido. Es un envío manual aislado y no corresponde al flujo principal de Campañas Email persistidas." | **"Envío manual aislado.** Este flujo envía un correo puntual por cada destinatario válido usando /mailer/send. No crea ni usa una campaña Email persistida. Para envíos asociados a campañas, usá el módulo de Campañas Email." |
| Botón de submit | "Enviar Email" | **"Enviar Email manual"** |

### 4.3. `EmailCampaignCreatePage.jsx` (+1 / −1)

| Elemento | Antes | Después |
|---|---|---|
| Subtítulo de la página | "Alta mínima y separada del dominio actual de campañas WhatsApp." | **"Crea un borrador de campaña Email persistida. Destinatarios, programación y envío se gestionan en pasos posteriores."** |

Justificación: el subtítulo anterior definía la página por contraste con WhatsApp, lo cual no aporta claridad al operador. El nuevo texto comunica directamente qué hace la página y qué sigue después.

## 5. Archivos revisados sin cambiar

| Archivo | Motivo de no cambio |
|---|---|
| `EmailCampaignProspectsPage.jsx` | Wrapper correcto que pasa `useEmailCampaignSelector={true}`. No tiene textos ambiguos |
| `EmailCampaignsManager.jsx` | Índice de campañas con textos claros. "Punto de entrada del módulo Email para crear y administrar campañas" es preciso |
| `email.js` | Servicio técnico sin capa de UI |


## 6. Verificación

- revisión manual del cambio en los 3 archivos modificados
- no se tocaron backend, rutas HTTP ni tests
- el flujo WhatsApp no fue modificado
- el flujo de campaña Email persistida conserva su comportamiento funcional
- el flujo manual aislado conserva su comportamiento funcional
- queda pendiente validación visual completa en browser y corrida de test/lint específica si se desea dejar evidencia adicional para este cambio

## 7. Relación con el plan Phase 4B

Este cambio avanza sobre la **Etapa 5** del plan `PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md`:

> *"Revisar que selección, conteos e indicadores sigan siendo coherentes bajo campañas por canal. Validar que la UI no ofrezca acciones incompatibles con la campaña seleccionada. Ajustar textos operativos para que la semántica sea inequívoca."*

La Etapa 5 requiere además una revisión completa en browser de todas las vistas y estados posibles. Este cambio cubre los textos, botones y banners del selector compartido y del modal manual, pero no constituye por sí solo el cierre de Etapa 5.

## 8. Puntos que quedan fuera de este cambio

- Validación visual en browser de todos los estados de la tabla (sin campaña, con campaña, con recipients, con prepare ejecutado)
- Revisión de tooltips o affordances en la tabla de prospectos por fila
- Decisión sobre si el acceso al modal manual debe quedar disponible desde alguna otra ruta además del selector compartido en modo no-campaña
- Cierre formal de Etapa 5 del plan Phase 4B

## 9. Conclusión

El hardening semántico aplicado elimina la principal fuente de ambigüedad: un mismo botón que significaba cosas distintas según un flag invisible para el operador. Ahora ambos flujos Email tienen identidad visual y textual propia. El flujo manual queda explícitamente presentado como herramienta puntual separada, no como equivalente del flujo de campañas persistidas.

---

**Documentos de referencia:**

- `docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md`
- `docs/05-REPORTES/2026-03/REPORTE-ESTADO-POST-MERGE-EMAIL-GRUPO-2-2026-03-27.md`
- `docs/05-REPORTES/2026-03/REPORTE-REALINEAMIENTO-CAMPANAS-POR-CANAL-2026-03-19.md`
