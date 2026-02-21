# Instrucciones para Crear el Pull Request

## Contexto
La fase "Estabilización y Hardening de Producción" está completada y validada.
Branch: `feature/central-hub-session-manager` → `main`

## Opción 1: Crear PR via GitHub Web Interface (RECOMENDADO)

1. **Navegar al repositorio:**
   ```
   https://github.com/albertohilal/leadmaster-workspace
   ```

2. **Crear Pull Request:**
   - Click en "Pull requests" → "New pull request"
   - Base: `main`
   - Compare: `feature/central-hub-session-manager`
   - Click "Create pull request"

3. **Usar el template:**
   - El contenido de `.github/PULL_REQUEST_TEMPLATE.md` se cargará automáticamente
   - Título sugerido: **"Estabilización y Hardening de Producción"**
   - El template ya incluye:
     ✅ Checklist de tareas completadas
     ✅ Scope del merge
     ✅ Validación pre-merge
     ✅ Referencia al documento de cierre de fase

4. **Finalizar:**
   - Click "Create pull request"
   - Asignar reviewers (opcional)
   - Agregar labels: `production`, `hardening`, `documentation`

## Opción 2: Crear PR via GitHub CLI (Requiere instalación)

```bash
# Instalar GitHub CLI (si no está instalado)
sudo apt install gh

# Autenticar
gh auth login

# Crear PR con template
cd /root/leadmaster-workspace
gh pr create \
  --base main \
  --head feature/central-hub-session-manager \
  --title "Estabilización y Hardening de Producción" \
  --body-file .github/PULL_REQUEST_TEMPLATE.md \
  --label production,hardening,documentation
```

## Opción 3: URL Directa (Más Rápido)

Abrir esta URL en el navegador:

```
https://github.com/albertohilal/leadmaster-workspace/compare/main...feature/central-hub-session-manager?quick_pull=1&template=PULL_REQUEST_TEMPLATE.md
```

GitHub cargará automáticamente:
- Base branch: `main`
- Compare branch: `feature/central-hub-session-manager`
- Template: `.github/PULL_REQUEST_TEMPLATE.md`

Solo falta:
1. Agregar título: "Estabilización y Hardening de Producción"
2. Click "Create pull request"

---

## Contenido del PR (Pre-cargado en el Template)

El template incluye:

✅ **Resumen ejecutivo** de la fase cerrada
✅ **Checklist completo** de tareas completadas (10 ítems principales)
✅ **Scope del merge** (qué incluye y qué NO incluye)
✅ **Cambios principales** (archivos modificados/creados/refactorizados)
✅ **Validación pre-merge** (tests, PM2, health check, Git)
✅ **Deuda técnica** identificada y documentada
✅ **Criterios de cierre** cumplidos
✅ **Referencias** a documentación técnica:
   - `services/central-hub/CIERRE_DE_FASE.md` (acta formal)
   - `services/central-hub/docs/` (documentación completa)
✅ **Aprobación formal** con fecha y commit final

---

## Después de Crear el PR

1. **Compartir URL del PR** con stakeholders
2. **Solicitar code review** (opcional pero recomendado)
3. **Esperar aprobación** de reviewers
4. **Merge a main** cuando esté aprobado
5. **Deployment a producción** siguiendo `docs/PM2_PRODUCTION_DEPLOYMENT.md`

---

## Validación Final Pre-Merge

Todos estos checks ya han sido ejecutados y pasaron:

```bash
✅ npm run test:unit → 27/27 passing
✅ pm2 list → leadmaster-hub: online, 0 restarts
✅ curl http://localhost:3012/health → 200 OK
✅ git status → working tree clean
✅ git push origin feature/central-hub-session-manager → up-to-date
```

**Sistema validado y listo para merge a main.**

---

**SIGUIENTE ACCIÓN:** Crear el PR usando una de las 3 opciones anteriores.
