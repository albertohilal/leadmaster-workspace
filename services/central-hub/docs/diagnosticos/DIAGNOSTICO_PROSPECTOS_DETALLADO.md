# 🔍 Diagnóstico Técnico: Carga de Prospectos en SelectorProspectosPage

**Fecha:** 2026-02-15  
**Componente:** `frontend/src/components/leads/SelectorProspectosPage.jsx`  
**Objetivo:** Identificar por qué no se cargan los prospectos

---

## ✅ Verificaciones Realizadas en el Código

### 1. APIs Verificadas en `services/api.js`

**leadsAPI.getProspectos:**
```javascript
// Línea 167
getProspectos: (filters) =>
  api.get('/sender/prospectos/filtrar', { params: filters })
```
✅ **Existe y está correctamente definido**
- Endpoint: `GET /sender/prospectos/filtrar`
- Parámetros: `{ campania_id: selectedCampaign }`

**senderAPI.getCampaigns:**
```javascript
// Línea 118
getCampaigns: () =>
  api.get('/sender/campaigns')
```
✅ **Existe y está correctamente definido**
- Endpoint: `GET /sender/campaigns`

**⚠️ IMPORTANTE:** NO existe `campaignsAPI` en el código. Solo existe `senderAPI.getCampaigns()`.

---

## 🔬 Logs de Diagnóstico Implementados

He agregado **18 puntos de diagnóstico** que rastrean todo el flujo de ejecución:

### Fase 1: Montaje del Componente
```
🔍 [DIAGNOSTIC 1] ====== COMPONENTE MONTADO ======
- Timestamp
- leadsAPI disponible
- senderAPI disponible  
- leadsAPI.getProspectos (tipo)
- senderAPI.getCampaigns (tipo)
```

### Fase 2: Carga de Campañas (useEffect inicial)
```
🔍 [DIAGNOSTIC 2] useEffect CAMPAIGNS EJECUTADO
🔍 [DIAGNOSTIC 3] Llamando senderAPI.getCampaigns()
🔍 [DIAGNOSTIC 4] Response completa
  - response.data (valor y tipo)
  - Es Array?
  - response.data.data existe?
  - Estructura completa JSON
🔍 [DIAGNOSTIC 5] setCampaigns ejecutado
🔍 [DIAGNOSTIC 6] Primera campaña (si existe)
  - ID original
  - ID convertido a string
🔍 [DIAGNOSTIC 7] setSelectedCampaign ejecutado
⚠️ [DIAGNOSTIC 6] NO hay campañas (si aplicable)
❌ [DIAGNOSTIC 8] ERROR (si falla)
```

### Fase 3: Carga de Prospectos (useCallback + useEffect)
```
🔍 [DIAGNOSTIC 9] cargarProspectos() LLAMADO
  - selectedCampaign actual
  - Tipo
  - Es falsy?
  - Longitud
⚠️ [DIAGNOSTIC 10] RETURN EARLY (si selectedCampaign vacío)
✅ [DIAGNOSTIC 10] selectedCampaign válido
🔍 [DIAGNOSTIC 11] Iniciando carga de prospectos
🔍 [DIAGNOSTIC 12] Params para API
  - leadsAPI existe?
  - leadsAPI.getProspectos existe?
🔍 [DIAGNOSTIC 13] Ejecutando leadsAPI.getProspectos()
🔍 [DIAGNOSTIC 14] Response de prospectos recibida
  - response.data
  - response.data.data
  - Cantidad de prospectos
  - Estructura completa JSON
🔍 [DIAGNOSTIC 15] setProspectos ejecutado
❌ [DIAGNOSTIC 16] ERROR (si falla)
🔍 [DIAGNOSTIC 17] cargarProspectos() FINALIZADO
🔍 [DIAGNOSTIC 18] useEffect PROSPECTOS EJECUTADO
```

---

## 📋 Instrucciones para el Usuario

### Paso 1: Limpiar Consola
1. Abre Developer Tools (F12)
2. Ve a la pestaña Console
3. Click derecho → Clear console
4. **O presiona el icónico de prohibido (🚫)**

### Paso 2: Recargar Página
1. Con la consola abierta, recarga la página (F5 o Ctrl+R)
2. Observa TODOS los logs que aparecen en orden

### Paso 3: Capturar Información
Copia **TODOS** los logs que empiecen con 🔍, ⚠️ o ❌ y envíalos completos.

