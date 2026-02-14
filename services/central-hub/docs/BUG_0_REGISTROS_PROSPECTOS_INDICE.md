# 📚 Índice de Documentación - Bug 0 Registros en Selector de Prospectos

> **Issue**: Selector de Prospectos retorna 0 registros al filtrar por campaña  
> **Fecha**: Febrero 2026  
> **Root Cause**: `INNER JOIN` con tabla vacía `ll_lugares_clientes`  
> **Estado**: ✅ Diagnosticado - ⏳ Pendiente implementación

---

## 🎯 Resumen Ejecutivo

El endpoint `/api/sender/prospectos/filtrar?campania_id={id}` retorna 0 registros cuando debería mostrar ~8,000+ prospectos disponibles. El problema fue identificado en una línea específica del controlador backend donde un `INNER JOIN` con la tabla `ll_lugares_clientes` (vacía para `cliente_id=51`) elimina todos los resultados.

**Solución**: Cambiar `INNER JOIN` a `LEFT JOIN` en línea 107-108 de `prospectosController.js`

---

## 📑 Documentos Disponibles

### 1️⃣ Diagnóstico Principal
**Archivo**: [DIAGNOSTICO_BUG_INNER_JOIN_LUGARES_CLIENTES.md](./DIAGNOSTICO_BUG_INNER_JOIN_LUGARES_CLIENTES.md)

**Contenido**:
- ❌ Síntoma principal del error
- 🔍 Root Cause Analysis completo
- 📊 Evidencia técnica (queries de diagnóstico)
- ✅ Solución propuesta con código exacto
- 🧪 Plan de pruebas
- 📝 Recomendaciones para prevención futura

**Cuándo consultarlo**:
- Entender el problema desde cero
- Necesitas el código exacto del fix
- Vas a presentar el issue a otro desarrollador
- Quieres ejecutar las queries de diagnóstico

---

### 2️⃣ Análisis de Cambios
**Archivo**: [ANALISIS_DIFF_BUG_0_REGISTROS.md](./ANALISIS_DIFF_BUG_0_REGISTROS.md)

**Contenido**:
- 📂 3 archivos modificados vs commit 7f61633 (última versión estable)
- 🔄 Diff detallado línea por línea
- ⚖️ Evaluación de mejoras vs problemas introducidos
- 💡 Hipótesis de por qué funcionaba antes
- 🎯 Identificación del cambio crítico

**Cuándo consultarlo**:
- Necesitas entender qué cambió exactamente
- Quieres ver el contexto histórico del código
- Estás haciendo code review
- Necesitas comparar con última versión funcional

---

### 3️⃣ Arquitectura de Base de Datos
**Archivo**: [TABLAS_SELECTOR_PROSPECTOS.md](./TABLAS_SELECTOR_PROSPECTOS.md)

**Contenido**:
- 🗄️ 7 tablas involucradas con estructura completa
- 🔗 Diagramas de relaciones (ASCII + Mermaid)
- 📐 Diagrama ER completo
- 🌊 Flujo del query con visualización
- 📊 Comparación INNER JOIN vs LEFT JOIN
- 🎨 5 diagramas Mermaid visuales

**Cuándo consultarlo**:
- Necesitas entender la arquitectura completa
- Quieres ver qué campos tiene cada tabla
- Estás escribiendo queries relacionados
- Necesitas explicar visualmente el problema

---

### 4️⃣ Correcciones de Nomenclatura
**Archivo**: [CORRECCION_NOMBRES_TABLAS.md](./CORRECCION_NOMBRES_TABLAS.md)

**Contenido**:
- ✅ Nombres correctos de tablas verificados en BD
- ❌ Nombres incorrectos encontrados en documentación previa
- 🔍 Verificación desde dump SQL real
- 📋 Tabla de correcciones

**Cuándo consultarlo**:
- Dudas sobre nombres exactos de tablas
- Verificar si una tabla existe realmente
- Corregir documentación/código con nombres erróneos

---

### 5️⃣ Optimización de Performance
**Archivo**: [OPTIMIZACION_PERFORMANCE_SELECTOR_PROSPECTOS.md](./OPTIMIZACION_PERFORMANCE_SELECTOR_PROSPECTOS.md)

**Contenido**:
- 🚀 5 índices compuestos optimizados (covering indexes)
- 📊 Análisis de performance: 90% reducción en query time
- ⚡ Plan de ejecución esperado con EXPLAIN
- 🔧 Script SQL completo para implementación
- 📈 Arquitectura multitenant SaaS
- 🎓 Reglas de oro y lecciones aprendidas

**Cuándo consultarlo**:
- Implementar índices en base de datos
- Optimizar queries lentos (>500ms)
- Entender covering indexes y left-most prefix
- Escalabilidad para 50k-500k prospectos
- Arquitectura de índices multitenant

---

## 🗂️ Archivos de Código Afectados

### Backend
- **prospectosController.js**: `/root/leadmaster-workspace/services/central-hub/src/modules/sender/controllers/prospectosController.js`
  - 🔴 Línea 107-108: INNER JOIN problemático
  - 🎯 Función: `obtenerProspectos()`

