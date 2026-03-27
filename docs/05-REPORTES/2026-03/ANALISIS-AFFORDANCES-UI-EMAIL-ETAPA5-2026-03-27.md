# Análisis de affordances UI Email — Validación semántica restante (Etapa 5)

**Tipo:** Análisis técnico de UI  
**Plano:** AS-IS IMPLEMENTADO + propuestas de cambio  
**Fecha:** 2026-03-27  
**Branch:** `feat/email-campaigns-group-2b`  
**Base:** `origin/main`  
**Alcance:** solo frontend — no se modifican backend ni contratos

---

## 1. Objetivo

Identificar affordances ambiguas restantes en la UI del flujo Email (campañas persistidas vs envío manual) y proponer cambios concretos para cerrar la Etapa 5 del plan Phase 4B.

**Criterio Etapa 5:**

> - validar que la UI no ofrezca acciones incompatibles con la campaña seleccionada  
> - ajustar textos operativos para que la semántica sea inequívoca  
> - confirmar que el operador entiende que la campaña ya determina el canal y el tipo de contenido esperable

---

## 2. Archivos revisados

| Archivo | Líneas | Rol |
|---|---|---|
| `EmailCampaignsManager.jsx` | 167 | Índice de campañas Email, punto de entrada del módulo |
| `EmailCampaignProspectsPage.jsx` | 96 | Wrapper que monta `GestionDestinatariosPage` con `useEmailCampaignSelector={true}` |
| `GestionDestinatariosPage.jsx` | 1499 | Pantalla compartida de selección de prospectos (WhatsApp + Email) |

---

## 3. Análisis por archivo

### 3.1. EmailCampaignsManager.jsx

**Estado general:** bueno. Textos razonablemente claros. Tres hallazgos menores.

| ID | Ubicación | Hallazgo | Severidad |
|---|---|---|---|
| M-1 | Línea ~83 | Enlace **"Seleccionar destinatarios"** va a `/email/campaigns/prospects`. El texto no explicita que es para agregar destinatarios **a una campaña Email**. Podría interpretarse como acceso al envío manual. | Media |
| M-2 | Línea ~70 | Título del Card: **"Gestión del módulo"**. Genérico; no aporta orientación funcional. | Baja |
| M-3 | Línea ~143 | Botón por fila: **"Destinatarios"** (va a `/email/campaigns/{id}/prospects`). Correcto en contexto de la tabla, pero como label aislado podría significar "ver", "agregar" o "gestionar". | Baja |
| M-4 | Línea ~109 | Mensaje vacío: *"Este espacio muestra campañas Email reales del cliente autenticado."* No orienta al operador sobre qué hacer (crear primera campaña). | Baja |

### 3.2. EmailCampaignProspectsPage.jsx

**Estado general:** funcional, pero con señales de contexto insuficientes.

| ID | Ubicación | Hallazgo | Severidad |
|---|---|---|---|
| P-1 | Línea ~55 | Título **"Seleccionar destinatarios (Email)"**. El paréntesis es informal. No comunica que la selección es **para una campaña Email persistida**. | Media |
| P-2 | Línea ~57 | Muestra `Contexto campaña: {campaignId}` como ID numérico crudo. El operador ve el identificador técnico, pero no el nombre funcional de la campaña, lo que reduce la claridad del contexto de trabajo. | Media |

| P-3 | Línea ~49 | Enlace **"+ Nueva campaña Email"** en la cabecera de una página de selección de destinatarios. Funcionalmente válido como atajo, pero puede sugerir que esta página es un hub de gestión general, no un paso dentro del flujo de campaña. | Baja |
| P-4 | — | No hay texto de orientación que describa el flujo: seleccionar → agregar a campaña → preparar envío → scheduler. El operador nuevo no sabe qué hace después de seleccionar. | Media |

### 3.3. GestionDestinatariosPage.jsx

**Estado general:** mejorado por el hardening anterior, pero quedan puntos operativos importantes.

