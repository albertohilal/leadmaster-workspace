# 🔒 PUNTO DE RETORNO — PR-01: Arquitectura WhatsApp

**Fecha de creación:** 17 de enero de 2026  
**Rama:** `feature/whatsapp-init-sync`  
**Estado:** CONGELADO - Pendiente de decisión arquitectónica

---

## 📌 Objetivo de Este Documento

Establecer un **estado válido, documentado y defendible** del proyecto, desde el cual:

- ✅ Podamos **retroceder sin pérdida conceptual**
- ✅ Podamos **cambiar de decisión arquitectónica** sin culpa técnica
- ✅ No sigamos acumulando complejidad improductiva

**Este punto de retorno NO es un rollback técnico**, es un **checkpoint estratégico**.

---

## 1. Estado Real del Proyecto (Hechos, No Deseos)

### ✔️ Lo que SÍ está claro

#### Modelo de Negocio Actual

- El sistema usa **un solo número de WhatsApp**: el del administrador
- Los clientes **NO escanean QR**
- Los clientes **NO gestionan sesiones propias**
- Los clientes **NO tienen WhatsApp integrado**

#### Valor Real del SaaS

El valor no está en "WhatsApp multicliente", sino en:

1. **Captación** de leads
2. **Filtrado** automático
3. **Priorización** inteligente
4. **Derivación humana** efectiva

---

### ❌ Lo que NO está funcionando

#### Session Manager Multicliente

- ⚠️ **Inestable** en producción
- ⚠️ Puppeteer falla repetidamente: `INITIALIZING → ERROR`
- ⚠️ QR **no es confiable**
- ⚠️ Debugging se volvió difuso
- ⚠️ Costo cognitivo supera el valor aportado

#### Evidencia Técnica

```json
// Estado persistente observado (17/01/2026)
{
  "connected": false,
  "state": "INITIALIZING",
  "can_send_messages": false,
  "needs_qr": false,
  "is_recoverable": true,
  "recommended_action": "Initializing for first time - wait"
}
```

**Tiempo en INITIALIZING:** >24 horas sin transición a QR_REQUIRED o READY

---

## 2. Decisión Congelada (No Ejecutada)

> ⚠️ **NO se decide todavía si el Session Manager será single-session o multicliente.**

### Lo que SE HACE ahora

**Congelar el estado** y declarar:

> *"A partir de aquí, cualquier cambio será consciente y reversible."*

### Lo que NO se hace

- ❌ Seguir agregando workarounds
- ❌ "Arreglar un poco más"
- ❌ Asumir que el problema es solo de configuración

---

## 3. Definición Formal del Punto de Retorno

### 🧭 Identificador: **PR-01 / Arquitectura WhatsApp**

**Descripción:**

> El sistema se encuentra en una implementación experimental de Session Manager multicliente, no estable, cuyo valor debe ser reevaluado frente al modelo real de negocio.

**Alcance:**

- `/services/session-manager` (completo)
- `/services/central-hub/src/modules/whatsappQrAuthorization`
- `/services/central-hub/src/integrations/sessionManager`
- Configuración Puppeteer / whatsapp-web.js
- Contratos HTTP entre Central Hub ↔ Session Manager

**Supuesto bajo revisión:**

> "Cada cliente necesita su propia sesión de WhatsApp"

**Estado del supuesto:**

- ⚠️ **No validado con el modelo de negocio real**
- ⚠️ **No funcional técnicamente**
- ⚠️ **Sin demanda explícita del cliente (Haby)**

---

## 4. Reglas POST-PR-01 (Hasta Tomar Decisión)

### 🚫 PROHIBIDO

Hasta que se tome la decisión arquitectónica explícita, queda **prohibido**:

- ❌ Agregar más lógica multicliente
- ❌ Refactorizar para "escalar" sin validar necesidad
- ❌ Optimizar Puppeteer con más flags/workarounds
- ❌ Agregar retries, timeouts, circuit breakers sin fundamento
- ❌ "Forzar" que funcione con parches incrementales
- ❌ Commitear cambios del working tree actual

