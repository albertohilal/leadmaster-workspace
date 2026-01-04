# 📋 GUÍA: GESTIÓN DE DESTINATARIOS EN CAMPAÑAS

## 🚀 RESUMEN RÁPIDO

**¿Cómo agregar/quitar destinatarios a una campaña?**

### ✅ **MÉTODOS DISPONIBLES:**

---

## 1️⃣ **VIA API REST (Backend)**

### **Agregar Destinatarios**
```bash
POST /sender/destinatarios/campania/{campaniaId}/agregar

Body:
{
  "destinatarios": [
    { "telefono": "5491168777888", "nombre": "Juan Pérez" },
    { "telefono": "5491168777889", "nombre": "María González" }
  ]
}
```

### **Quitar Destinatarios**
```bash
DELETE /sender/destinatarios/campania/{campaniaId}/quitar

Body:
{
  "telefonos": ["5491168777888", "5491168777889"]
}
```

---

## 2️⃣ **VIA INTERFAZ WEB (Frontend)**

### **Ubicación:** Módulo de Campañas → Ver Destinatarios → Gestionar

### **Funciones:**
- ➕ **Agregar Destinatarios**: Manual o via CSV
- ➖ **Quitar Destinatarios**: Por lista de teléfonos
- 📊 **Ver Resumen**: Total, enviados, pendientes, fallidos

---

## 3️⃣ **CASOS DE USO PRÁCTICOS**

### **📝 Agregar Manualmente**
```javascript
// Frontend
import GestorDestinatarios from './components/admin/GestorDestinatarios';

<GestorDestinatarios 
  campaniaId={campania.id}
  onDestinatariosUpdated={() => recargarDatos()}
/>
```

### **📁 Carga Masiva CSV**
```csv
telefono,nombre
5491168777888,Juan Pérez
5491168777889,María González
5491168777890,Carlos López
```

### **🔍 Via Base de Datos Directa**
```sql
-- Agregar destinatario
INSERT INTO ll_envios_whatsapp 
(campania_id, telefono_wapp, nombre_destino, estado, fecha_creacion, cliente_id)
VALUES (1, '5491168777888', 'Juan Pérez', 'pendiente', NOW(), 51);

-- Quitar destinatario (solo pendientes)
DELETE FROM ll_envios_whatsapp 
WHERE campania_id = 1 
  AND telefono_wapp = '5491168777888' 
  AND estado IN ('pendiente', 'error');
```

---

## 4️⃣ **VALIDACIONES Y RESTRICCIONES**

### **✅ Permitido:**
- Agregar destinatarios únicos por campaña
- Quitar destinatarios con estado `pendiente` o `error`
- Carga masiva via CSV
- Validación de formatos de teléfono

### **❌ No Permitido:**
- Agregar duplicados (se reporta pero no falla)
- Quitar destinatarios ya `enviados` o `entregados`
- Teléfonos sin formato válido
- Nombres vacíos

---

## 5️⃣ **TESTING**

```bash
# Ejecutar test completo
node test-destinatarios.js

# Verificar APIs manualmente
curl -X POST http://localhost:3011/sender/destinatarios/campania/1/agregar \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destinatarios":[{"telefono":"5491168777888","nombre":"Test"}]}'
```

---

## 🎯 **FLUJO RECOMENDADO**

1. **📊 Ver estado actual** → GET `/resumen`
2. **➕ Agregar destinatarios** → POST `/agregar`
3. **🔍 Verificar agregados** → GET `/resumen`
4. **➖ Quitar si es necesario** → DELETE `/quitar`
5. **✅ Confirmar final** → GET `/resumen`

---

## 🚀 **IMPLEMENTACIÓN COMPLETA**

**✅ Backend APIs listas**
**✅ Frontend component listo** 
**✅ Validaciones implementadas**
**✅ Tests incluidos**

**🎉 SISTEMA COMPLETO DE GESTIÓN DE DESTINATARIOS OPERATIVO**