---

## 🎯 Posibles Escenarios y Puntos de Falla

### Escenario A: `senderAPI.getCampaigns()` falla
**Síntoma:**
- Ver ❌ [DIAGNOSTIC 8] ERROR
- NO ver [DIAGNOSTIC 6] ni [DIAGNOSTIC 7]
- `selectedCampaign` queda vacío

**Causa:**
- Endpoint `/sender/campaigns` no responde
- Error 500/404 en el backend
- JWT inválido

**Evidencia:** 
- Ver error en DIAGNOSTIC 8
- Ver request fallido en Network tab

---

### Escenario B: `response.data` no es un Array directo
**Síntoma:**
- Ver [DIAGNOSTIC 4] con estructura como `{ success: true, data: [...] }`
- [DIAGNOSTIC 4] "Es Array?" = false
- [DIAGNOSTIC 6] NO ejecutado (error al acceder a `response.data[0]`)

**Causa:**
- Backend devuelve `{ success, data }` en lugar de Array directo
- Necesitamos acceder a `response.data.data`

**Evidencia:**
- Ver estructura JSON en DIAGNOSTIC 4
- Ver error en DIAGNOSTIC 8 o no ver DIAGNOSTIC 6

---

### Escenario C: `selectedCampaign` no se setea
**Síntoma:**
- Ver [DIAGNOSTIC 7] ejecutado
- Pero [DIAGNOSTIC 9] muestra `selectedCampaign: ""`
- Ver ⚠️ [DIAGNOSTIC 10] RETURN EARLY

**Causa:**
- Timing issue: useEffect de prospectos se ejecuta antes que se setee selectedCampaign
- setSelectedCampaign no persiste el valor

**Evidencia:**
- DIAGNOSTIC 7 muestra un valor válido
- Pero DIAGNOSTIC 9 (que se ejecuta después) lo muestra vacío

---

### Escenario D: `leadsAPI.getProspectos()` nunca se llama
**Síntoma:**
- Ver [DIAGNOSTIC 9] ejecutado
- Ver ⚠️ [DIAGNOSTIC 10] RETURN EARLY
- NUNCA ver [DIAGNOSTIC 12] ni [DIAGNOSTIC 13]

**Causa:**
- `selectedCampaign` está vacío/null/undefined
- Flujo se corta en el `if (!selectedCampaign) return;`

**Evidencia:**
- DIAGNOSTIC 9 muestra selectedCampaign vacío
- NO hay request a `/sender/prospectos/filtrar` en Network

---

### Escenario E: `leadsAPI.getProspectos()` falla
**Síntoma:**
- Ver [DIAGNOSTIC 13] ejecutado
- Ver ❌ [DIAGNOSTIC 16] ERROR
- Request aparece en Network pero con error 400/500

**Causa:**
- Backend rechaza el request
- Parámetro `campania_id` inválido
- Error en el backend

**Evidencia:**
- Ver error en DIAGNOSTIC 16
- Ver request fallido en Network
- Ver response.data en DIAGNOSTIC 16

---

### Escenario F: Response de prospectos tiene estructura diferente
**Síntoma:**
- Ver [DIAGNOSTIC 14] ejecutado
- Ver [DIAGNOSTIC 14] con estructura inesperada
- [DIAGNOSTIC 15] "Seteando prospectos: 0 items"

**Causa:**
- Backend devuelve estructura diferente a `{ data: [...] }`
- Prospectos están en otra propiedad

**Evidencia:**
- Ver estructura JSON en DIAGNOSTIC 14
- Cantidad = 0 a pesar de que hay datos

---

## 🔧 Qué NO He Modificado (Solo Diagnóstico)

- ✅ No cambié la lógica
- ✅ No apliqué fixes
- ✅ Solo agregué console.log estructurados
- ✅ El código sigue funcionando igual que antes

---

## 📊 Siguiente Paso

**Una vez que tengas los logs completos de la consola:**

1. Identifica cuál es el **último DIAGNOSTIC exitoso**
2. Identifica el **primer ERROR o WARNING**
3. Compara con los escenarios arriba
4. Te daré el fix preciso según el punto exacto donde falla

---

## 🚨 Recordatorio

**NO ejecutar ningún fix todavía.**
Solo necesito ver los logs completos para identificar el problema exacto.

El frontend está reconstruido y listo para diagnóstico.
Recarga la página con la consola abierta y copia TODO el output.
