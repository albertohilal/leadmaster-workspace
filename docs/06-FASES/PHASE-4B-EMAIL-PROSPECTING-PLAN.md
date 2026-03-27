# Phase 4B — Email Prospecting Channel

**Status:** PARTIALLY COMPLETED  
**Date:** 2026-03-15  
**Last Reviewed:** 2026-03-22  
**Implemented In:** feature/campaigns-by-channel-alignment  
**Owner:** Alberto Hilal  
**Workspace:** LeadMaster  
**Depends on:** ADR-001 / Contratos HTTP Email / Arquitectura Canal Email / Cierre end-to-end 2026-03-15

---

## 1. Estado de la fase

La Phase 4B ya no debe leerse como una fase solamente fundacional o documental.

Estado real actual:

- la subfase técnica de transporte e integración quedó resuelta
- el canal Email quedó operativo end-to-end en modo prueba
- la fase completa no puede considerarse cerrada comercialmente
- el principal pendiente ya no es el transporte, sino la capa de datos email

Lectura correcta del estado:

- fase técnicamente avanzada
- cierre técnico parcial alcanzado
- cierre funcional/comercial total aún pendiente

---

## 2. Objetivo

Alinear el plan de la Phase 4B del canal Email con el estado real actual del proyecto, después de haber cerrado la integración end-to-end en modo prueba.

Este documento deja explícito:

- qué partes de la fase ya quedaron implementadas
- qué partes permanecen pendientes
- cuál fue el cierre efectivo de la subfase técnica
- cuál es la próxima subfase lógica
- por qué la fase no puede darse por totalmente terminada

El objetivo de esta etapa sigue siendo consolidar el canal Email como una capacidad real de prospección dentro de LeadMaster, pero sin sobredimensionar su madurez comercial actual.

---

## 3. Componentes ya implementados

Los siguientes componentes ya existen y forman parte del estado real de la fase:

### 3.1 Servicio standalone `leadmaster-mailer`

Implementado en `services/mailer`.

Capacidades actualmente disponibles:

- `GET /health`
- `POST /send`
- validación de payload técnico
- resolución SMTP por cliente
- fallback SMTP opcional
- auditoría/persistencia de envíos

### 3.2 Gateway autenticado de `central-hub`

Implementado en `central-hub`.

Capacidades actualmente disponibles:

- endpoint `POST /mailer/send`
- autenticación JWT obligatoria
- resolución de `cliente_id` desde el usuario autenticado
- delegación HTTP hacia `leadmaster-mailer`
- control tenant en frontera autenticada

### 3.3 UI inicial de Email en `central-hub`

Implementada sobre la pantalla real de selección de prospectos.

Capacidades actualmente disponibles:

- selección común de prospectos
- visualización de disponibilidad de email
- preparación inicial de envío Email
- envío manual en modo prueba sobre selección actual
- persistencia de recipients por campaña Email
- prepare de campaña Email para pasar de borrador a operación controlada
- scheduler secuencial de campañas Email
- operación uno a uno por destinatario

### 3.4 Base de configuración SMTP por cliente

Uso real implementado:

- resolución SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`

### 3.5 Auditoría operativa

Uso real implementado:

- registro técnico del envío en `ll_envios_email`
- reutilización de la misma fila técnica mediante `envio_email_id` en la integración con `leadmaster-mailer`

### 3.6 Tests reales del flujo backend

Uso real implementado:

- tests reales en `central-hub` para recipients, prepare, stats, scheduler y compatibilidad con `POST /api/email/send`
- tests reales en `services/mailer` para `emailLogRepository`, `mailerService` y compatibilidad con `envio_email_id`

---

## 4. Validaciones realizadas

Durante la fase quedaron validadas las siguientes condiciones técnicas:

- existencia del servicio standalone `leadmaster-mailer`
- disponibilidad operativa de `GET /health` y `POST /send`
- integración HTTP real `central-hub` → `leadmaster-mailer`
- exposición del gateway `POST /mailer/send` en `central-hub`
- exigencia de JWT en el gateway
- resolución de `cliente_id` desde usuario autenticado
- resolución SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- auditoría/persistencia de envíos
- existencia de UI inicial para selección común de prospectos y preparación de Email
- validación con envío real en modo prueba

Resultado práctico:

- la cadena UI → `central-hub` → `leadmaster-mailer` → SMTP quedó funcional
- el backend de campañas Email por destinatario quedó operativo con prepare, scheduler y persistencia por fila

---

## 5. Alcance efectivamente cerrado

La subfase técnica efectivamente cerrada comprende:

- servicio standalone de envío disponible y operativo
- integración HTTP con `central-hub`
- frontera autenticada del hub para Email
- resolución multi-tenant por `cliente_id`
- configuración SMTP por cliente
- persistencia/auditoría técnica
- interfaz inicial para operar envío manual en modo prueba

Conclusión de cierre parcial:

- el transporte y la integración técnica del canal quedaron resueltos para esta etapa
- el flujo backend de campañas Email ya no debe ser leído como “solo transporte + prueba manual”

---

## 6. Pendientes reales

Los pendientes que siguen abiertos no están en el transporte, sino en la maduración operativa del canal.

Pendientes reales:

- cobertura útil de emails en la base operativa de prospectos
- adquisición y enriquecimiento de emails
- normalización e higiene de datos email
- madurez operativa/comercial de la experiencia más allá del flujo backend ya cerrado
- endurecimiento semántico y robustez final de UI sobre la operación por canal

Pendientes explícitamente fuera del cierre técnico actual:

- dashboard comercial de campañas Email
- explotación masiva del canal
- automatizaciones avanzadas
- reporting comercial completo

---

## 7. Limitación principal actual

La limitación principal de la fase ya no es el envío ni la integración técnica.

La limitación dominante es:

- la disponibilidad/enriquecimiento de emails

Lectura real del problema:

- el canal ya puede enviar correctamente cuando existe email válido
- la base actual no ofrece cobertura suficiente para escalar el canal de forma comercial
- sin resolver la capa de datos, cualquier evolución comercial tendrá bajo rendimiento práctico

Conclusión:

- el cuello de botella actual es la capa de datos email, no el transporte

---

## 8. Próxima subfase recomendada

La próxima subfase lógica debe enfocarse en datos y operatividad, no en reinvertir esfuerzo en transporte.

Prioridades recomendadas:

1. diseñar estrategia de adquisición de emails
2. definir proceso de enriquecimiento de emails
3. establecer pipeline de validación, normalización e higiene
4. aumentar cobertura de emails útiles en la base operativa
5. evolucionar la UI desde modo prueba manual hacia operación más robusta

Regla de secuencia:

- el dashboard comercial no forma parte de esta subfase
- primero debe resolverse disponibilidad de datos

---

## 9. Criterio de cierre futuro de la fase completa

La Phase 4B podrá considerarse realmente cerrada cuando se cumplan, además del cierre técnico ya alcanzado, las siguientes condiciones:

- exista cobertura útil de emails sobre una base operativa real
- exista proceso verificable de adquisición/enriquecimiento de emails
- la operación del canal deje de depender de casos aislados con email ya presente
- la UI y la operación soporten uso sostenido más allá de prueba manual
- el canal pueda sostener explotación operativa mínima sin depender de parches manuales de datos

Importante:

- el criterio de cierre futuro no exige dashboard comercial completo
- sí exige que el canal deje de estar bloqueado por falta estructural de datos email

---

## 10. Conclusión

La Phase 4B avanzó más allá de la etapa fundacional y ya cuenta con un cierre técnico efectivo de su subfase de integración y transporte.

Hoy el proyecto ya tiene:

- standalone `leadmaster-mailer`
- gateway autenticado `POST /mailer/send` en `central-hub`
- resolución de `cliente_id` desde JWT
- resolución SMTP por cliente
- auditoría de envíos
- UI inicial para operar Email en modo prueba
- validación con envío real
- recipients persistidos por campaña
- prepare de campaña Email
- scheduler secuencial por destinatario
- operación uno a uno con delays y retries básicos
- soporte `envio_email_id` entre `central-hub` y `leadmaster-mailer`
- tests reales en `central-hub` y `mailer` para este flujo

Sin embargo, la fase completa todavía no debe considerarse terminada.

La razón es concreta:

- falta resolver la capa de datos email necesaria para operar a escala útil

La lectura correcta del estado de la fase es entonces:

- subfase técnica cerrada
- fase completa aún abierta por limitación de datos

Ese es el punto real del proyecto al 2026-03-15.
