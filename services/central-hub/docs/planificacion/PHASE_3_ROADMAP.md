# Phase 3 – WhatsApp Integration: Roadmap & Status

**Fecha de creación:** 17 de enero de 2026  
**Rama:** `feature/whatsapp-init-sync`  
**Estado:** En desarrollo (parcial)

---

## 📋 ÍNDICE

1. [Cierre Técnico del Intento Actual](#1-cierre-técnico-del-intento-actual)
2. [Plan de Completitud de Phase 3](#2-plan-de-completitud-de-phase-3)
3. [Checklist Operativo](#3-checklist-operativo)

---

## 1. CIERRE TÉCNICO DEL INTENTO ACTUAL

### 1.1 Estado Real Verificado

**Fecha de verificación:** 17 de enero de 2026

#### Procesos Activos

| Servicio | Estado | Uptime | Puerto |
|----------|--------|--------|--------|
| `leadmaster-central-hub` | ✅ Online | ~10h | 3013 |
| `session-manager` | ✅ Online | ~10h | 3001 |

#### Endpoint Crítico Evaluado

```http
GET http://localhost:3001/status
X-Cliente-Id: 51
```

**Respuesta Real:**

```json
{
  "connected": false,
  "state": "INITIALIZING",
  "can_send_messages": false,
  "needs_qr": false,
  "is_recoverable": true,
  "recommended_action": "Initializing for first time - wait"
}
```

---

### 1.2 Diagnóstico Técnico

✅ **Infraestructura correctamente desplegada**  
✅ **Session Manager existe y responde**  
❌ **NO existe sesión WhatsApp activa**  
❌ **NO hay QR generado**  
❌ **NO se alcanzó estado READY**  
❌ **Sistema NO puede enviar mensajes reales**

**Conclusión:**  
El sistema está en estado `INITIALIZING` estático, lo que confirma que Phase 3 quedó **incompleta** según lo previsto en documentación.

---

### 1.3 Decisión Operativa

**Decisión tomada:**

👉 **NO se realizan envíos desde el sistema**  
👉 **NO se solicita QR a terceros**  
👉 **NO se fuerza ninguna acción técnica adicional**

**Plan B Operativo Adoptado:**

- Envíos manuales desde WhatsApp Business personal
- Filtrado humano de interesados
- Derivación a contactos externos solo de prospectos calificados

**Justificación:**  
Esta decisión **no es un retroceso técnico**, es la **aplicación correcta del encuadre previsto** para esta etapa del proyecto. Se prioriza estabilidad sobre funcionalidad incompleta.

---

### 1.4 Estado del Código

- ❌ Hay cambios locales **NO commiteados**
- ⚠️ Los cambios corresponden a **trabajo incompleto de Phase 3**
- 🔒 **NO se realiza commit**
- 📝 El working tree queda como **contexto de desarrollo**, no como release

**Cierre técnico limpio.**

---

## 2. PLAN DE COMPLETITUD DE PHASE 3

### 2.1 Objetivo Real (Acotado)

> **Un solo objetivo técnico:**  
> Lograr que el sistema llegue de forma **confiable** y **repetible** a:

```json
{
  "state": "READY",
  "can_send_messages": true
}
```

**Nada más.**

#### ❌ Fuera del Alcance de Phase 3

- Campañas automáticas
- Colas de envío
- UI compleja
- Multi-tenant avanzado
- Listener de mensajes entrantes
- Integración con CRM

---

### 2.2 Alcance Mínimo Indispensable (MVP Real)

#### Backend – Session Manager

**Debe garantizar:**

1. ✅ **Generación explícita de QR**
   - Endpoint `/qr` o lógica automática en init
   - QR accesible vía terminal o base64

2. ✅ **Persistencia de sesión**
   - LocalAuth correctamente configurado
   - Tokens en `tokens/<cliente_id>/`

3. ✅ **Transición clara de estados:**
   ```
   INITIALIZING
   → QR_REQUIRED (con QR disponible)
   → READY (sesión autenticada)
   ```

4. ✅ **Endpoint `/status` coherente con realidad**
   - Refleja estado real de whatsapp-web.js
   - No estados ficticios

5. ✅ **Endpoint `/send` operativo**
   - Solo funciona si `state === "READY"`
   - Retorna error 503 si no está listo

---

#### Central Hub

**Solo necesita:**

- ✅ Consumir `/status` (Session Manager)
- ✅ Consumir `/send` (Session Manager)
- ❌ **NO decidir nada sobre estados**
- ❌ **NO inventar lógica de conexión**

**Rol:** Orquestador, no cerebro de la sesión.

---

#### Frontend (Opcional en Phase 3)

Puede ser:

- **Inexistente**, o
- **Vista técnica mínima** (solo para debug)

📌 **No es requisito para cerrar Phase 3**

---

### 2.3 Orden de Trabajo Recomendado

#### 🔧 Paso 1 – Session Manager Aislado

```bash
# Ejecutar SOLO session-manager
cd /root/leadmaster-workspace/services/session-manager
pm2 stop all
npm run dev
```

**Objetivo:**

- Forzar generación de QR
- Escanear con WhatsApp Business real
- Confirmar transición a `"state": "READY"`

**Criterio de éxito:**

```json
{
  "state": "READY",
  "connected": true,
  "can_send_messages": true
}
```

👉 **Si esto no funciona, NO se avanza.**

---

#### 🔧 Paso 2 – Persistencia

```bash
# Reiniciar proceso
pm2 restart session-manager

# Consultar estado
curl http://localhost:3001/status -H "X-Cliente-Id: 51"
```

**Criterio de éxito:**

- El estado sigue siendo `"READY"`
- **NO vuelve a pedir QR**
- Tokens correctamente guardados en disco

---

#### 🔧 Paso 3 – Envío de 1 Mensaje Técnico

```bash
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -H "X-Cliente-Id: 51" \
  -d '{
    "to": "5493512345678",
    "message": "Test técnico - LeadMaster"
  }'
```

**Criterio de éxito:**

- Status 200 OK
- Mensaje recibido en WhatsApp real
- Sin errores en logs

---

#### 🔧 Paso 4 – Recién Ahí

**Commit único:**

```bash
git add .
git commit -m "feat(phase-3): WhatsApp session lifecycle completed

- Session Manager alcanza estado READY de forma confiable
- Persistencia LocalAuth operativa
- Envío de mensajes funcional
- Transición de estados documentada

Closes Phase 3 MVP"
```

---

### 2.4 Qué NO Hacer

❌ **No mezclar Phase 3 con campañas**  
❌ **No reintroducir a terceros en pruebas técnicas**  
❌ **No "probar un poco más" sin criterio de éxito claro**  
❌ **No commitear estados intermedios o inestables**  
❌ **No avanzar a integración con Central Hub antes de paso 3**

---

## 3. CHECKLIST OPERATIVO

### Pre-requisitos

- [ ] Session Manager en rama actualizada
- [ ] WhatsApp Business disponible para escaneo
- [ ] Número de prueba identificado
- [ ] PM2 configurado correctamente
- [ ] Variables de entorno validadas

---

### Ejecución

#### Fase 1: Sesión Básica

- [ ] Session Manager ejecutándose aislado
- [ ] QR generado (visible en terminal o endpoint)
- [ ] QR escaneado con WhatsApp Business
- [ ] Estado transiciona a `READY`
- [ ] Logs sin errores críticos

#### Fase 2: Persistencia

- [ ] Proceso reiniciado
- [ ] Estado permanece `READY` (sin nuevo QR)
- [ ] Tokens existentes en `tokens/51/`
- [ ] `/status` responde coherentemente

#### Fase 3: Envío

- [ ] Mensaje de prueba enviado
- [ ] Mensaje recibido en WhatsApp destino
- [ ] Response 200 OK desde API
- [ ] Logs confirman envío exitoso

#### Fase 4: Integración (opcional)

- [ ] Central Hub conecta con Session Manager
- [ ] `/api/whatsapp/status` retorna datos correctos
- [ ] Frontend consume status (si existe)

---

### Post-Completitud

- [ ] Commit realizado
- [ ] Tests agregados (si aplica)
- [ ] Documentación actualizada
- [ ] PR creado con descripción clara
- [ ] Review técnico aprobado

---

## 4. CONCLUSIÓN

### Estado Actual

✅ **Infraestructura estable**  
✅ **Decisión operativa correcta**  
⏸️ **Phase 3 en pausa técnica limpia**

### Próximos Pasos

Cuando se retome Phase 3, seguir **estrictamente** el orden de trabajo recomendado (Sección 2.3).

**No hay urgencia.** El sistema actual cubre las necesidades operativas con Plan B manual.

---

### Referencias

- **Session Manager:** `/root/leadmaster-workspace/services/session-manager`
- **Central Hub:** `/root/leadmaster-workspace/services/central-hub`
- **Docs anteriores:** `docs/PHASE-3-PLAN.md`, `docs/Integration-CentralHub-SessionManager.md`
- **Estado del proyecto:** `docs/PROJECT-STATUS.md`

---

**Fin del documento**
