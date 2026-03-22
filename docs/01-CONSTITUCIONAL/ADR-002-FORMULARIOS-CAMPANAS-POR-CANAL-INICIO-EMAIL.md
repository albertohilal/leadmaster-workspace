# ADR-002 — Formularios de Campañas por Canal, con Inicio en Email

**Status:** APPROVED
**Date:** 2026-03-21
**Scope:** LeadMaster Workspace / Central Hub / UI y flujo de creación de campañas por canal

---

## Contexto

Durante el trabajo reciente sobre el módulo de campañas se cerró un primer corte de saneamiento del dominio de campañas WhatsApp en `services/central-hub`.

Ese corte tuvo carácter conservador y estuvo orientado a:

* estabilizar el contrato actual de campañas WhatsApp
* alinear frontend y backend del flujo existente
* preservar la especialización del dominio WhatsApp
* evitar mezclar ese saneamiento con una convergencia multicanal prematura

Como resultado de ese cierre, quedó reafirmada la definición arquitectónica vigente:

* las campañas deben separarse por canal
* WhatsApp y Email deben tratarse como dominios independientes
* la separación por canal no debe quedar limitada a persistencia o backend

A partir de ese punto, continuar mezclando el cierre del primer corte con la implementación siguiente produciría ambigüedad de alcance, documentación confusa y mayor riesgo de deriva técnica.

Por esa razón, se decide abrir un frente nuevo y separado para llevar la separación por canal a la capa visible y operativa del producto, comenzando por el flujo de creación de campañas.

## Problema

La separación por canal ya quedó asumida a nivel arquitectónico y de saneamiento del dominio de campañas WhatsApp, pero todavía no está expresada de forma suficientemente operativa en la UI ni en el flujo de creación de campañas.

Si el siguiente paso se ejecuta sin una decisión explícita de proyecto:

* puede volver a mezclarse el saneamiento de WhatsApp con la implementación de Email
* puede reintroducirse una noción de campaña común demasiado temprano
* puede diluirse la frontera entre formularios, contratos y reglas de cada canal
* puede quedar una separación estructural en backend sin traducción clara en la experiencia de usuario

Se necesita entonces una decisión que fije el encuadre del nuevo frente y lo separe formalmente del cierre anterior.

## Decisión

Se decide abrir un frente nuevo y separado para implementar **formularios de campañas por canal**.

La primera implementación de este frente será un **formulario específico de creación de campaña Email**.

Reglas derivadas de esta decisión:

* el cierre del primer corte de campañas WhatsApp no debe mezclarse con este nuevo frente
* la separación por canal debe expresarse también en UI y en los flujos de creación
* Email será el primer caso de implementación visible en formularios por canal
* WhatsApp no se incorpora a este frente como objeto de implementación principal, salvo para definir límites, compatibilidades y criterios de no regresión
* este frente no debe interpretarse como una reapertura del debate sobre una campaña común multicanal

## Alcance de la decisión

Esta decisión alcanza:

* la definición del nuevo frente de trabajo posterior al cierre del primer corte WhatsApp
* la organización de tareas para formularios de campañas por canal
* el criterio de separación entre formularios de Email y de WhatsApp
* el encuadre de impacto en frontend, backend y documentación

Esta decisión no implica por sí misma:

* implementar de inmediato nueva persistencia
* rediseñar el dominio de campañas WhatsApp ya saneado
* modificar el delivery de WhatsApp o de Email
* reabrir `schema.sql` como parte del corte ya cerrado
* introducir una abstracción multicanal común a nivel de formulario sin validación previa

## Razones de la decisión

Las razones principales son:

1. el realineamiento por canal ya justifica un frente nuevo y autónomo
2. la separación por canal debe ser visible para el usuario final y no solo interna al sistema
3. el siguiente paso lógico, después del saneamiento contractual, es el flujo de creación por canal
4. Email es el mejor primer caso para materializar esa separación sin reabrir el saneamiento de WhatsApp
5. mantener este frente separado reduce el riesgo de contaminar el cierre previo con objetivos nuevos
6. la trazabilidad documental mejora si cada etapa queda registrada con su propio encuadre y criterio de aceptación

## Alternativas consideradas

### A. Continuar sobre el mismo frente de saneamiento ya cerrado

**Ventajas**

* menor cantidad de documentos nuevos
* continuidad inmediata del contexto técnico

**Desventajas**

* mezcla cierre con implementación nueva
* dificulta distinguir qué quedó efectivamente resuelto
* aumenta la ambigüedad sobre el alcance del primer corte
* vuelve más difícil auditar riesgos y resultados

**Resultado:** descartada.

