# 🚀 Metodología de Desarrollo VPS-First

**LeadMaster Workspace** - Desarrollo directo en servidor

---

## 📋 Resumen Ejecutivo

Este proyecto se desarrolla **directamente en el servidor VPS** mediante SSH. No hay entorno local ni pipeline de deploy separado. Esta metodología requiere disciplina estricta en versionado y manejo de cambios.

**Características:**
- ✅ Desarrollo en servidor de producción/staging
- ✅ Uso de branches como entorno de trabajo
- ✅ PM2 para gestión de procesos
- ✅ Git como única herramienta de versionado y rollback
- ❌ No hay entorno local
- ❌ No hay pipeline CI/CD separado

---

## 🎯 Reglas Operativas OBLIGATORIAS

### 1️⃣ **NUNCA trabajar en `main` directamente**
```bash
# ❌ MAL
git checkout main
# ... hacer cambios ...

# ✅ BIEN
git checkout -b feature/nueva-funcionalidad
# ... hacer cambios ...
```

### 2️⃣ **Commits pequeños y atómicos**
- Un commit = una funcionalidad/fix
- Mensajes descriptivos
- NO acumular cambios de múltiples features

```bash
# ✅ Ejemplos de buenos commits
git commit -m "fix: corregir validación de telefono_wapp en destinatarios"
git commit -m "feat: agregar normalización de campos de teléfono en frontend"
git commit -m "refactor: optimizar query de prospectos con índices"
```

### 3️⃣ **NUNCA reiniciar PM2 con cambios sin commitear**
```bash
# ❌ MAL - cambios sin commitear
git status  # muestra cambios
pm2 restart all  # reiniciar sin guardar

# ✅ BIEN - siempre commitear primero
git add .
git commit -m "descripción del cambio"
git push origin nombre-branch
pm2 restart all
```

### 4️⃣ **Tags para puntos de estabilidad**
Crear tags cuando una funcionalidad está funcionando correctamente:

```bash
# Después de probar que todo funciona
git tag stable-funcionalidad-descripcion
git push origin stable-funcionalidad-descripcion
```

---

## 🔄 Flujo de Trabajo Paso a Paso

### Inicio de Nueva Funcionalidad

```bash
# 1. Asegurar que estás en main actualizado
git checkout main
git pull origin main

# 2. Crear branch de trabajo
git checkout -b feature/nombre-descriptivo

# 3. Verificar estado limpio
git status
```

### Durante el Desarrollo

```bash
# 1. Hacer cambios en código

# 2. Probar localmente en el VPS
npm run build  # si es frontend
pm2 restart leadmaster-central-hub

# 3. Verificar logs
pm2 logs leadmaster-central-hub --lines 30 --nostream

# 4. Si funciona, commitear inmediatamente
git add .
git commit -m "tipo: descripción clara"
git push origin feature/nombre-descriptivo
```

### Punto de Estabilidad

```bash
# Cuando una funcionalidad está completa y probada
git tag stable-nombre-funcionalidad
git push origin stable-nombre-funcionalidad

# Opcional: merge a main si es necesario
git checkout main
git merge feature/nombre-descriptivo
git push origin main
```

### Rollback en Caso de Error

```bash
# Ver tags disponibles
git tag -l

# Volver a un punto estable
git checkout stable-ultima-version-estable

# Reiniciar servicios
pm2 restart all

# Verificar que funciona
pm2 status
pm2 logs leadmaster-central-hub --lines 20
```

---

## 📦 Comandos PM2 Esenciales

### Estado y Control
```bash
# Ver todos los procesos
pm2 status

# Reiniciar servicio específico
pm2 restart leadmaster-central-hub
pm2 restart session-manager

# Reiniciar todos
pm2 restart all

# Ver logs en tiempo real
pm2 logs leadmaster-central-hub

# Ver últimos N logs
pm2 logs leadmaster-central-hub --lines 50 --nostream

# Detener/Iniciar
pm2 stop leadmaster-central-hub
pm2 start leadmaster-central-hub
```

### Información de Procesos
```bash
# Ver detalles de un proceso
pm2 describe leadmaster-central-hub

# Monitoreo en tiempo real
pm2 monit
```

---

## 🏗️ Estructura de Branches