| ID | Ubicación | Hallazgo | Severidad |
|---|---|---|---|
| G-1 | Línea ~996 | Botón **"Agregar a Campaña"** con estilo `bg-slate-700`. Texto genérico: no distingue si se agrega a campaña WhatsApp o Email. En modo `useEmailCampaignSelector` debería decir "Agregar destinatarios Email" o similar. | **Alta** |
| G-2 | Líneas ~1260-1267 | Botón **"Clasificar post-envío"** aparece para cualquier prospecto con `envio_id`, **incluso en modo Email campaña**. Las opciones de clasificación (`NUMERO_INEXISTENTE`, `NUMERO_CAMBIO_DUEÑO`, `ATENDIO_MENOR_DE_EDAD`, `INVALIDAR_TELEFONO`) son semánticamente específicas del canal WhatsApp/telefónico. Ofrecerlas en contexto Email es una acción incompatible con la campaña seleccionada. | **Alta** |
| G-3 | Línea ~970 | Texto **"Campaña fijada por contexto del módulo Email."** aparece en modo `!useEmailCampaignSelector` cuando `hasCampaignMatch` es true. El mensaje dice "módulo Email" pero aplica sobre una campaña WhatsApp operativa. Texto engañoso. | Media |
| G-4 | Línea ~387 | Cuando no hay campaña Email seleccionada, `estadoPrincipal()` devuelve `'seleccionar_campana'` y se muestra como badge de estado del prospecto. "Seleccionar campaña" no es un estado del prospecto; es una instrucción de UI. Rompe la semántica de la columna Estado. | Media |
| G-5 | Líneas ~893-910 | Card "Campaña Email actual" muestra *"Seleccionar campaña Email"* como nombre de campaña cuando no hay ninguna seleccionada, y debajo: *"La tabla carga el universo del cliente aunque aún no elijas campaña Email"*. El tono es ligeramente informal y la frase es larga. | Baja |

---

## 4. Matriz de hallazgos vs criterios de Etapa 5

| Criterio Etapa 5 | Hallazgos que lo incumplen |
|---|---|
| La UI no ofrezca acciones incompatibles con la campaña seleccionada | **G-2** (clasificación WhatsApp en contexto Email) |
| Textos operativos con semántica inequívoca | **G-1** (botón genérico), **M-1** (enlace ambiguo), **P-1** (título informal), **G-3** (texto engañoso), **G-4** (estado que no es estado) |
| El operador entiende que la campaña determina canal y contenido | **P-4** (sin orientación de flujo), **P-2** (ID crudo sin nombre), **M-4** (mensaje vacío no orientativo) |

---

## 5. Propuestas concretas de cambio

### Cambio 1 — `G-1`: Botón "Agregar a Campaña" contextualizado

**Archivo:** `GestionDestinatariosPage.jsx`, línea ~996

| Antes | Después |
|---|---|
| `Agregar a Campaña` (siempre) | `Agregar destinatarios Email` cuando `useEmailCampaignSelector`, `Agregar a Campaña` cuando no |

Estilo: mantener `bg-slate-700` para ambos.

### Cambio 2 — `G-2`: Ocultar "Clasificar post-envío" en modo Email campaña

**Archivo:** `GestionDestinatariosPage.jsx`, línea ~1260

Agregar condición: mostrar el botón "Clasificar post-envío" **solo cuando `!useEmailCampaignSelector`** (o cuando `!hideWhatsappActions`, dado que ambos flags covarían).

Justificación: las opciones de clasificación son telefónicas. Cuando el módulo Email tenga su propia clasificación post-envío, se agregará un flujo específico.

### Cambio 3 — `G-3`: Corregir texto de campaña fijada

**Archivo:** `GestionDestinatariosPage.jsx`, línea ~970

| Antes | Después |
|---|---|
| "Campaña fijada por contexto del módulo Email." | "Campaña fijada por contexto de navegación." |

Elimina la referencia incorrecta a "módulo Email" en un contexto que aplica sobre campañas WhatsApp.

### Cambio 4 — `G-4`: Evitar pseudo-estado operativo cuando no hay campaña seleccionada

**Archivo:** `GestionDestinatariosPage.jsx`, líneas ~375-388

Cuando `useEmailCampaignSelector && !emailCampaignSeleccionada`, `estadoPrincipal()` actualmente devuelve `'seleccionar_campana'`. No conviene mostrar eso como si fuera un estado operativo del prospecto. La opción preferida es no presentar un badge de estado operativo hasta que exista campaña seleccionada. Si por implementación conviene mantener un placeholder visible, usar un label explícito como "Sin campaña seleccionada" con badge gris.

