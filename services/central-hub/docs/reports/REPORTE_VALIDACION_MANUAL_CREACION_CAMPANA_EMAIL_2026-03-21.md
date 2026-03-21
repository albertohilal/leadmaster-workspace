# REPORTE - Validacion manual del flujo minimo de creacion de campana Email

## Fecha

2026-03-21

## Destino

services/central-hub/docs/reports/REPORTE_VALIDACION_MANUAL_CREACION_CAMPANA_EMAIL_2026-03-21.md

## Objetivo de la validacion

Dejar constancia documental del estado actual del flujo minimo de creacion de campana Email implementado en `services/central-hub`, validando su alcance real, su separacion respecto del dominio actual de campanas WhatsApp y los limites explicitamente vigentes del corte.

Este reporte queda alineado con:

- `docs/01-CONSTITUCIONAL/ADR-002-FORMULARIOS-CAMPANAS-POR-CANAL-INICIO-EMAIL.md`
- `services/central-hub/docs/planificacion/CONTRATO_MINIMO_CREACION_CAMPANA_EMAIL_2026-03-21.md`

## Alcance validado

La validacion manual documentada cubre el flujo actualmente implementado para:

- acceso a la pantalla `frontend` de creacion de campana Email en `/email/campaigns/new`
- acceso por menu lateral mediante `Crear campaña Email`
- acceso contextual desde `CampaignsManager`
- formulario minimo con los campos:
  - `nombre`
  - `subject`
  - `text`
- integracion `frontend` contra `POST /api/email/campaigns`
- lectura honesta del resultado actual como flujo preparatorio

Queda expresamente fuera del alcance de esta validacion:

- persistencia real de campanas Email
- envio de Email
- seleccion o gestion de destinatarios
- programacion
- integracion con el dominio actual de campanas WhatsApp
- cualquier interpretacion de Email como modulo completo ya consolidado

## Precondiciones

Para reproducir la validacion manual del flujo en un entorno local o de prueba se requiere:

- backend `central-hub` disponible
- frontend de `central-hub` disponible
- usuario autenticado en la aplicacion
- rama con el estado ya publicado del frente `campaigns-by-channel-alignment`
- contrato backend minimo vigente para `POST /api/email/campaigns`

## Pasos manuales de prueba

1. Ingresar a la aplicacion con un usuario autenticado.
2. Verificar en el sidebar la opcion `Crear campaña Email`.
3. Navegar a `/email/campaigns/new` desde el sidebar.
4. Confirmar que la pantalla de Email se presenta como flujo propio y separado del dominio actual de campanas WhatsApp.
5. Verificar que el formulario muestra unicamente los campos `nombre`, `subject` y `text`.
6. Confirmar que la pantalla informa de forma explicita que la creacion actual es preparatoria.
7. Completar `nombre`, `subject` y `text` con valores validos.
8. Ejecutar la accion `Crear campaña Email`.
9. Verificar que el frontend muestra estado de carga durante la llamada.
10. Verificar que el resultado exitoso no presenta la campana como persistida ni como enviada.
11. Navegar a `/campaigns`.
12. Confirmar que `CampaignsManager` conserva su flujo actual de WhatsApp.
13. Verificar la presencia del CTA contextual hacia `/email/campaigns/new`.
14. Confirmar que ese CTA funciona como enlace complementario y no reemplaza el flujo actual de WhatsApp.

## Resultado esperado

El resultado esperado del corte es el siguiente:

- la creacion de campana Email queda visible y operable desde una pantalla propia
- el formulario Email no se mezcla con el formulario actual de campanas WhatsApp
- el acceso por sidebar queda disponible como entrada principal del nuevo frente
- el acceso desde `CampaignsManager` queda disponible como CTA contextual
- el backend acepta `nombre`, `subject` y `text`
- el frontend refleja que la respuesta actual corresponde a un flujo preparatorio
- no se induce al operador a interpretar que ya existe persistencia real, envio, destinatarios o programacion

## Resultado observado

Sobre el estado actualmente implementado en la rama del frente, la validacion deja confirmado lo siguiente:

- existe una pantalla dedicada en `/email/campaigns/new`
- el formulario expone el contrato minimo de Email sin heredar semantica de WhatsApp
- el acceso por sidebar se encuentra disponible mediante `Crear campaña Email`
- `CampaignsManager` incorpora un CTA contextual hacia la pantalla Email
- ese CTA no reemplaza el boton ni el flujo actual de campanas WhatsApp
- la integracion se mantiene separada de `/api/email/send`
- la respuesta del flujo sigue siendo preparatoria y honesta respecto de sus limites

Adicionalmente, en el estado actual del repositorio se encuentra verificado que:

- el frontend compila correctamente
- el backend minimo del endpoint fue cubierto con tests automatizados

## Limites actuales del flujo

Los limites vigentes del corte deben considerarse parte explicita de la validacion:

- la creacion actual de campana Email es preparatoria
- no hay persistencia real
- no hay envio
- no hay destinatarios
- no hay programacion
- no hay modulo multicanal completo
- Email sigue separado del dominio actual de campanas WhatsApp
- el CTA desde `CampaignsManager` es contextual y no reemplaza el flujo actual de WhatsApp

## Pendientes explicitos

Quedan pendientes para cortes posteriores, y fuera de este reporte, los siguientes puntos:

- definir persistencia real para campanas Email
- definir `list`, `detail` y evolucion posterior del dominio Email
- definir estrategia de vinculacion futura con destinatarios
- definir estrategia de envio posterior
- definir si existira programacion para el dominio Email y bajo que contrato
- mantener la separacion documental y funcional respecto del dominio actual de campanas WhatsApp

## Conclusion

El flujo minimo de creacion de campana Email queda validado documentalmente como un frente separado, acotado y consistente con la ADR-002 y con el contrato minimo vigente.

La validacion confirma que el sistema hoy expone:

- un endpoint minimo dedicado
- una pantalla `frontend` propia
- acceso desde sidebar
- acceso contextual desde `CampaignsManager`

Tambien confirma, sin ambiguedad, que este frente todavia no debe leerse como un modulo completo de campanas Email, sino como un primer corte preparatorio y deliberadamente limitado.