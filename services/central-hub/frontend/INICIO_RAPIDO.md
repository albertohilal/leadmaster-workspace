# 🚀 Inicio Rápido - LeadMaster Frontend

## Iniciar el proyecto

### Opción 1: Desarrollo Normal
```bash
cd /home/beto/Documentos/Github/leadmaster-central-hub/frontend
npm run dev
```

El dashboard estará disponible en: **http://localhost:5173**

### Opción 2: Con el backend ya corriendo
```bash
# Terminal 1: Backend (debe estar corriendo en puerto 3010)
cd /home/beto/Documentos/Github/leadmaster-central-hub
node src/index.js

# Terminal 2: Frontend
cd /home/beto/Documentos/Github/leadmaster-central-hub/frontend
npm run dev
```

## URLs importantes

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3010
- **Documentación API:** Ver `/docs/ENDPOINTS_SESSION_MANAGER.md`

## Páginas disponibles

- `/` - Dashboard principal
- `/whatsapp` - Gestión de sesión WhatsApp
- `/leads` - Gestión de leads/clientes
- `/listener` - Control del listener
- `/campaigns` - Gestión de campañas
- `/config` - Configuración del sistema

## Solución de problemas

### Error de conexión con API
- Verifica que el backend esté corriendo en puerto 3010
- Revisa la variable `VITE_API_URL` en `.env`
- Asegúrate de que CORS esté habilitado en el backend

### Dependencias faltantes
```bash
cd frontend
npm install
```

### Puerto 5173 ocupado
```bash
# Cambia el puerto en vite.config.js
server: {
  port: 5174  // O cualquier otro puerto disponible
}
```

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview

# Verificar errores
npm run lint  # (si está configurado)
```

## Características implementadas

✅ Layout completo con sidebar y header  
✅ Dashboard con métricas en tiempo real  
✅ Gestión de sesión WhatsApp con QR  
✅ CRUD completo de leads  
✅ Control del listener (modos)  
✅ Gestión de campañas  
✅ Panel de configuración  
✅ Componentes reutilizables  
✅ Diseño responsive  
✅ Actualización automática  

## Próximos pasos

1. Implementar los endpoints faltantes en el backend
2. Conectar con datos reales de MySQL
3. Agregar WebSockets para actualizaciones en tiempo real
4. Implementar autenticación de usuarios
5. Agregar tests unitarios con Vitest