**Razón:** Eso **entierra el punto de retorno** y hace irreversible la decisión.

---

### ✔️ PERMITIDO

Desde este punto, **SÍ está permitido**:

- ✅ **Análisis conceptual** (sin código)
- ✅ **Comparación** con proyectos previos:
  - `whatsapp-bot-responder`
  - `massive-sender`
  - Otras implementaciones de whatsapp-web.js
- ✅ **Identificación de piezas reutilizables**
- ✅ **Diseño alternativo en papel** (diagramas, specs)
- ✅ **Evaluación de impacto** en negocio y cliente final
- ✅ **Consulta con stakeholder** (Haby) sobre necesidades reales

**Sin tocar código productivo.**

---

## 5. Documento Mental Sellado

### 🔐 Sello PR-01

> **El Session Manager multicliente:**
>
> - ✅ Existe en el código
> - ❌ No está validado funcionalmente
> - ❌ No se asume correcto
> - ⏸️ No se continúa profundizando sin decisión explícita

### Protección que ofrece este sello

- 🛡️ **Contra el sunk cost fallacy** ("ya invertimos mucho")
- 🛡️ **Contra el "ya estamos acá"** (inercia técnica)
- 🛡️ **Contra el "arreglemos un poco más"** (optimismo sesgado)

---

## 6. Análisis de Modelos Alternativos (Pendiente)

### Opción A: Single-Session (Admin WhatsApp)

**Características:**

- Un solo cliente whatsapp-web.js
- Una sola sesión persistente
- Un solo QR inicial
- Todos los envíos desde el mismo número

**Pros:**

- ✅ Alineado con modelo de negocio actual
- ✅ Simplicidad técnica
- ✅ Ya probado en `massive-sender`
- ✅ Debugging directo
- ✅ Sin overhead multicliente

**Contras:**

- ⚠️ No escala a WhatsApp por cliente (¿se necesita?)
- ⚠️ Requiere rediseño parcial

---

### Opción B: Multicliente (Actual)

**Características:**

- Session Manager mantiene N sesiones
- LocalAuth con `clientId` dinámico
- Cada cliente escanea QR
- Gestión de estados por cliente

**Pros:**

- ✅ Escalable teóricamente
- ✅ Aislamiento de sesiones

**Contras:**

- ❌ No funciona actualmente
- ❌ No alineado con negocio real
- ❌ Complejidad excesiva para MVP
- ❌ Sin demanda validada

---

## 7. Próximos Pasos Posibles (Cuando Se Decida)

### Paso 1: Análisis y Validación

- [ ] Comparar ambos modelos formalmente
- [ ] Evaluar impacto en producto existente
- [ ] Consultar con Haby sobre necesidad real de multicliente
- [ ] Revisar proyectos previos (`whatsapp-bot-responder`, etc.)

### Paso 2: Decisión Explícita

Elegir UNO de estos caminos:

**A) Continuar con multicliente**

- Requiere: Plan de depuración sistemático
- Requiere: Validación de Puppeteer en servidor
- Requiere: Tests end-to-end
- Requiere: Justificación de negocio clara

**B) Migrar a single-session**

- Requiere: Diseño de transición
- Requiere: Plan de eliminación de código multicliente
- Requiere: Nueva integración Central Hub → Session Manager
- Ventaja: Alineado con realidad del producto

### Paso 3: Solo Después de Decisión

- Ejecutar cambios de código
- Actualizar documentación
- Commitear cambios
- Desplegar

---

## 8. Archivos Afectados por PR-01

### Session Manager