Justificación: "Seleccionar campaña" es una instrucción de UI, no un estado del dato. "Sin contexto" mejora algo, pero sigue siendo una etiqueta demasiado técnica para el operador.

### Cambio 5 — `M-1`: Enlace "Seleccionar destinatarios" más explícito

**Archivo:** `EmailCampaignsManager.jsx`, línea ~83

| Antes | Después |
|---|---|
| "Seleccionar destinatarios" | "Agregar destinatarios a campaña" |

### Cambio 6 — `P-1` + `P-4`: Título y orientación en EmailCampaignProspectsPage

**Archivo:** `EmailCampaignProspectsPage.jsx`

| Elemento | Antes | Después |
|---|---|---|
| Título (línea ~55) | "Seleccionar destinatarios (Email)" | "Destinatarios de campaña Email" |
| Debajo del título | (nada / campaignId crudo) | Texto de orientación: "Seleccioná prospectos del universo del cliente y agregalos como destinatarios de una campaña Email. Luego prepará el envío técnico para iniciar el despacho secuencial." |

### Cambio 7 — `P-2`: Mostrar nombre de campaña en vez de ID crudo

**Archivo:** `EmailCampaignProspectsPage.jsx`, línea ~57

Actualmente muestra `Contexto campaña: {campaignId}`. Buscar el nombre de la campaña en `emailCampaigns` y mostrar: `Campaña: {nombre} (#{campaignId})`. Si el nombre no puede resolverse, usar como degradación segura `Campaña: #${campaignId}`.

### Cambio 8 — `M-2`: Card title más orientativo

**Archivo:** `EmailCampaignsManager.jsx`, línea ~70

| Antes | Después |
|---|---|
| `"Gestión del módulo"` | `"Campañas y acciones"` |

### Cambio 9 — `M-4`: Mensaje vacío más orientativo

**Archivo:** `EmailCampaignsManager.jsx`, línea ~109

| Antes | Después |
|---|---|
| "Este espacio muestra campañas Email reales del cliente autenticado." | "Todavía no hay campañas Email. Usá «Nueva campaña Email» para crear la primera." |

---

## 6. Priorización sugerida

| Prioridad | Cambios | Justificación |
|---|---|---|
| **1 — Corregir** | G-1, G-2 | Acción incompatible + botón ambiguo. Incumplimiento directo de Etapa 5. |
| **2 — Mejorar** | G-3, G-4, P-1, P-2, P-4, M-1 | Textos engañosos o insuficientes. Cierre completo de Etapa 5. |
| **3 — Pulir** | M-2, M-4, P-3, M-3 | Mejoras de calidad editorial y de orientación secundaria. No bloquean Etapa 5. En particular, `P-3` se considera un atajo válido, no un problema funcional. |
---

## 7. Archivos que se modificarían

| Archivo | Cambios |
|---|---|
| `GestionDestinatariosPage.jsx` | G-1, G-2, G-3, G-4 |
| `EmailCampaignsManager.jsx` | M-1, M-2, M-4 |
| `EmailCampaignProspectsPage.jsx` | P-1, P-2, P-4 |

**No se modifican: backend, rutas, contratos, servicios, tests.**

---

## 8. Relación con cierre de Etapa 5

Si se aplican los cambios de prioridad 1 y 2 (G-1, G-2, G-3, G-4, P-1, P-2, P-4, M-1), la Etapa 5 quedaría sustancialmente cubierta a nivel de código y semántica de UI. Los cambios de prioridad 3 son mejoras editoriales que no condicionan el cierre. Aun así, el cierre definitivo sigue sujeto a validación visual completa en browser.

Queda fuera de este análisis la validación visual en browser de todos los estados posibles de la tabla (con campaña vacía, con recipients sin prepare, post-prepare, con errores). Esa validación es complementaria pero no depende de cambios de código.

---

**Documentos de referencia:**

- `docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md` — Etapa 5
- `docs/05-REPORTES/2026-03/REPORTE-HARDENING-SEMANTICO-UI-EMAIL-2026-03-27.md` — hardening anterior
