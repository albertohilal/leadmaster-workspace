Perfecto.
Vamos a hacer foco real.

Te propongo una **versión simplificada, estratégica y alineada con tu momento actual**.
Sin expansión innecesaria.
Sin sobre-ingeniería.
Solo lo que corresponde ahora.

Podés reemplazar el documento actual por esto.

---

# AI-LISTENER-EVOLUTION-PLAN.md

**Ubicación:** `docs/06-FASES/AI-LISTENER-EVOLUTION-PLAN.md`
**Estado:** Activo – Fase Experimental
**Fecha:** 2026-02-24

---

# 1. Contexto Actual

LeadMaster opera hoy con:

* Máquina de estados determinística estable (`pendiente`, `enviado`, `error`)
* Envíos limitados manualmente
* Listener básico sin clasificación automática
* Corrección de datos realizada manualmente

Se detectó un caso de **reciclado de número telefónico**:

* Número válido técnicamente
* Pero perteneciente a otra persona
* Corrección realizada manualmente tras investigación

Este evento revela una necesidad futura, pero **no justifica expandar la arquitectura ahora**.

---

# 2. Problema Detectado

El sistema no puede detectar automáticamente:

* "No soy esa persona"
* "Se equivocaron de número"
* Reclamos por identidad incorrecta

Actualmente:

* La detección es manual
* No hay clasificación estructurada
* No hay registro formal de incidente

---

# 3. Riesgo Principal

La incorporación de IA puede generar:

* Complejidad arquitectónica infinita
* Contaminación de la máquina de estados
* Acoplamiento indebido entre listener y lógica comercial
* Automatización prematura

**Regla estratégica:**

> La IA no debe gobernar el sistema. Solo clasificar.

---

# 4. Principio Arquitectónico Firme

Separación estricta:

### Capa determinística (actual)

* Sender
* Listener
* Estados
* Base de datos
* Transacciones

### Capa generativa (futura)

* Servicio aislado
* Solo clasifica texto
* Devuelve categoría cerrada
* No ejecuta acciones
* No modifica BD

---

# 5. Fase Actual (Activa)

Duración: próximos días

### Operativa

* Máximo 5 envíos por día
* Observación manual de respuestas
* Correcciones manuales en `llxbx_societe`
* Registrar informalmente incidentes

### Objetivo

Validar comportamiento real del canal antes de automatizar.

No se implementa:

* Clasificación automática
* Acciones automáticas
* Nuevas tablas
* Sistema de aprobación

---

# 6. Fase Futuro Cercano (Cuando el canal esté estable)

Implementar módulo aislado:

```
/services/ai-listener-classifier
```

Contrato simple:

Input:

```
mensaje
```

Output:

```
INTERES
NO_INTERES
RECICLADO
CONSULTA_GENERAL
AGRESIVO
INDETERMINADO
```

Nada más.

La acción posterior seguirá siendo determinística.

---

# 7. Condición para Escalar Envíos

No se aumenta volumen si no se cumplen:

* Canal estable
* Respuestas clasificables con claridad
* Tasa baja de incidentes críticos
* Confianza operativa

Escalado máximo permitido sin IA:
→ 5 envíos/día

Escalado posterior será progresivo y validado.

---

# 8. Límite de Complejidad Permitido

Este proyecto NO es:

* Un CRM conversacional completo
* Un bot autónomo
* Un sistema de negociación automática

Es:

> Un motor de generación y validación de prospectos B2B.

La IA debe mantenerse como herramienta auxiliar.

---

# 9. Decisión Estratégica

Ahora:

* Foco en estabilidad.
* Foco en control.
* Foco en aprendizaje manual.

Luego:

* Clasificador mínimo.
* Automatización limitada.
* Escalado gradual.

---

Documento deliberadamente acotado.
Cualquier expansión requiere revisión arquitectónica.

---

Esto está alineado con tu momento real.

Si querés, ahora podemos:

* Ajustar tono más técnico
* O dejarlo así y cerrar fase por hoy

Decime.