```
/services/session-manager/
├── whatsapp/
│   ├── client.js              ← Lógica multicliente
│   ├── clientFactory.js       ← Factory de clientes
│   ├── eventHandlers.js       ← Eventos whatsapp-web.js
│   └── sessionState.js        ← Estados de sesión
├── routes/
│   ├── status.js              ← GET /status (por cliente)
│   ├── send.js                ← POST /send (por cliente)
│   └── qr.js                  ← GET /qr-code (por cliente)
└── index.js                   ← No inicializa automáticamente
```

### Central Hub

```
/services/central-hub/src/
├── modules/whatsappQrAuthorization/
│   ├── controllers/whatsappQrController.js
│   └── services/qrAuthorizationService.js
├── integrations/sessionManager/
│   └── client.js              ← Llamadas HTTP a session-manager
└── routes/
    └── whatsappQrProxy.js     ← Proxy /api/whatsapp/:clienteId/*
```

---

## 9. Configuración Actual de Puppeteer (Para Referencia)

### Estado al momento del PR-01

```javascript
// Ambos archivos: client.js y clientFactory.js
puppeteer: {
  executablePath: '/usr/bin/google-chrome',
  headless: 'old',  // ← Último intento de estabilización
  args: [
    '--headless=old',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    '--no-zygote',
    '--disable-features=site-per-process'
  ]
}
```

**Resultado:** Sin cambio observable en comportamiento.

---

## 10. Referencias Cruzadas

### Documentos Relacionados

- `PHASE_3_ROADMAP.md` - Plan original de Phase 3
- `docs/Integration-CentralHub-SessionManager.md` - Contrato HTTP
- `docs/PROJECT-STATUS.md` - Estado general del proyecto
- `DIAGNOSTICO_LOGIN_PRODUCCION.md` - Problema de frontend resuelto

### Branches

- `main` - Estado estable pre-Phase 3
- `feature/whatsapp-init-sync` - **Rama actual (PR-01)**

---

## 11. Criterios de Salida del PR-01

Este punto de retorno se considera **resuelto** cuando:

- ✅ Se tomó decisión explícita: Single-Session vs Multicliente
- ✅ Se documentó la justificación de la decisión
- ✅ Se ejecutó el plan correspondiente
- ✅ El sistema llega a estado `READY` de forma confiable
- ✅ Se pueden enviar mensajes reales
- ✅ Se actualizó documentación técnica

---

## 12. Mensaje para el Futuro

Si estás leyendo esto en el futuro y te preguntás **"¿por qué no siguieron con multicliente?"**:

La respuesta está en este documento.

**No fue un fracaso técnico**, fue una **decisión consciente de no seguir invirtiendo** en una arquitectura que no aportaba valor al negocio real.

El código multicliente **puede ser retomado** si en el futuro:

- Haby necesita múltiples números de WhatsApp
- El modelo de negocio cambia a "WhatsApp por cliente"
- Se valida demanda real

Hasta entonces, el principio es:

> **"Build what you need, not what you might need."**

---

**Fin del Punto de Retorno PR-01**

---

## Apéndice A: Comandos de Verificación

### Estado actual de servicios

```bash
pm2 status
pm2 logs session-manager --lines 50
```

### Estado de sesión WhatsApp

```bash
curl http://localhost:3001/status -H "X-Cliente-Id: 51"
```

### Archivos modificados (no commiteados)

```bash
git status
git diff services/session-manager/whatsapp/client.js
git diff services/session-manager/whatsapp/clientFactory.js
```

---

## Apéndice B: Rollback a Estado Pre-PR-01

Si se decide volver al código antes de PR-01:

```bash
# Descartar cambios no commiteados
git checkout -- services/session-manager/whatsapp/client.js
git checkout -- services/session-manager/whatsapp/clientFactory.js

# Reiniciar servicio
pm2 restart session-manager

# Verificar estado
curl http://localhost:3001/status -H "X-Cliente-Id: 51"
```

---

**Firmado digitalmente por:** GitHub Copilot  
**Aprobado conceptualmente por:** Alberto Hilal  
**Fecha de sello:** 17 de enero de 2026
