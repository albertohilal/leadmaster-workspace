# 📝 Manual de Usuario - Edición de Campañas

## 🎯 Introducción

Este manual explica cómo editar campañas de WhatsApp en LeadMaster Central Hub, las limitaciones de seguridad y el flujo de aprobaciones.

---

## 🔐 Reglas de Seguridad y Validaciones

### ⚠️ **IMPORTANTE: Integridad de Datos**

**NO se pueden editar campañas que ya han comenzado a enviarse** por las siguientes razones críticas:

- **Inconsistencia de mensajes**: Los destinatarios ya contactados tendrían contenido diferente
- **Pérdida de trazabilidad**: No se puede rastrear qué versión recibió cada cliente
- **Problemas de auditoría**: Complicaciones legales y de seguimiento
- **Métricas incorrectas**: Análisis de efectividad comprometido

### ✅ Estados Editables

| Estado | ¿Se puede editar? | Descripción |
|--------|-------------------|-------------|
| `pendiente` | ✅ **SÍ** | Campaña recién creada, sin procesar |
| `pendiente_aprobacion` | ✅ **SÍ** | Esperando aprobación del administrador |
| `programada` | ✅ **SÍ** | Programada pero no iniciada |
| `activa` | ❌ **NO** | En proceso de envío |
| `completada` | ❌ **NO** | Envío finalizado |
| `pausada` | ❌ **NO** | Pausada pero ya envió algunos mensajes |

---

## 🚀 Cómo Editar una Campaña

### Paso 1: Acceder a Campañas
1. Ingresa al sistema con tu usuario y contraseña
2. Navega a **"Campañas"** en el menú principal
3. Verás la lista de tus campañas

### Paso 2: Identificar Campañas Editables
- Busca el botón **"✏️ Editar"** junto a la campaña
- Si NO ves el botón, significa que la campaña **no se puede editar**
- Las campañas editables muestran estados: `Pendiente Aprobación`, `Programada`

### Paso 3: Editar la Campaña
1. **Clic en "✏️ Editar"**
2. Se abre el modal de edición con los campos actuales
3. **Modifica los campos necesarios:**
   - **Nombre**: Título identificativo de la campaña
   - **Descripción**: Objetivo o contexto de la campaña
   - **Mensaje**: Contenido que se enviará por WhatsApp
   - **Programar envío**: ✅ Activar si quieres programar fecha/hora
   - **Fecha y hora**: Solo si activaste "Programar envío"

### Paso 4: Guardar Cambios
1. **Clic en "💾 Guardar Cambios"**
2. El sistema validará que la campaña sea editable
3. Si es válida: **Estado cambia a "Pendiente Aprobación"**
4. Recibirás confirmación: *"Campaña editada exitosamente"*

---

## 🔄 Flujo de Aprobaciones

### Después de Editar:
1. **Estado automático**: `Pendiente Aprobación`
2. **Requiere**: Nueva autorización del administrador
3. **No se puede enviar** hasta que sea aprobada
4. **El administrador debe**: Revisar y aprobar los cambios

### Estados Post-Edición:
- **Admin aprueba** → Estado: `Programada` o `Lista para enviar`
- **Admin rechaza** → Estado: `Rechazada` + comentarios
- **Mientras tanto** → Estado: `Pendiente Aprobación`

---

## ❌ Mensajes de Error Comunes

### "No se pueden editar campañas que ya han comenzado a enviarse"

**Causas posibles:**
- La campaña ya tiene mensajes enviados
- Estado actual: `activa`, `completada`, o `pausada`
- Protección de integridad de datos activada

**Solución:** 
- ✅ Crear una **nueva campaña** con el contenido corregido
- ✅ Contactar al administrador para casos especiales

### "Fecha y hora de envío requeridas para campañas programadas"

**Causa:** Activaste "Programar envío" pero no seleccionaste fecha/hora

**Solución:**
- Selecciona fecha y hora válidas en el futuro
- O desactiva "Programar envío" para envío inmediato (tras aprobación)

### "El mensaje de la campaña es requerido"

**Causa:** Campo mensaje vacío o solo espacios

**Solución:** Escribe el contenido del mensaje que se enviará

---

## 💡 Mejores Prácticas

### ✅ Recomendaciones
1. **Revisa bien antes de crear** - Editar requiere nueva aprobación
2. **Usa nombres descriptivos** - Facilita identificación posterior
3. **Programa con tiempo** - Permite revisión del administrador
4. **Guarda borradores** - Usa descripción para notas internas
5. **Valida el mensaje** - Verifica formato y contenido antes de guardar

### ❌ Evita
- Crear campañas "de prueba" innecesarias
- Editar repetidamente (genera trabajo extra al admin)
- Fechas de envío muy cercanas (poco tiempo para aprobación)
- Mensajes genéricos sin personalización

---

## 🆘 Soporte y Ayuda

### Problemas Técnicos
1. **Refresca la página** y vuelve a intentar
2. **Verifica tu conexión** a internet
3. **Contacta al administrador** si persiste el problema

### Dudas sobre Contenido
- **Consulta con el administrador** sobre:
  - Políticas de mensajería
  - Horarios permitidos
  - Contenido apropiado
  - Segmentación de audiencias

### Contacto Técnico
- **Email**: [email del administrador]
- **WhatsApp**: [número de soporte]
- **Horarios**: [horarios de atención]

---

## 📊 Ejemplo Práctico

### Escenario: Editar Mensaje de Campaña Navideña

**1. Situación Inicial:**
- Campaña: "Promoción Navidad 2025"
- Estado: `Pendiente Aprobación`
- Mensaje original: "Oferta especial 20% descuento"

**2. Necesidad de Cambio:**
- Error en porcentaje: Debería ser 25% no 20%
- Agregar código de descuento: "NAVIDAD25"

**3. Proceso de Edición:**
```
1. Clic en "✏️ Editar" → Se abre modal
2. Modificar mensaje:
   "🎄 Oferta especial 25% descuento
   Usa código: NAVIDAD25
   Válido hasta 31/12/2025"
3. Clic en "💾 Guardar Cambios"
4. Confirmación: "Campaña editada exitosamente"
5. Nuevo estado: "Pendiente Aprobación"
```

**4. Resultado:**
- ✅ Campaña actualizada con información correcta
- ⏳ Esperando nueva aprobación del administrador
- 📧 Administrador notificado de los cambios

---

*💡 **Recuerda**: La edición de campañas tiene restricciones por seguridad. Siempre verifica el contenido antes de crear para minimizar ediciones posteriores.*