# Ajuste fix de veladura y bloqueo de UI en frontend

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Registrar el ajuste mínimo y defensivo aplicado en frontend para evitar que overlays/modales del flujo de selección de prospectos queden activos y bloqueen la interacción visual de la app.

## Archivo ajustado

- [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)

Archivos revisados como apoyo, sin cambios en este paso:

- [frontend/src/components/common/Modal.jsx](../../frontend/src/components/common/Modal.jsx)
- [frontend/src/components/destinatarios/EmailCampaignFormModal.jsx](../../frontend/src/components/destinatarios/EmailCampaignFormModal.jsx)
- [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx)

## Problema anterior verificado

Antes del ajuste, el estado verificado era este:

- **verificado por código:** `GestionDestinatariosPage.jsx` montaba varios overlays full-screen con `fixed inset-0 bg-black bg-opacity-50 z-50`
- **verificado por código:** esos overlays dependían de estados locales como:
  - `mostrarModalEmail`
  - `mostrarModalWhatsApp`
  - `mostrarModalClasificar`
  - `loadingEmail`
  - `loadingEnvio`
  - `loadingClasificacion`
- **verificado por código:** el cierre del modal Email estaba condicionado por `loadingEmail`, lo que podía dejar la UI atrapada si ese estado no se liberaba a tiempo
- **verificado por código:** no había un reset centralizado y defensivo de estados transitorios al cambiar de ruta o de contexto dentro del componente

En consecuencia, existía riesgo real de dejar una veladura/backdrop activo sobre toda la UI aunque el usuario ya hubiera navegado o cambiado de contexto operativo.

## Ajuste implementado

Se aplicó un ajuste local y acotado en `GestionDestinatariosPage.jsx`.

### Cambios introducidos

**verificado por código:** se centralizaron resets explícitos para los tres grupos de estado transitorio:

- reset de modal WhatsApp
- reset de modal Email
- reset de modal de clasificación

**verificado por código:** se agregó un helper de reseteo transversal de estado UI transitorio para cerrar y limpiar:

- overlays activos
- datos de modal asociados
- flags `loading*` ligados a esos overlays

**verificado por código:** se agregó un efecto defensivo que resetea estados transitorios cuando cambia:

- `location.pathname`
- `campaniaSeleccionada`
- `emailCampaignSeleccionada`

**verificado por código:** el cierre del modal Email dejó de depender de `loadingEmail`; ahora se puede cerrar y limpiar el estado local aunque hubiera una operación asíncrona previa en curso.

**verificado por código:** el cierre manual del modal WhatsApp y el cierre del modal de clasificación quedaron alineados con helpers de reset explícito.

## Comportamiento resultante

Después del ajuste:

- los overlays del componente quedan reseteados al cambiar de ruta
- los overlays del componente quedan reseteados al cambiar de campaña/contexto dentro del flujo
- los flags `loadingEmail`, `loadingEnvio` y `loadingClasificacion` ya no quedan dependiendo solo del camino feliz de cierre visual
- el modal Email no deja la UI atrapada por una condición de cierre bloqueada por `loadingEmail`

## Fuera de alcance

Quedó fuera de alcance en este paso:

- backend
- contratos Email
- create / list / recipients / prepare / send
- layout global
- refactor del sistema de modales
- campañas WhatsApp fuera del componente afectado por este bug
- cambios de negocio del canal Email

## Pendientes inmediatos

1. validar manualmente la navegación sobre el flujo que usa `GestionDestinatariosPage.jsx`
2. confirmar que ya no queda ninguna capa `fixed inset-0` montada al cambiar de pantalla
3. si el problema persiste, inspeccionar en runtime cuál overlay concreto sigue activo en DevTools
4. retomar recién después la validación funcional de Email (`create → recipients → prepare`)