```
main (producción)
  ├── feature/nombre-funcionalidad-1
  ├── feature/nombre-funcionalidad-2
  ├── fix/bug-especifico
  └── hotfix/urgente-produccion
```

**Convención de nombres:**
- `feature/` - Nueva funcionalidad
- `fix/` - Corrección de bug
- `hotfix/` - Fix urgente en producción
- `refactor/` - Refactorización de código
- `docs/` - Solo documentación

---

## ⚠️ Riesgos Conocidos y Mitigación

### 🔴 Riesgo: Perder cambios sin guardar
**Mitigación:**
- Commitear frecuentemente (cada 15-30 min de trabajo)
- Usar `git status` antes de cualquier operación destructiva
- NUNCA hacer `git reset --hard` sin verificar

### 🔴 Riesgo: Romper producción con código no probado
**Mitigación:**
- Siempre trabajar en branch
- Probar cambios antes de commitear
- Usar tags para marcar estados estables
- Verificar logs de PM2 después de cada restart

### 🔴 Riesgo: Conflictos de merge
**Mitigación:**
- Mantener branches cortos en tiempo (1-2 días máx)
- Hacer merge frecuente desde main
- Resolver conflictos inmediatamente

### 🔴 Riesgo: PM2 cae y no se levanta
**Mitigación:**
```bash
# Verificar estado
pm2 status

# Si está caído, ver logs de error
pm2 logs --err

# Reiniciar con logs frescos
pm2 restart all
pm2 logs --lines 50
```

---

## 🧪 Checklist Pre-Deploy

Antes de reiniciar PM2 con cambios:

- [ ] Código commiteado y pusheado
- [ ] `git status` muestra working tree limpio
- [ ] Frontend buildeado si aplica (`npm run build`)
- [ ] Variables de entorno verificadas
- [ ] Branch tiene nombre descriptivo
- [ ] Commit message es claro

---

## 🔧 Comandos de Emergencia

### Rollback Rápido
```bash
# Ver último commit estable
git log --oneline --decorate

# Volver al último commit
git reset --hard HEAD~1

# O volver a un tag específico
git checkout stable-ultima-version

# Reiniciar servicios
pm2 restart all
pm2 logs --lines 30
```

### Ver Estado Actual
```bash
# Git
git status
git log --oneline -5
git branch

# PM2
pm2 status
pm2 describe leadmaster-central-hub

# Sistema
df -h  # Espacio en disco
free -h  # Memoria
top  # Procesos
```

### Limpiar Procesos Zombies
```bash
# Si PM2 está en estado inconsistente
pm2 delete all
pm2 start ecosystem.config.js
```

---

## 📁 Directorios Importantes

```
/root/leadmaster-workspace/
├── services/
│   ├── central-hub/          # Backend principal + Frontend
│   │   ├── frontend/         # React app
│   │   ├── src/              # Backend Node.js
│   │   └── ecosystem.config.js
│   └── session-manager/      # Servicio WhatsApp
├── docs/                     # Documentación
├── shared/                   # Código compartido
└── DEV_WORKFLOW_VPS.md       # Este archivo
```

**Archivos críticos:**
- `ecosystem.config.js` - Configuración PM2
- `package.json` - Dependencias
- `.env` - Variables de entorno (NO commitear)

---

## 📚 Recursos y Referencias

### Git
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- `man git` en terminal

### PM2
- [Documentación oficial PM2](https://pm2.keymetrics.io/docs)
- `pm2 --help`

### Node.js / React
- Logs de build en `frontend/dist/`
- Logs de PM2 en `~/.pm2/logs/`

---

## 🤝 Contribución y Buenas Prácticas

1. **Comunicación**: Avisar antes de hacer cambios grandes
2. **Documentación**: Actualizar docs cuando cambias flujos
3. **Testing**: Probar manualmente antes de commitear
4. **Logs**: Siempre revisar logs después de restart
5. **Backup**: Los tags son tus puntos de backup

---

## 📞 Soporte

Si algo sale mal:
1. Check logs: `pm2 logs --lines 50`
2. Check status: `pm2 status`
3. Check git: `git status && git log -3`
4. Rollback si es necesario: `git checkout <tag-estable>`
5. Documentar el problema para evitarlo en el futuro

---

**Última actualización:** 2026-02-09  
**Versión del documento:** 1.0
