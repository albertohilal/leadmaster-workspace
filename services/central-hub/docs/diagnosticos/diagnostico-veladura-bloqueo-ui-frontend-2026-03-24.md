# Diagnóstico de veladura y bloqueo de interacción en frontend

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Identificar qué componente o estado del frontend de `central-hub` puede dejar una capa visual activa por encima de toda la UI, oscureciendo el layout y bloqueando la interacción, sin implementar todavía una corrección.

## Fuentes revisadas

Archivos prioritarios revisados:

- [frontend/src/App.jsx](../../frontend/src/App.jsx)
- [frontend/src/components/layout/Layout.jsx](../../frontend/src/components/layout/Layout.jsx)
- [frontend/src/components/layout/Header.jsx](../../frontend/src/components/layout/Header.jsx)
- [frontend/src/components/layout/Sidebar.jsx](../../frontend/src/components/layout/Sidebar.jsx)
- [frontend/src/components/common/Modal.jsx](../../frontend/src/components/common/Modal.jsx)
- [frontend/src/components/common/LoadingSpinner.jsx](../../frontend/src/components/common/LoadingSpinner.jsx)
- [frontend/src/components/email/EmailCampaignCreatePage.jsx](../../frontend/src/components/email/EmailCampaignCreatePage.jsx)
- [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx)
- [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx)
- [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)
- [frontend/src/components/destinatarios/EmailCampaignFormModal.jsx](../../frontend/src/components/destinatarios/EmailCampaignFormModal.jsx)
- [frontend/src/components/campaigns/CampaignsManager.jsx](../../frontend/src/components/campaigns/CampaignsManager.jsx)
- [frontend/src/components/leads/LeadsManager.jsx](../../frontend/src/components/leads/LeadsManager.jsx)
- [frontend/src/components/whatsapp/SessionManager.jsx](../../frontend/src/components/whatsapp/SessionManager.jsx)
- [frontend/src/components/admin/GestorDestinatarios.jsx](../../frontend/src/components/admin/GestorDestinatarios.jsx)
- [frontend/src/components/auth/ProtectedRoute.jsx](../../frontend/src/components/auth/ProtectedRoute.jsx)
- [frontend/src/contexts/AuthContext.jsx](../../frontend/src/contexts/AuthContext.jsx)

Búsquedas explícitas ejecutadas sobre frontend:

- `fixed`
- `absolute`
- `inset-0`
- `z-`
- `modal`
- `overlay`
- `backdrop`
- `Loading`
- `loading`
- `isOpen`
- `show`
- `submitting`
- `pointer-events`
- `bg-black`
- `bg-opacity`
- `opacity-`
- `overflow-hidden`

## Componentes con capacidad de bloquear interacción

### 1. `Modal` común reutilizable

**Verificado por código:** existe un modal común en [frontend/src/components/common/Modal.jsx](../../frontend/src/components/common/Modal.jsx).

Comportamiento relevante:

- renderiza `fixed inset-0 z-50`
- monta un backdrop `absolute inset-0 bg-black bg-opacity-50`
- cubre toda la pantalla y captura interacción mientras está abierto
- retorna `null` cuando `isOpen` es falso

**Conclusión:** sí existe un `Modal` común reutilizable y sí puede bloquear toda la pantalla, pero **no hay evidencia en este componente de que quede montado cuando `isOpen` es falso**, porque corta con `if (!isOpen) return null;`.

### 2. `GestionDestinatariosPage.jsx`

**Verificado por código:** este componente monta tres overlays full-screen inline, no a través del modal común:

- modal de WhatsApp manual
- modal de clasificación post-envío
- modal de preparación/envío Email a través de `EmailCampaignFormModal` → `Modal` común

Los dos modales inline relevantes usan exactamente:

- `fixed inset-0`
- `bg-black bg-opacity-50`
- `z-50`

Además, el modal Email se apoya en el `Modal` común, también full-screen.

**Verificado por código:** `GestionDestinatariosPage` es usado por [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx) para el flujo Email.

**Conclusión:** este componente tiene capacidad real de dejar una veladura sobre toda la app y bloquear clics.

### 3. `CampaignsManager.jsx`

**Verificado por código:** este módulo también monta overlays full-screen.

Caso visible revisado:

- modal de destinatarios con `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`

**Conclusión:** es sospechoso válido, pero no está ligado directamente al flujo Email nuevo.

### 4. `GestorDestinatarios.jsx`

**Verificado por código:** este componente monta varios overlays inline full-screen:

- agregar destinatarios
- quitar destinatarios
- confirmar envío manual

Todos usan el mismo patrón `fixed inset-0 bg-black bg-opacity-50 ... z-50`.

**Conclusión:** también puede bloquear toda la pantalla, pero vive dentro del flujo de campañas WhatsApp/destinatarios clásico, no del layout global.

### 5. `Header.jsx`

**Verificado por código:** el header tiene un dropdown con `absolute ... z-50` para menú de usuario.

**Conclusión:** puede superponerse localmente, pero no oscurece toda la pantalla ni genera backdrop global. No encaja bien con la descripción de “veladura sobre todo el layout”.

### 6. Estados `loading`

**Verificado por código:** existen muchos estados `loading`, pero la mayoría renderizan solo contenido de carga local o reemplazo de contenido, no backdrop full-screen.

