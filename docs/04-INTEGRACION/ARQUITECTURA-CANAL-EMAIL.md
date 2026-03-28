# Arquitectura del Canal Email — LeadMaster

**Version:** 2.0  
**Status:** IMPLEMENTED  
**Date:** 2026-03-15  
**Owner:** Alberto Hilal  
**Depends on:** ADR-001 / Phase 4B / End-to-End Email 2026-03-15

---

## 1. Objetivo

Alinear la arquitectura documental del canal Email con el estado real actual del sistema, luego del cierre de la integración end-to-end en modo prueba.

Este documento deja asentado:

- cuál es el propósito real del canal Email dentro de LeadMaster
- qué componentes existen hoy en producción técnica de prueba
- cómo fluye actualmente el envío end-to-end
- dónde están las fronteras de responsabilidad entre UI, gateway, mailer y datos
- cuál es la limitación dominante del canal en el estado actual

El objetivo no es describir una arquitectura puramente conceptual ni presentar el canal como una operación comercial ya escalada. El punto exacto de esta arquitectura es el siguiente:

- el canal Email está técnicamente operativo en modo prueba
- la escala real del canal sigue limitada por disponibilidad y enriquecimiento de emails

---

## 2. Alcance

Esta arquitectura documenta el estado operativo actual del canal Email dentro de `leadmaster-workspace`.

Incluye:

- UI inicial de `central-hub` para selección común de prospectos y preparación de Email
- gateway autenticado `POST /mailer/send` expuesto por `central-hub`
- servicio standalone `leadmaster-mailer`
- resolución SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- auditoría/persistencia en `ll_envios_email`
- flujo validado con envío real en modo prueba

No incluye:

- dashboard comercial maduro de campañas Email
- automatización masiva avanzada
- enriquecimiento automático masivo de emails
- explotación comercial a escala del canal
- arquitectura final de crecimiento basada en cobertura completa de datos

Documentos de referencia ya cerrados para este estado:

- `docs/05-REPORTES/2026-03/REPORTE-INTEGRACION-END-TO-END-EMAIL-CENTRAL-HUB-MAILER-2026-03-15.md`
- `docs/07-CONTRATOS/Contratos-HTTP-Central-Hub-Mailer-Gateway.md`
- `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`

---

## 3. Componentes de arquitectura

### 3.1 UI de `central-hub`

La UI actual es la primera capa operativa del canal Email.

Responsabilidades actuales:

- permitir selección común de prospectos
- mostrar disponibilidad por canal, incluyendo email
- mantener filtros, tabla, checkboxes y conteos de selección
- permitir preparación manual de un envío Email sobre la selección actual
- enviar al gateway autenticado del hub únicamente los datos funcionales del envío

Estado real:

- existe una UI inicial operativa
- no es todavía un dashboard comercial completo
- no es una herramienta de explotación masiva autónoma

### 3.2 Gateway Email de `central-hub`

`central-hub` expone la frontera autenticada del canal Email mediante:

- `POST /mailer/send`

Responsabilidades actuales:

- autenticar por JWT
- obtener `cliente_id` desde el usuario autenticado
- validar el body funcional del request
- ignorar `cliente_id` si fuera enviado por el caller
- delegar el envío al standalone `leadmaster-mailer`

Estado real:

- la integración HTTP `central-hub` → `leadmaster-mailer` está implementada
- el gateway ya fue validado con envío real

### 3.3 Servicio standalone `leadmaster-mailer`

Es el motor técnico real del envío.

Endpoints actuales:

- `GET /health`
- `POST /send`

Responsabilidades actuales:

- recibir requests internos desde `central-hub`
- validar payload técnico
- resolver SMTP por `cliente_id`
- ejecutar el envío real
- devolver resultado técnico
- registrar auditoría/persistencia

Estado real:

- el standalone existe y está operativo
- no es la frontera autenticada consumida por frontend

### 3.4 Base de configuración SMTP por cliente

La resolución SMTP multi-tenant depende de la tabla:

- `iunaorg_dyd.ll_clientes_email_config`

Responsabilidad arquitectónica:

- almacenar configuración SMTP activa por cliente
- permitir que el mailer resuelva identidad técnica de envío por tenant

Rol dentro de la arquitectura:

- desacoplar la operación comercial del detalle de infraestructura SMTP
- permitir aislamiento multi-cliente a nivel de envío

### 3.5 Auditoría/persistencia de envíos

La auditoría técnica del canal se registra en:

- `ll_envios_email`

Responsabilidad arquitectónica:

- persistir el intento de envío
- registrar resultado técnico
- dejar trazabilidad mínima de operación

Rol dentro de la arquitectura:

- garantizar evidencia operativa del canal
- sostener análisis técnico y diagnóstico de fallas

---

## 4. Flujo end-to-end actual

El flujo operativo real del canal Email es el siguiente:

1. el usuario autenticado entra a `central-hub`
2. desde la UI filtra y selecciona prospectos en una selección común de destinatarios
3. la UI identifica qué prospectos tienen email disponible y cuáles no
4. el usuario abre la preparación de envío Email
5. la UI prepara asunto, cuerpo y destinatarios válidos
6. la UI invoca `POST /mailer/send` en `central-hub`
7. `central-hub` valida JWT y resuelve `cliente_id` desde el usuario autenticado
8. `central-hub` construye el request interno hacia `leadmaster-mailer`
9. `leadmaster-mailer` recibe el payload técnico y valida el contrato standalone
10. `leadmaster-mailer` resuelve SMTP por cliente usando `iunaorg_dyd.ll_clientes_email_config`
11. el mailer registra auditoría `PENDING` en `ll_envios_email`
12. el mailer ejecuta el envío SMTP real
13. el mailer actualiza auditoría a `SENT` o `FAILED`
14. la respuesta vuelve a `central-hub`
15. `central-hub` responde a la UI con el resultado del envío

Conclusión del flujo:

- la cadena UI → gateway → standalone → SMTP → auditoría quedó operativa
- el cierre técnico de la fase quedó validado en modo prueba con envío real

---

## 5. Fronteras y responsabilidades

### 5.1 Diferencia entre gateway y standalone

La separación entre gateway y standalone es central en esta arquitectura.

#### Gateway de `central-hub`

Función:

- frontera autenticada del sistema para el canal Email

Responsabilidades:

- autenticar usuario
- resolver `cliente_id` desde JWT
- validar body funcional
- controlar el contexto tenant
- delegar al servicio técnico interno

#### Standalone `leadmaster-mailer`

Función:

- ejecutor técnico real del envío

Responsabilidades:

- recibir `cliente_id` como dato técnico interno
- resolver SMTP por cliente
- construir/transaccionar el envío
- auditar el resultado técnico

Regla arquitectónica:

- el frontend no debe llamar directamente al standalone
- el frontend debe consumir el gateway autenticado de `central-hub`

### 5.2 UI

La UI actual no define infraestructura ni seguridad tenant.

Su responsabilidad es:

- habilitar operación humana controlada
- preparar envíos sobre selección común
- reflejar disponibilidad de datos por canal

### 5.3 Datos

La capa de datos cumple dos roles distintos:

- configuración SMTP por cliente
- disponibilidad de emails en prospectos

Estos roles no deben mezclarse.

- la configuración SMTP ya sostiene el transporte
- la disponibilidad de emails en prospectos determina la escalabilidad real del canal

---

## 6. Datos y dependencias

El canal depende actualmente de dos familias principales de datos.

### 6.1 Datos de infraestructura SMTP

Fuente principal:

- `iunaorg_dyd.ll_clientes_email_config`

Uso:

- resolver host, puerto, seguridad, credenciales e identidad de envío por `cliente_id`

### 6.2 Datos operativos de prospectos

Fuente funcional:

- registros de prospectos disponibles para selección en `central-hub`

Uso:

- determinar si existe email operable por prospecto
- habilitar o bloquear preparación real de envío

### 6.3 Dependencia de auditoría

Fuente de trazabilidad:

- `ll_envios_email`

Uso:

- registrar estado técnico del envío
- sostener observabilidad operativa mínima

Lectura arquitectónica clave:

- el transporte ya tiene soporte técnico
- la escalabilidad del canal depende ahora de la calidad, cobertura y enriquecimiento del dato email

---

## 7. Estado actual

Estado arquitectónico vigente:

- el servicio standalone `leadmaster-mailer` existe
- el standalone expone `GET /health` y `POST /send`
- `central-hub` integra mailer vía HTTP
- `central-hub` expone el gateway autenticado `POST /mailer/send`
- el gateway requiere JWT
- `cliente_id` se resuelve desde el usuario autenticado
- `leadmaster-mailer` resuelve SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- el flujo fue validado con envío real
- existe una UI inicial para selección común de prospectos y preparación de envío Email

Conclusión de estado:

- el canal Email está técnicamente operativo end-to-end en modo prueba
- el canal no debe describirse todavía como operación comercial escalada

### AS-IS validación operativa 2026-03-28

Además de la integración de transporte validada al 2026-03-15, el flujo de campañas Email por destinatario quedó validado end-to-end el 2026-03-28 con la siguiente cadena ejecutada en operación real:

```
create campaña → addRecipients → prepare → scheduler secuencial → mailer (SMTP) → SENT → finalize campaña
```

Componentes adicionales validados que complementan la arquitectura documentada en este archivo:

- persistencia de campaña Email en `ll_campanias_email` como cabecera operativa
- persistencia por destinatario en `ll_envios_email` como cola operativa y resultado final
- prepare que resuelve sender desde `ll_clientes_email_config` y agenda el primer destinatario
- scheduler secuencial que procesa uno a uno con delays random y retries básicos
- integración con `leadmaster-mailer` reutilizando `envio_email_id` de la fila existente en `ll_envios_email`
- transición real PENDING → SENT confirmada en ambos envíos
- finalización automática de campaña y sincronización de stats
- recepción real confirmada en bandejas controladas vía Gmail

Evidencia: campaña id=4 ("E2E Persistencia Email 2026-03-28"), 2 destinatarios, 2 SENT, 0 fallidos.

Hallazgo residual: se observó desalineación de ~1h entre timestamps de DB y hora local percibida por el operador. Diagnóstico preliminar y follow-up documentados en `docs/05-REPORTES/2026-03/REPORTE-CIERRE-E2E-CAMPANAS-EMAIL-2026-03-28.md`.

Las limitaciones de cobertura de datos email y madurez comercial documentadas en las secciones 8 y 9 de este documento siguen vigentes.

---

## 8. Limitaciones actuales

La limitación principal del canal ya no es el transporte.

Limitaciones observadas:

- la base actual no dispone de cobertura operativa suficiente de emails para explotación masiva
- no existe enriquecimiento automático masivo de emails
- la UI implementada es inicial y manual
- no existe todavía una capa madura de operación comercial de campañas
- la escalabilidad del canal sigue frenada por disponibilidad y calidad del dato email

Conclusión arquitectónica de limitación:

- el cuello de botella actual es la disponibilidad/enriquecimiento de emails, no el envío

---

## 9. Próxima evolución recomendada

La siguiente evolución arquitectónica debe enfocarse en datos, no en transporte.

Prioridades recomendadas:

1. diseñar estrategia de adquisición y enriquecimiento de emails
2. definir pipeline de validación, normalización e higiene del dato email
3. aumentar cobertura real de emails sobre la base operable de prospectos
4. evolucionar la UI desde preparación manual a operación controlada más robusta
5. recién después evaluar componentes comerciales más avanzados

Regla de evolución:

- no tiene sentido escalar la complejidad comercial del canal si todavía no existe suficiente densidad operativa de emails válidos

---

## 10. Conclusión

La arquitectura del canal Email ya no debe leerse como una intención conceptual futura. Debe leerse como una arquitectura implementada y validada operativamente.

Hoy el sistema ya cuenta con:

- UI inicial en `central-hub`
- gateway autenticado en `central-hub`
- servicio standalone `leadmaster-mailer`
- resolución SMTP multi-tenant por cliente
- auditoría/persistencia técnica de envíos
- validación real del flujo end-to-end de transporte (2026-03-15)
- validación real del flujo end-to-end de campañas Email persistidas con scheduler, finalización automática y recepción confirmada (2026-03-28)

El punto real de esta arquitectura es claro:

- canal técnicamente operativo con capacidad E2E validada
- pendiente de escala por datos y madurez comercial

La siguiente etapa correcta no consiste en reinventar el transporte, sino en resolver la disponibilidad y el enriquecimiento de emails para que el canal pueda convertirse en una operación realmente explotable a escala.
