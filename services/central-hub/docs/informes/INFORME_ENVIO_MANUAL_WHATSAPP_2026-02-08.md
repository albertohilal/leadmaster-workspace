# 📋 INFORME - Implementación de Envío Manual vía WhatsApp Web
**Fecha:** 8 de febrero de 2026  
**Sistema:** LeadMaster - Central Hub  
**Módulo:** Sender - Gestión de Campañas  
**Tipo:** Funcionalidad de Envío Manual Controlado

---

## 🎯 OBJETIVO

Implementar una acción manual en la vista existente de "Destinatarios de una Campaña" que permita a los operadores enviar mensajes de WhatsApp de forma controlada, sin automatización, respetando las políticas de Meta y protegiendo el número empresarial.

---

## ⚠️ RESTRICCIONES CRÍTICAS (NO NEGOCIABLES)

**NO se implementará:**
- ❌ Envío automático de WhatsApp
- ❌ Bots o automatizaciones
- ❌ whatsapp-web.js / Venom / similares
- ❌ WhatsApp Cloud API
- ❌ Listeners de eventos
- ❌ Cambios de arquitectura
- ❌ Nuevos servicios
- ❌ Flujos paralelos
- ❌ Confirmación automática de lectura/entrega
- ❌ Métricas automáticas desde WhatsApp

**Motivo:** El número de WhatsApp aún NO está autorizado por Meta para uso masivo. Los envíos se harán MANUALMENTE por Web WhatsApp con intervención humana explícita.

---

## 📊 CONTEXTO DEL SISTEMA EXISTENTE

### Base de Datos Actual

#### Tabla: `ll_campanias_whatsapp`
```sql
- id (int)
- nombre (varchar)
- mensaje (text)           ← Mensaje base de la campaña
- descripcion (text)
- estado (enum)
- cliente_id (int)
- fecha_creacion (timestamp)
```

#### Tabla: `ll_envios_whatsapp`
```sql
- id (int)
- campania_id (int)
- telefono_wapp (varchar)  ← Teléfono del destinatario
- nombre_destino (varchar) ← Nombre del destinatario
- mensaje_final (text)     ← Mensaje personalizado (puede ser NULL)
- estado (varchar/enum)    ← ACTUAL: 'pendiente', 'enviado', 'fallido'
- fecha_envio (datetime)
- fecha_creacion (timestamp)
- cliente_id (int)
```

### Vista Frontend Actual

**Archivo:** `/root/leadmaster-workspace/services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`

- Modal "Ver Destinatarios" muestra tabla con:
  - Nombre
  - Teléfono
  - Estado
  - Fecha Envío

### APIs Backend Existentes

**Controlador:** `destinatariosController.js`
- `GET /sender/destinatarios/campania/:campaniaId` - Lista destinatarios
- `GET /sender/destinatarios/campania/:campaniaId/resumen` - Resumen estadístico
- `POST /sender/destinatarios/campania/:campaniaId/agregar` - Agregar destinatarios
- `DELETE /sender/destinatarios/campania/:campaniaId/quitar` - Quitar destinatarios

---

## 🔧 CAMBIOS A IMPLEMENTAR

### 1️⃣ BASE DE DATOS - Nuevo Estado

**Modificación en tabla `ll_envios_whatsapp`:**

**Estados propuestos:**
- `'pendiente'` → Destinatario agregado, aún no se abrió el enlace
- `'sent_manual'` → Enviado manualmente por el operador vía WhatsApp Web
- `'fallido'` → (mantener para casos excepcionales)

**Script SQL (opcional si usa ENUM):**
```sql
ALTER TABLE ll_envios_whatsapp 
MODIFY estado ENUM('pendiente', 'enviado', 'sent_manual', 'fallido') 
DEFAULT 'pendiente';
```

Si el campo es `VARCHAR`, no requiere cambios de esquema.

---

### 2️⃣ BACKEND - Nuevo Endpoint

**Archivo:** `/root/leadmaster-workspace/services/central-hub/src/modules/sender/controllers/destinatariosController.js`

**Nuevo método:**
```javascript
async marcarEnviadoManual(req, res) {
  try {
    const { destinatarioId } = req.params;
    const clienteId = req.user.cliente_id;

    // Verificar que el destinatario pertenece a una campaña del cliente
    const [check] = await db.execute(`
      SELECT env.id, env.estado, camp.cliente_id
      FROM ll_envios_whatsapp env
      LEFT JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id
      WHERE env.id = ? AND camp.cliente_id = ?
    `, [destinatarioId, clienteId]);

    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destinatario no encontrado o sin permisos'
      });
    }

    // Solo permitir si está pendiente
    if (check[0].estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: `No se puede marcar como enviado. Estado actual: ${check[0].estado}`
      });
    }

    // Actualizar estado
    await db.execute(`
      UPDATE ll_envios_whatsapp 
      SET estado = 'sent_manual', fecha_envio = NOW()
      WHERE id = ?
    `, [destinatarioId]);

    res.json({
      success: true,
      message: 'Destinatario marcado como enviado manualmente'
    });

  } catch (error) {
    console.error('Error al marcar como enviado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
}
```