### Frontend
- **SelectorProspectosPage.jsx**: `/root/leadmaster-workspace/services/central-hub/frontend/src/components/destinatarios/SelectorProspectosPage.jsx`
  - 🔧 Mejora: Carga dinámica de estados por campaña
  
- **prospectos.js**: `/root/leadmaster-workspace/services/central-hub/frontend/src/services/prospectos.js`
  - 🔧 Mejora: Envía campania_id en requests

---

## 🔧 Fix Rápido (TL;DR)

```javascript
// ❌ ANTES (línea 107-108 en prospectosController.js)
INNER JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid AND lc.cliente_id = ?

// ✅ DESPUÉS
LEFT JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

**Impacto**: Cambio de 1 palabra en 1 archivo  
**Riesgo**: Bajo (solo más permisivo, no elimina funcionalidad)  
**Beneficio**: ~8,000+ prospectos disponibles para selección

---

## 🧪 Verificación del Fix

### Query de Prueba (Ejecutar en MySQL)
```sql
-- Verifica que ll_lugares_clientes esté vacía
SELECT COUNT(*) as count 
FROM ll_lugares_clientes 
WHERE cliente_id = 51;
-- Esperado: 0

-- Query con LEFT JOIN (debería retornar ~8000+)
SELECT COUNT(*) as total_prospectos
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid AND lc.cliente_id = 51
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL
  AND s.phone_mobile != '';
```

### Test en Frontend
1. Navegar a: `https://desarrolloydisenio.com.ar/prospectos`
2. Login como usuario "Haby" (cliente_id: 51)
3. Seleccionar una campaña
4. Verificar que la tabla muestra registros
5. Aplicar filtros (estado, rubro, ciudad) - debe funcionar

---

## 📊 Contexto Técnico

| Aspecto | Detalle |
|---------|---------|
| **Usuario afectado** | Haby (cliente_id: 51, tipo: admin) |
| **Tabla problemática** | `ll_lugares_clientes` (0 registros para cliente_id=51) |
| **Endpoint** | `GET /api/sender/prospectos/filtrar?campania_id={id}` |
| **Respuesta actual** | `{ "data": [] }` (0 registros) |
| **Respuesta esperada** | ~8,000+ prospectos con WhatsApp válido |
| **Branch** | `feature/whatsapp-init-sync` |
| **Último commit estable** | `7f61633` |

---

## 🎯 Decisión de Diseño

### ¿Por qué LEFT JOIN es correcto aquí?

La funcionalidad es un **SELECTOR** de prospectos, no un filtro de clientes vinculados:

1. **Propósito**: Mostrar TODOS los prospectos disponibles para enviar mensajes
2. **Lógica de negocio**: Usuario debe poder seleccionar cualquier prospecto de Dolibarr
3. **Tabla ll_lugares_clientes**: Es para tracking adicional, NO debe ser restrictiva
4. **LEFT JOIN preserva**: Todos los prospectos, marcando los vinculados si existen

**Analogía**: Es como un supermercado donde `ll_lugares_clientes` es tu lista de compras. Con INNER JOIN, solo verías productos de tu lista (vacía = no ves nada). Con LEFT JOIN, ves todos los productos y los de tu lista están marcados.

---

## 📅 Timeline del Bug

```
2026-01-XX  Commit 7f61633 - Última versión estable funcional
            ↓
2026-02-XX  Refactor: Se mejora código pero se expone bug latente
            - Se hace campania_id requerido
            - Se corrige orden de parámetros SQL
            - Bug INNER JOIN existía pero no era visible
            ↓
2026-02-08  Bug reportado: 0 registros en selector
            ↓
2026-02-11  Diagnóstico completo, documentación, diagramas
            ⏳ Pendiente: Implementar fix LEFT JOIN
```

---

## 📚 Referencias Relacionadas

- **Dolibarr ERP**: Tabla `llxbx_societe` es tabla estándar de Dolibarr
- **Prefijo ll_**: Tablas custom de LeadMaster
- **Prefijo llxbx_**: Tablas de Dolibarr (entity-aware)
- **JWT Authentication**: Token contiene `{id, cliente_id, usuario, tipo}`

---

## ✅ Checklist de Implementación

- [ ] Backup de `prospectosController.js` actual
- [ ] Cambiar INNER JOIN a LEFT JOIN (línea 107-108)
- [ ] Ejecutar queries de verificación en MySQL
- [ ] Test en desarrollo con usuario Haby
- [ ] Verificar que filtros funcionan correctamente
- [ ] Commit con mensaje descriptivo
- [ ] Push a feature branch
- [ ] Test en staging/producción
- [ ] Actualizar este índice con resultado

---

## 🔗 Navegación Rápida

- [🏠 README Principal](../README.md)
- [📖 Documentación General](./README.md)
- [🏗️ Arquitectura Modular](./ARQUITECTURA_MODULAR.md)
- [🔐 Autenticación](./AUTENTICACION.md)

---

**Última actualización**: 2026-02-11  
**Mantenido por**: GitHub Copilot + Desarrollo  
**Status**: 📖 Documentación completa - ⏳ Esperando implementación