Ejemplos:

- `ProtectedRoute` muestra un spinner centrado mientras autentica
- `EmailCampaignCreatePage` deshabilita inputs y botones, pero no monta overlay
- `EmailCampaignsManager` y `EmailCampaignProspectsPage` muestran cajas de carga locales
- `LoadingSpinner` no monta capa fija ni backdrop

**Conclusión:** los `loading` globales revisados no son, por sí solos, la fuente más fuerte de una capa oscura full-screen persistente.

## Sospechoso principal

**Sospechoso principal:** [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)

Fundamento:

- **verificado por código:** monta varias capas full-screen reales sobre toda la app
- **verificado por código:** una de ellas entra en el flujo Email a través de [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx)
- **verificado por código:** concentra múltiples estados locales que gobiernan overlays:
  - `mostrarModalWhatsApp`
  - `mostrarModalEmail`
  - `mostrarModalClasificar`
  - `loadingEnvio`
  - `loadingEmail`
  - `loadingClasificacion`
- **verificado por código:** algunos cierres están condicionados por estados de carga, por ejemplo `cerrarModalEmail()` no cierra si `loadingEmail` está activo
- **inferido:** si uno de esos estados queda colgado o no se resetea en la secuencia correcta, el resultado visible sería exactamente una veladura con interacción bloqueada

**Respuesta a la pregunta 5:** con la evidencia revisada, el problema parece más cercano al flujo de selección/destinatarios que al layout global. En el uso actual del módulo Email, eso entra por la pantalla de prospects Email, pero el componente sospechoso es compartido y no estrictamente “global”.

## Sospechosos secundarios

### 1. `EmailCampaignFormModal.jsx`

**Verificado por código:** usa el `Modal` común reutilizable.

**Motivo de sospecha secundaria:**

- forma parte directa del flujo Email
- depende de `mostrarModalEmail` en `GestionDestinatariosPage`
- durante `loadingEmail` el cierre está restringido

**Pero:** el `Modal` común en sí mismo desmonta correctamente cuando `isOpen` es falso.

### 2. `CampaignsManager.jsx`

**Verificado por código:** tiene overlays full-screen propios.

**Motivo de sospecha secundaria:**

- si el problema se reproduce al navegar por campañas WhatsApp, este componente podría dejar una capa activa
- usa modales inline y modales comunes

### 3. `GestorDestinatarios.jsx`

**Verificado por código:** tiene múltiples overlays full-screen inline.

**Motivo de sospecha secundaria:**

- misma familia funcional de destinatarios/envíos
- varios estados `show*` y `loading*`
- patrón de modales manuales similar al de `GestionDestinatariosPage`

### 4. `Header.jsx`

**Verificado por código:** dropdown con `absolute` y `z-50`.

**Motivo de sospecha secundaria baja:**

- puede quedar abierto visualmente
- pero no crea backdrop full-screen ni bloqueo completo del layout

## Hipótesis más probable

**Hipótesis más probable:** **modal/backdrop local sin cerrar por estado colgado o no reseteado correctamente**, no un problema de layout global ni un simple z-index.

Desglose:

- **verificado por código:** los verdaderos bloqueadores de pantalla son los modales/overlays full-screen
- **verificado por código:** el layout global (`App`, `Layout`, `Sidebar`) no monta ninguna capa de backdrop
- **verificado por código:** `Modal.jsx` común no parece quedar montado cuando está cerrado
- **inferido:** el punto más débil está en componentes con modales inline y varios estados locales concurrentes, especialmente `GestionDestinatariosPage`

Clasificación de hipótesis:

- **más probable:** modal sin cerrar / estado local colgado
- **también plausible:** navegación que deja vivo el mismo componente con estado modal todavía activo en una transición dentro del mismo flujo
- **menos probable:** z-index incorrecto puro
- **menos probable:** estado global transversal del layout
- **no verificado:** overlay de loading global a nivel app

## Puntos no verificados

1. **No verificado:** no se reprodujo el bug en navegador con trazabilidad paso a paso para identificar exactamente qué pantalla lo dispara.
2. **No verificado:** no se confirmó qué ruta estaba activa cuando apareció la veladura.
3. **No verificado:** no se verificó si la navegación involucró cambio de ruta completo o permanencia dentro del mismo componente con distinto contexto.
4. **No verificado:** no se inspeccionó el DOM en runtime para ver qué overlay concreto seguía montado cuando la app quedó bloqueada.
5. **No verificado:** no se confirmó si el problema aparece solo en Email o también en campañas/destinatarios WhatsApp.

## Próximo paso recomendado

Hacer debugging dirigido en runtime **sin refactor todavía**, enfocando primero en [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx):

1. reproducir el bloqueo y registrar la ruta exacta
2. inspeccionar en DevTools qué nodo `fixed inset-0` queda montado
3. verificar cuál de estos estados sigue en `true` cuando la UI queda oscurecida:
   - `mostrarModalEmail`
   - `mostrarModalWhatsApp`
   - `mostrarModalClasificar`
4. confirmar si el overlay proviene del flujo Email (`EmailCampaignFormModal`) o de los modales inline de WhatsApp/clasificación
5. recién después aplicar un fix puntual sobre desmontaje/reset del estado responsable