**Exportar en el objeto:**
```javascript
module.exports = {
  getDestinatariosCampania,
  getResumenDestinatarios,
  agregarDestinatarios,
  quitarDestinatarios,
  marcarEnviadoManual  // ← NUEVO
};
```

---

### 3️⃣ BACKEND - Nueva Ruta

**Archivo:** `/root/leadmaster-workspace/services/central-hub/src/modules/sender/routes/destinatarios.js`

**Agregar:**
```javascript
// Marcar destinatario como enviado manualmente
router.patch('/:destinatarioId/marcar-enviado', destinatariosController.marcarEnviadoManual);
```

---

### 4️⃣ FRONTEND - Servicio API

**Archivo:** `/root/leadmaster-workspace/services/central-hub/frontend/src/services/destinatarios.js`

**Agregar método:**
```javascript
// Marcar destinatario como enviado manualmente
async marcarEnviadoManual(destinatarioId) {
  try {
    const response = await apiService.patch(`/sender/destinatarios/${destinatarioId}/marcar-enviado`);
    return response.data;
  } catch (error) {
    console.error('Error al marcar como enviado:', error);
    throw error;
  }
}
```

---

### 5️⃣ FRONTEND - Vista de Destinatarios

**Archivo:** `/root/leadmaster-workspace/services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`

#### A. Agregar funciones auxiliares

**Insertar antes del return principal:**
```javascript
/**
 * Genera enlace de WhatsApp Web con mensaje precompletado
 */
const handleAbrirWhatsApp = (destinatario) => {
  // 1. Obtener mensaje (prioridad: mensaje_final > mensaje de campaña)
  const mensajeBase = selectedCampaign.mensaje;
  const mensajeFinal = destinatario.mensaje_final || mensajeBase;
  
  // 2. Limpiar teléfono (eliminar espacios, guiones, +)
  const telefonoLimpio = destinatario.telefono.replace(/[\s\-\+]/g, '');
  
  // 3. Construir URL de WhatsApp Web
  const mensajeCodificado = encodeURIComponent(mensajeFinal);
  const urlWhatsApp = `https://web.whatsapp.com/send?phone=${telefonoLimpio}&text=${mensajeCodificado}`;
  
  // 4. Abrir en nueva pestaña
  window.open(urlWhatsApp, '_blank');
};

/**
 * Marca destinatario como enviado manualmente
 */
