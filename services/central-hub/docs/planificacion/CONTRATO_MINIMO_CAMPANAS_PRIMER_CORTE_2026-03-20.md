# CONTRATO MINIMO - Campanas WhatsApp primer corte controlado

## Fecha

2026-03-20

## Destino

services/central-hub/docs/planificacion/CONTRATO_MINIMO_CAMPANAS_PRIMER_CORTE_2026-03-20.md

## Alcance

Este documento ejecuta la Fase 3 del plan de intervencion y queda alineado con:

- `services/central-hub/docs/planificacion/REVISION_ARQUITECTONICA_CAMPANAS_INDEPENDIENTES_2026-03-21.md`

Su objetivo es definir el contrato minimo y consistente que backend y frontend deberian soportar en el primer corte controlado para el dominio campanas WhatsApp.

Este documento no propone implementacion detallada, no modifica codigo y no entra todavia en cambios de UI.

## Resumen ejecutivo

El primer corte necesita un contrato de campana pequeno, estable y compatible, pero solo para el dominio campañas WhatsApp.

La nueva definicion arquitectonica elimina de este corte la hipotesis de una campaña comun con `channel` para WhatsApp y Email dentro de la misma persistencia.

Por lo tanto:

- `ll_campanias_whatsapp` sigue siendo persistencia especializada de WhatsApp
- Email queda fuera de este contrato minimo como dominio separado
- el foco del primer corte es estabilizar el CRUD, los estados y los campos de campañas WhatsApp ya existentes

## 1. Shape minimo de campana WhatsApp

## 1.1 Principios del shape objetivo

El shape minimo del primer corte debe cumplir estas reglas:

- debe representar solo campañas WhatsApp
- debe alinearse con la especializacion de `ll_campanias_whatsapp`
- debe eliminar la hipotesis de una campaña comun multicanal en esta tabla
- debe distinguir entre definicion de campaña y metricas de ejecucion
- debe mantener el contrato lo suficientemente corto para alinear backend y frontend primero

## 1.2 Shape comun objetivo

Campos minimos propuestos:

- `id`
- `nombre`
- `descripcion`
- `mensaje`
- `estado`
- `programada`
- `fecha_envio`
- `cliente_id`
- `fecha_creacion`
- `fecha_actualizacion`

Criterio de cada campo:

- `id`: identificador de campaña
- `nombre`: nombre visible de la campaña
- `descripcion`: texto descriptivo opcional
- `mensaje`: contenido base de la campaña WhatsApp
- `estado`: estado funcional expuesto del dominio campañas WhatsApp
- `programada`: bandera booleana de programacion
- `fecha_envio`: fecha/hora planificada cuando `programada = true`
- `cliente_id`: pertenencia multi-tenant
- `fecha_creacion`: trazabilidad basica
- `fecha_actualizacion`: trazabilidad de cambios

## 1.3 Campos que quedan fuera del primer corte

Quedan fuera del contrato minimo de campañas WhatsApp:

- `channel`
- `contenido` como estructura unificada multicanal
- `subject`
- `body`
- metricas agregadas de entrega en el shape comun de `create` y `update`
- `total_destinatarios`
- `enviados`
- `fallidos`
- `pendientes`
- `cliente_nombre`
- `fecha_modificacion` como alias paralelo de `fecha_actualizacion`
- payload de destinatarios
- datos de ejecucion de Session Manager
- cualquier dato de campañas Email

## 1.4 Shape objetivo de list

### Objetivo

`list` debe devolver solo el contrato minimo estable de campañas WhatsApp.

### Shape objetivo propuesto

```json
{
  "id": 123,
  "nombre": "Campana ejemplo",
  "descripcion": "Texto opcional",
  "mensaje": "Hola, te escribimos por WhatsApp",
  "estado": "pendiente_aprobacion",
  "programada": false,
  "fecha_envio": null,
  "cliente_id": 45,
  "fecha_creacion": "2026-03-20T10:00:00Z",
  "fecha_actualizacion": "2026-03-20T10:00:00Z"
}
```

Reglas para `list` en el primer corte:

- debe priorizar estabilidad del shape sobre riqueza de datos
- no debe depender de metricas no consolidadas para ser util
- no debe inventar campos de Email ni discriminadores multicanal

## 1.5 Shape objetivo de detail

### Objetivo

`detail` debe devolver el mismo shape comun completo de campañas WhatsApp.

### Shape objetivo propuesto

```json
{
  "id": 123,
  "nombre": "Campana WhatsApp",
  "descripcion": "Texto opcional",
  "mensaje": "Mensaje base de WhatsApp",
  "estado": "aprobada",
  "programada": true,
  "fecha_envio": "2026-03-21T14:00:00Z",
  "cliente_id": 45,
  "fecha_creacion": "2026-03-20T10:00:00Z",
  "fecha_actualizacion": "2026-03-20T10:30:00Z"
}
```

## 1.6 Shape objetivo de create

### Request objetivo propuesto

```json
{
  "nombre": "Campana ejemplo",
  "descripcion": "Texto opcional",
  "mensaje": "Hola, te escribimos por WhatsApp",
  "programada": false,
  "fecha_envio": null
}
```

Reglas:

- `nombre` obligatorio
- `mensaje` obligatorio
- `descripcion` opcional
- `programada` obligatorio como booleano
- `fecha_envio` obligatorio solo si `programada = true`

### Response objetivo propuesto

Debe devolver el mismo shape comun persistido, sin inventar campos de otros canales.

## 1.7 Shape objetivo de update

### Request objetivo propuesto

Debe usar el mismo shape estructural de `create`, restringido a los campos editables:

```json
{
  "nombre": "Campana actualizada",
  "descripcion": "Texto opcional",
  "mensaje": "Nuevo mensaje base",
  "programada": true,
  "fecha_envio": "2026-03-22T15:00:00Z"
}
```

Reglas:

- `id` via path param
- no debe aceptar un shape distinto del que luego se persiste
- no debe devolver un shape mas rico que el realmente consolidado
- el criterio de editabilidad queda gobernado por la matriz minima de estados definida en esta fase

## 2. Estados minimos consistentes de campañas WhatsApp

## 2.1 Criterio general

El primer corte no debe sostener la multiplicidad actual de estados expuestos hacia frontend.

Se propone una matriz minima, corta y compatible para campañas WhatsApp:

- `pendiente_aprobacion`
- `aprobada`
- `finalizada`

## 2.2 Criterio para create

Regla:

- toda campaña creada entra en `pendiente_aprobacion`

Razon:

- mantiene continuidad con la semantica ya visible en la UI
- evita ambiguedad entre `pendiente` y `pendiente_aprobacion`
- no fuerza una migracion abstracta innecesaria de estados en este corte

## 2.3 Criterio para approve

Regla:

- `approve` transforma `pendiente_aprobacion` en `aprobada`

Razon:

- alinea lenguaje de negocio y lectura de UI
- evita mezclar `en_progreso` como si fuera aprobacion de campaña

## 2.4 Criterio para update

Regla:

- si una campaña editable se actualiza, vuelve a `pendiente_aprobacion`

Razon:

- conserva el criterio actual de revalidacion tras cambios
- mantiene el modelo simple dentro del dominio WhatsApp

## 2.5 Compatibilidad con estados hoy usados

Mapeo semantico de compatibilidad sugerido para el primer corte:

- `pendiente` -> `pendiente_aprobacion`
- `pendiente_aprobacion` -> `pendiente_aprobacion`
- `programada` -> `aprobada`
- `en_progreso` -> `aprobada`
- `aprobada` -> `aprobada`
- `activa` -> `aprobada`
- `finalizado` -> `finalizada`
- `completada` -> `finalizada`

Estados que no deben formar parte del contrato minimo expuesto del primer corte:

- `pausada`
- `rechazada`
- `enviando`

## 3. Compatibilidad hacia atras

## 3.1 Campanas existentes de WhatsApp

Criterio:

- toda campaña existente en `ll_campanias_whatsapp` debe seguir leyendose como campaña valida del dominio WhatsApp

## 3.2 Defaults si faltan columnas o campos

Defaults de compatibilidad para el primer corte:

- `descripcion`: `''`
- `programada`: `false`
- `fecha_envio`: `null`
- `fecha_actualizacion`: usar `fecha_creacion` si no existe otro dato verificable

## 3.3 Como evitar romper el flujo actual

Criterios de compatibilidad:

- no introducir `channel` en el contrato de campañas WhatsApp de este corte
- no introducir contenido de Email en `ll_campanias_whatsapp`
- no depender de metricas para que `list` y `detail` sean validos
- tratar estados legacy mediante normalizacion semantica antes de exponerlos al frontend

## 4. Alcance exacto del primer corte

## 4.1 Que entra en el primer corte

Entra en el primer corte:

- consolidacion del shape comun de campañas WhatsApp
- regularizacion de `descripcion`, `programada`, `fecha_envio` y `fecha_actualizacion`
- normalizacion de la matriz minima de estados expuestos
- compatibilidad hacia atras para campañas WhatsApp existentes
- alineacion contractual entre `list`, `detail`, `create` y `update`

## 4.2 Que no entra en el primer corte

No entra en el primer corte:

- campañas Email
- tabla comun multicanal
- discriminador `channel` dentro de `ll_campanias_whatsapp`
- subject/body de Email en esta persistencia
- delivery multicanal
- cambios en scheduler
- cambios en tablas operativas de envios
- rediseño amplio de UI

## 5. Criterio de compatibilidad final del primer corte

El primer corte debe considerarse contractual y compatible si cumple simultaneamente lo siguiente:

- una campaña legacy de WhatsApp puede seguir leyendose como campaña valida
- el frontend deja de depender de campos o estados contradictorios para crear, listar, detallar y editar
- el backend deja de inventar campos sin criterio contractual estable
- `list`, `detail`, `create` y `update` convergen a un mismo shape comun del dominio campañas WhatsApp
- `ll_campanias_whatsapp` sigue siendo tabla especializada de WhatsApp

## Conclusion

El contrato minimo del primer corte debe representar solo campañas WhatsApp.

No debe representar una campaña comun multicanal ni abrir la puerta a genericizar `ll_campanias_whatsapp`.

Su valor esta en estabilizar el dominio existente, proteger el flujo actual de WhatsApp y dejar Email fuera del primer corte como dominio independiente.

