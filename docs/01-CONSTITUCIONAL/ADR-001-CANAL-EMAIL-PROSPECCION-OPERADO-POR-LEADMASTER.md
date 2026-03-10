# ADR-001 — Canal Email de Prospección Operado por LeadMaster

**Status:** APPROVED  
**Date:** 2026-03-10  
**Owner:** Alberto Hilal  
**Approved by:** Alberto Hilal  
**Approved on:** 2026-03-10  
**Scope:** LeadMaster Workspace / Central Hub / Nuevo canal de prospección por email

---

## 1. Contexto

LeadMaster nació con foco operativo fuerte en WhatsApp, pero la evolución del negocio y la incorporación de nuevos clientes requieren formalizar un canal de prospección por email.

Este canal no debe entenderse como un simple envío masivo de correos ni como una copia exacta del flujo de WhatsApp. El objetivo es mantener la lógica comercial general del sistema:

1. detectar leads
2. abrir contacto
3. clasificar interés
4. derivar solo cuando exista señal suficiente de interés

En el modelo actual de trabajo, la base de leads no es provista por el cliente como insumo principal, sino que es obtenida y trabajada por LeadMaster a través de herramientas y procesos propios, especialmente `desarrolloydisenio-api`.

Por lo tanto, el valor del sistema no reside únicamente en el envío, sino en la combinación de:

- captación de base
- segmentación
- contacto inicial
- preclasificación
- derivación comercial

Esto obliga a definir claramente quién controla:

- la base fuente
- el canal inicial de contacto
- el inbox de respuesta
- la decisión de derivación

---

## 2. Problema

Si el canal email se implementa usando directamente la casilla del cliente o cediendo el inbox completo desde el inicio, LeadMaster pierde control sobre:

- el embudo inicial
- la clasificación de respuestas
- la protección de la base operativa
- la consistencia del proceso comercial

Además, si se modela email como una simple extensión técnica del módulo WhatsApp, se distorsiona su naturaleza: WhatsApp es un canal conversacional inmediato; email es un canal de apertura, legitimación y espera de señal.

Se necesita entonces una decisión arquitectónica y operativa que preserve el modelo de negocio de LeadMaster.

---

## 3. Decisión

Se decide que el canal email de prospección será operado inicialmente por LeadMaster bajo las siguientes reglas:

### 3.1 Propiedad y control de base
La base de leads utilizada para prospección inicial es generada, enriquecida o segmentada por LeadMaster.

El cliente no recibe automáticamente la base cruda ni acceso irrestricto al flujo operativo inicial.

### 3.2 Operación del primer contacto
LeadMaster ejecuta el primer contacto por email como operador del canal.

Esto incluye:

- selección de leads
- envío inicial
- recepción de respuestas
- clasificación inicial
- registro operativo

### 3.3 Derivación selectiva
El cliente recibe únicamente los leads o conversaciones que hayan alcanzado un umbral suficiente de interés.

Regla base:

> Lead detectado ≠ lead derivado  
> Solo se deriva cuando hay interés validado o señal comercial suficiente.

### 3.4 Naturaleza del canal
El canal email se modela como **canal de apertura y preclasificación**, no como simple duplicación del flujo de WhatsApp.

### 3.5 Identidad de marca
Siempre que sea viable, el email debe presentarse con identidad coherente con la marca del cliente.

Sin embargo, la identidad visible del remitente no implica necesariamente cesión del inbox o del control operativo al cliente.

### 3.6 Landing
El canal email se considera, salvo excepciones justificadas, acoplado a una landing, sitio o activo web que permita:

- validar identidad de marca
- ampliar propuesta
- medir interés
- sostener la legitimidad del contacto

---

## 4. Alternativas consideradas

### A. Usar directamente la casilla del cliente
**Ventajas**
- máxima identidad de marca
- apariencia más institucional

**Desventajas**
- el cliente ve el flujo completo
- LeadMaster pierde control de clasificación
- se debilita la propuesta de valor
- aumenta el riesgo de intervención desordenada

**Resultado:** descartada como diseño inicial por incompatibilidad con el modelo operativo de LeadMaster.

---

### B. Usar una casilla genérica propia de LeadMaster para todos los clientes
**Ventajas**
- implementación rápida
- control total del inbox
- baja dependencia técnica

**Desventajas**
- imagen de marca débil
- mayor riesgo de apariencia genérica
- peor escalabilidad comercial
- menor legitimidad frente a leads B2B

**Resultado:** aceptable solo como solución transitoria o MVP muy inicial.

---

### C. Operación LeadMaster con identidad de marca del cliente
**Ventajas**
- preserva control del embudo
- mejora legitimidad de marca
- protege la base y la clasificación
- equilibra operación y presentación comercial

**Desventajas**
- requiere mayor orden técnico
- puede requerir coordinación de DNS, dominio, landing o proveedor de envío

**Resultado:** opción adoptada como dirección arquitectónica preferida.

---

## 5. Consecuencias

### 5.1 Consecuencias positivas
- LeadMaster conserva control del embudo inicial
- se protege el activo principal del sistema
- se refuerza el valor comercial de “lead generation operada”
- el cliente recibe leads derivados en lugar de ruido operativo
- el sistema puede evolucionar de WhatsApp-first a multicanal sin perder coherencia

### 5.2 Costos / complejidades
- hay que definir requisitos mínimos para clientes
- hay que crear nueva documentación de arquitectura y contratos
- se requiere modelar identidad, proveedor, landing e inbox por separado
- la entregabilidad exige condiciones técnicas mínimas

### 5.3 Restricciones
- no se garantiza bandeja principal al 100%
- no se admite, por defecto, cesión temprana del inbox bruto al cliente
- no se admite modelar email como mero alias funcional de WhatsApp

---

## 6. Principios operativos derivados

1. **LeadMaster genera o controla la base operativa inicial.**
2. **LeadMaster controla el primer contacto del canal email.**
3. **El cliente recibe leads derivados, no necesariamente el flujo bruto.**
4. **La marca visible puede ser del cliente sin ceder el control operativo.**
5. **Landing e identidad de envío son parte del sistema, no accesorios opcionales.**
6. **El canal email debe documentarse como nueva etapa funcional del workspace.**

---

## 7. Impacto en arquitectura

Esta decisión implica que el canal email no debe resolverse como un simple parche en `sender`, sino como un nuevo canal con definición propia.

Dirección recomendada:

- `central-hub` mantiene autenticación, contexto de cliente y orquestación
- un servicio específico de mailer ejecuta la entrega
- la lógica de negocio sigue centralizada en LeadMaster
- el cliente entra al flujo solo en etapa de derivación

---

## 8. Impacto en documentación

Este ADR habilita y ordena la creación de los siguientes documentos:

- `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`
- `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
- `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`
- `docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md`

---

## 9. Estado de aprobación

**Estado actual:** APPROVED  
**Approved by:** Alberto Hilal  
**Approved on:** 2026-03-10

Confirmación (criterios aprobados):

- que LeadMaster controla el primer contacto por email
- que la base operativa no se entrega cruda por defecto al cliente
- que la derivación selectiva es parte constitutiva del producto
- que el canal email se abre como nueva etapa formal del proyecto

---

## 10. Nota final

Este documento define una decisión de arquitectura y negocio.

No define implementación técnica detallada, proveedor específico, estructura final de base de datos ni UI final.

Es un documento constitucional para fijar límites y dirección antes de codificar.