### B. Implementar un formulario común para todos los canales

**Ventajas**

* apariencia de unificación temprana
* menos componentes iniciales

**Desventajas**

* contradice la definición vigente de dominios separados por canal
* empuja a abstraer demasiado pronto diferencias reales entre canales
* puede forzar contratos artificiales en backend y frontend
* aumenta el riesgo de volver a mezclar WhatsApp y Email

**Resultado:** descartada.

### C. Abrir un frente separado y empezar por Email

**Ventajas**

* convierte la separación estructural en separación operativa visible
* permite avanzar por canal con límites claros
* evita reabrir el cierre de WhatsApp
* favorece una iteración controlada y trazable

**Desventajas**

* exige nueva documentación y un nuevo recorte de trabajo
* requiere explicitar contratos y campos propios de Email antes de implementar

**Resultado:** opción adoptada.

## Consecuencias

### Consecuencias positivas

* el cierre del primer corte WhatsApp queda protegido y no se contamina con objetivos posteriores
* el proyecto gana una línea de trabajo clara para expresar la separación por canal en UI y flujos
* Email se transforma en el primer caso operativo visible del nuevo enfoque
* se reduce el riesgo de reintroducir una convergencia multicanal prematura

### Costos y complejidades

* será necesario relevar el estado actual del formulario de campañas antes de implementar
* habrá que distinguir con precisión campos comunes y campos exclusivos de Email
* deberá validarse el contrato backend necesario para creación de campañas Email
* deberá sostenerse compatibilidad documental y funcional con el límite vigente entre canales

## Próximos pasos

Las tareas iniciales del nuevo frente serán:

* relevar el estado actual del formulario de campañas
* definir campos comunes y campos exclusivos de Email
* validar el contrato backend para creación de campañas Email
* implementar un formulario específico de Email
* probar el flujo end-to-end
* generar un reporte de avance del frente

## Impacto en frontend

El impacto esperado en frontend es:

* dejar de asumir que la separación por canal se resuelve solo por datos o backend
* introducir una expresión visible y operativa de esa separación en el flujo de creación
* comenzar por un formulario específico de campaña Email
* mantener a WhatsApp fuera del foco de implementación de este frente, salvo para preservar límites ya establecidos y evitar regresiones

Esta decisión no obliga todavía a rediseñar toda la gestión de campañas, pero sí fija que la evolución visible debe avanzar por canal.

## Impacto en backend

El impacto esperado en backend es acotado en esta etapa de decisión:

* validar el contrato necesario para soportar creación de campañas Email
* evitar que el nuevo frente derive en una genericización apresurada del dominio de campañas
* mantener intacto el saneamiento ya consolidado de campañas WhatsApp mientras se releva el caso Email

Esta decisión no autoriza por sí sola cambios estructurales sobre persistencia compartida ni reabre el debate sobre una campaña común.

## Impacto en documentación

La documentación debe reflejar que:

* el primer corte de campañas WhatsApp queda cerrado como etapa separada
* se abre un nuevo frente enfocado en formularios por canal
* el primer caso de implementación será Email
* WhatsApp queda como referencia de límite y compatibilidad, no como objeto principal de este nuevo frente

También implica que futuros reportes de avance, diagnósticos y propuestas técnicas de este frente deben documentarse como una línea posterior y distinta del cierre previo.

## Riesgos a controlar

Los riesgos principales a controlar son:

* volver a mezclar el cierre de WhatsApp con el nuevo frente de Email
* introducir un formulario aparentemente común que reinstale acoplamiento entre canales
* definir campos de Email sin validar primero el contrato backend correspondiente
* abrir cambios de persistencia o schema sin un corte específico y justificado
* degradar la trazabilidad documental entre decisiones, implementación y reportes

## Criterios de aceptación del nuevo frente

Se considerará que el nuevo frente quedó correctamente encuadrado cuando se cumplan al menos estos criterios:

* existe un relevamiento documentado del estado actual del formulario de campañas
* están diferenciados los campos comunes y los campos exclusivos de Email
* el contrato backend para creación de campañas Email fue validado antes de implementar UI definitiva
* existe un formulario específico de creación de campaña Email
* el flujo de creación de Email puede probarse end-to-end sin mezclarlo con el dominio WhatsApp
* se genera documentación de avance del frente con trazabilidad suficiente

## Nota final

Esta decisión no documenta una implementación técnica cerrada ni compromete una solución final de persistencia para Email.

Su objetivo es fijar dirección, límites y encuadre operativo para la siguiente etapa del proyecto, evitando que el cierre del primer corte de campañas WhatsApp se mezcle con el nuevo trabajo de formularios por canal. 

---