const handleMarcarEnviado = async (destinatarioId) => {
  if (!confirm('¿Confirmas que enviaste el mensaje manualmente?')) {
    return;
  }
  
  try {
    const response = await destinatariosService.marcarEnviadoManual(destinatarioId);
    
    if (response.success) {
      // Actualizar lista de destinatarios
      setDestinatarios(destinatarios.map(d => 
        d.id === destinatarioId 
          ? { ...d, estado: 'sent_manual', fecha_envio: new Date() }
          : d
      ));
      
      // Actualizar estadísticas
      setEstadisticasDestinatarios({
        ...estadisticasDestinatarios,
        pendientes: estadisticasDestinatarios.pendientes - 1,
        enviados: estadisticasDestinatarios.enviados + 1
      });
      
      alert('✓ Marcado como enviado correctamente');
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMsg = error.response?.data?.message || 'Error al marcar como enviado';
    alert(errorMsg);
  }
};
```

#### B. Modificar tabla de destinatarios

**Agregar columna "Acciones" en el `<thead>`:**
```jsx
<thead>
  <tr className="bg-gray-50">
    <th className="border border-gray-300 px-4 py-2 text-left">Nombre</th>
    <th className="border border-gray-300 px-4 py-2 text-left">Teléfono</th>
    <th className="border border-gray-300 px-4 py-2 text-left">Estado</th>
    <th className="border border-gray-300 px-4 py-2 text-left">Fecha Envío</th>
    <th className="border border-gray-300 px-4 py-2 text-left">Acciones</th>
  </tr>
</thead>
```

**Agregar celda de acciones en el `<tbody>`:**
```jsx
<tbody>
  {destinatarios.map((destinatario, index) => (
    <tr key={destinatario.id || index} className="hover:bg-gray-50">
      <td className="border border-gray-300 px-4 py-2">
        {destinatario.nombre}
      </td>
      <td className="border border-gray-300 px-4 py-2">
        {destinatario.telefono}
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <span className={`px-2 py-1 rounded-full text-xs ${
          destinatario.estado === 'enviado' || destinatario.estado === 'sent_manual'
            ? 'bg-green-100 text-green-800'
            : destinatario.estado === 'pendiente'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {destinatario.estado === 'sent_manual' ? 'Enviado Manual' : destinatario.estado}
        </span>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        {destinatario.fecha_envio 
          ? new Date(destinatario.fecha_envio).toLocaleString('es-AR')
          : '-'
        }
      </td>
      <td className="border border-gray-300 px-4 py-2">
        {destinatario.estado === 'pendiente' ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleAbrirWhatsApp(destinatario)}
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
              title="Abrir en WhatsApp Web"
            >
              📱 Abrir WhatsApp
            </button>
            <button
              onClick={() => handleMarcarEnviado(destinatario.id)}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
              title="Marcar como enviado manualmente"
            >
              ✓ Enviado
            </button>
          </div>
        ) : destinatario.estado === 'sent_manual' ? (
          <span className="text-green-600 text-sm font-medium">✓ Enviado manualmente</span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
    </tr>
  ))}
</tbody>
```

---

## 📋 FLUJO COMPLETO DEL OPERADOR

### Paso a Paso

1. **Operador accede a "Ver Destinatarios"** de una campaña
2. Ve la tabla con destinatarios en estado `'pendiente'`
3. **Hace clic en "📱 Abrir WhatsApp"**:
   - Se construye URL: `https://web.whatsapp.com/send?phone=5491112345678&text=Hola%20Juan...`
   - Se abre **nueva pestaña** con WhatsApp Web
   - WhatsApp Web abre el chat con el destinatario
   - El mensaje aparece **precompletado** en el cuadro de texto
4. **Operador verifica el mensaje visualmente**
5. **Operador presiona ENVIAR manualmente** en WhatsApp Web
6. **Operador regresa a la vista de destinatarios en LeadMaster**
7. **Operador hace clic en "✓ Enviado"**:
   - Modal de confirmación: "¿Confirmas que enviaste el mensaje?"
   - Operador confirma
   - Se ejecuta: `PATCH /sender/destinatarios/{id}/marcar-enviado`
   - Estado cambia: `'pendiente'` → `'sent_manual'`
   - `fecha_envio` se actualiza con timestamp actual
8. **Vista se actualiza automáticamente**:
   - Los botones desaparecen de esa fila
   - Aparece texto: "✓ Enviado manualmente"
   - Badge de estado cambia a verde
   - Contadores de estadísticas se actualizan

---

## 🎨 DISEÑO VISUAL

### Estados con Badges

| Estado | Color | Texto |
|--------|-------|-------|
| `pendiente` | Amarillo | `⏳ pendiente` |
| `sent_manual` | Verde | `Enviado Manual` |
| `enviado` | Verde | `enviado` |
| `fallido` | Rojo | `fallido` |

### Botones

| Acción | Icono | Color | Visibilidad |
|--------|-------|-------|-------------|
| Abrir WhatsApp | 📱 | Verde | Solo si `estado = 'pendiente'` |
| Marcar Enviado | ✓ | Azul | Solo si `estado = 'pendiente'` |

---

## 🔒 VALIDACIONES DE SEGURIDAD

### Backend

1. **Verificar pertenencia al cliente**:
   - Solo se puede marcar como enviado destinatarios de campañas del cliente autenticado
2. **Validar estado actual**:
   - Solo se puede marcar como `'sent_manual'` si el estado actual es `'pendiente'`
3. **Autenticación requerida**:
   - Todas las rutas protegidas con middleware `authenticate`

### Frontend

1. **Confirmación explícita**:
   - Modal de confirmación antes de marcar como enviado
2. **Botones contextuales**:
   - Solo mostrar acciones relevantes según el estado actual
3. **Validación de URL**:
   - Limpiar teléfono de caracteres especiales
   - Codificar mensaje correctamente

---

## 🧪 CASOS DE USO

### Caso 1: Envío Exitoso Normal

**Entrada:**
- Destinatario ID 123
- Estado: `'pendiente'`
- Teléfono: `+54 9 11 6877-4444`
- Mensaje campaña: `"Hola {nombre}, te invitamos..."`

**Flujo:**
1. Operador click "Abrir WhatsApp"
2. URL generada: `https://web.whatsapp.com/send?phone=5491168774444&text=Hola...`
3. WhatsApp Web se abre correctamente
4. Operador envía mensaje
5. Operador click "✓ Enviado"
6. Confirma en modal
7. Estado cambia a `'sent_manual'`

**Resultado esperado:** ✅ Destinatario marcado como enviado, timestamp actualizado

---

### Caso 2: Destinatario sin Teléfono Válido

**Entrada:**
- Teléfono: `null` o vacío

**Resultado:** ⚠️ URL generada será inválida, WhatsApp Web mostrará error. El operador NO debe marcar como enviado.

---

### Caso 3: Intento de Marcar ya Enviado

**Entrada:**
- Destinatario ID 124
- Estado actual: `'sent_manual'`

**Flujo:**
1. Operador intenta hacer click en "✓ Enviado"
2. Botón no está visible (estado no es `'pendiente'`)

**Resultado esperado:** ✅ No se puede duplicar el envío

---

### Caso 4: Mensaje Personalizado

**Entrada:**
- Mensaje campaña: `"Hola, te invitamos..."`
- `mensaje_final` del destinatario: `"Hola Juan, te invitamos..."`

**Flujo:**
1. Sistema prioriza `mensaje_final`
2. URL usa el mensaje personalizado

**Resultado esperado:** ✅ Mensaje personalizado se envía correctamente

---

## 📊 MÉTRICAS Y ESTADÍSTICAS

### Contadores Actualizados

En la vista de destinatarios, los contadores se actualizan en tiempo real:

```javascript
{
  total: 100,
  enviados: 45,      // Incluye 'enviado' + 'sent_manual'
  pendientes: 50,    // Solo 'pendiente'
  fallidos: 5        // 'fallido'
}
```

**Lógica de conteo:**
```javascript
enviados: destinatarios.filter(d => 
  d.estado === 'enviado' || d.estado === 'sent_manual'
).length
```

---

## ⚠️ LIMITACIONES CONOCIDAS

1. **No hay confirmación automática de entrega**
   - El sistema NO verifica si el mensaje llegó realmente
   - Depende 100% de la honestidad del operador

2. **No hay integración con WhatsApp**
   - No se reciben webhooks de entrega/lectura
   - No se valida si el número está activo

3. **Posible doble envío manual**
   - Si el operador abre WhatsApp pero no marca como enviado
   - Otro operador podría abrir el mismo destinatario

4. **Dependencia de WhatsApp Web**
   - Si WhatsApp Web tiene problemas, el flujo falla
   - Requiere sesión activa de WhatsApp en el navegador

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: Backend (30 min)
1. ✅ Modificar `destinatariosController.js` - agregar método `marcarEnviadoManual`
2. ✅ Modificar `destinatarios.js` (routes) - agregar ruta PATCH
3. ✅ (Opcional) Modificar esquema BD si usa ENUM

### Fase 2: Frontend (45 min)
1. ✅ Modificar `destinatarios.js` (service) - agregar método API
2. ✅ Modificar `CampaignsManager.jsx` - agregar funciones auxiliares
3. ✅ Modificar tabla de destinatarios - agregar columna y botones

### Fase 3: Testing (30 min)
1. ✅ Test manual: abrir WhatsApp Web con diferentes teléfonos
2. ✅ Test manual: marcar como enviado y verificar actualización
3. ✅ Test: verificar permisos (cliente A no puede marcar destinatario de cliente B)
4. ✅ Test: intentar marcar ya enviado (debe fallar)

### Fase 4: Documentación (15 min)
1. ✅ Actualizar manual de usuario
2. ✅ Crear guía rápida para operadores

**Tiempo total estimado:** 2 horas

---

## 📝 NOTAS TÉCNICAS

### URL de WhatsApp Web

**Formato oficial:**
```
https://web.whatsapp.com/send?phone={numero}&text={mensaje}
```

**Parámetros:**
- `phone`: Número con código de país, sin + ni espacios (ej: `5491112345678`)
- `text`: Mensaje codificado con `encodeURIComponent()`

**Caracteres especiales:**
- Espacios → `%20`
- Saltos de línea → `%0A`
- Emojis → Codificación UTF-8

### Formato de Teléfono Argentina

**Formatos aceptados:**
- `+54 9 11 6877-4444` → Se limpia a: `5491168774444`
- `549 11 68774444` → Se limpia a: `5491168774444`
- `5491168774444` → Ya está limpio

**Regex de limpieza:**
```javascript
telefono.replace(/[\s\-\+]/g, '')
```

---

## ✅ CHECKLIST DE COMPLETITUD

- [x] Análisis de arquitectura existente
- [x] Definición de estados de destinatarios
- [x] Diseño de endpoint backend
- [x] Diseño de UI/UX
- [x] Validaciones de seguridad definidas
- [x] Casos de uso documentados
- [x] Limitaciones identificadas
- [x] Plan de implementación estructurado
- [ ] Código implementado
- [ ] Testing completado
- [ ] Documentación de usuario creada
- [ ] Deploy a producción

---

## 📞 SOPORTE Y CONTACTO

**Desarrollador:** Lead Master Team  
**Fecha límite:** Por definir  
**Prioridad:** Media  
**Impacto:** Medio - Funcionalidad nueva opcional

---

## 🔄 HISTORIAL DE REVISIONES

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-02-08 | 1.0 | Documento inicial - Especificación completa |

---

**FIN DEL INFORME**
