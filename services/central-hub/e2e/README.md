# E2E Tests - WhatsApp Smoke Test (Producción - Contabo VPS)

## Descripción

Test end-to-end mínimo (smoke test) para validar el flujo básico de WhatsApp **en producción**.

### Contexto Real

- **Entorno:** VPS Contabo (sin entorno gráfico)
- **Frontend:** Servido por Nginx en `https://desarrolloydisenioweb.com.ar`
- **Backend:** PM2 corriendo central-hub (puerto 3012)
- **Session Manager:** PM2 corriendo session-manager (puerto 3001)
- **Ejecución:** Headless mode (sin display)

### Tests incluidos

1. **Login y estado de WhatsApp**
   - Login con credenciales válidas
   - Navegación a vista WhatsApp
   - Verificación de estado (READY, QR_REQUIRED, DISCONNECTED, CONNECTING)
   - No automatiza escaneo de QR ni envío de mensajes

2. **Manejo de errores de login**
   - Validación de credenciales incorrectas
   - Verificación de mensajes de error

3. **Logout desde vista WhatsApp**
   - Cierre de sesión exitoso
   - Redirección a login

---

## Configuración

### 1. Instalar Playwright (si no está instalado)

```bash
cd /root/leadmaster-workspace/services/central-hub
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Configurar variables de entorno

**Opción A: Variables de entorno directas**

```bash
export E2E_BASE_URL="https://desarrolloydisenioweb.com.ar"
export E2E_USER="admin"
export E2E_PASS="tu_password_real"
```

**Opción B: Archivo `.env.test.local`**

```bash
cp .env.e2e.example .env.test.local
nano .env.test.local
```

Contenido:
```bash
E2E_BASE_URL=https://desarrolloydisenioweb.com.ar
E2E_USER=admin
E2E_PASS=tu_password_real
```

### 3. Verificar servicios en producción

**NO es necesario levantar frontend local** (Nginx ya lo sirve).

Verificar que estén corriendo:

```bash
# Backend
pm2 list | grep leadmaster-central-hub

# Session Manager  
pm2 list | grep session-manager

# Nginx
systemctl status nginx
```

---

## Ejecución en Producción (Contabo VPS)

### Método recomendado: Script automatizado

```bash
# Setear credenciales
export E2E_USER="admin"
export E2E_PASS="tu_password"

# Ejecutar
cd /root/leadmaster-workspace/services/central-hub
./scripts/run-e2e-production.sh
```

### Método manual

```bash
# Con variables de entorno
E2E_BASE_URL=https://desarrolloydisenioweb.com.ar \
E2E_USER=admin \
E2E_PASS=tu_password \
npx playwright test --project="E2E Tests - WhatsApp"

# O cargar desde archivo
source .env.test.local
npx playwright test --project="E2E Tests - WhatsApp" --reporter=list
```

### Ejecución con UI (debugging - requiere X server)

⚠️ **Solo funciona si hay display gráfico disponible** (VNC, X11 forwarding, etc.)

```bash
source .env.test.local
npx playwright test e2e/whatsapp-smoke.spec.js --ui
```

### En modo debug (headless con traces)

```bash
source .env.test.local
npx playwright test --project="E2E Tests - WhatsApp" --debug
```

### Solo un test específico

```bash
source .env.test.local
npx playwright test e2e/whatsapp-smoke.spec.js -g "debe permitir login"
```

---

## Resultados

### Reportes

```bash
# Ver reporte HTML
npm run test:report
```

### Screenshots

Se guardan en `test-results/` cuando un test falla o en puntos clave del flujo.

### Videos

Solo se graban cuando un test falla (configurado en `playwright.config.js`).

---

## Notas Importantes

### Estados de WhatsApp

El test acepta **cualquiera de estos estados como válidos**:

- `READY` - WhatsApp conectado y listo
- `QR_REQUIRED` - Necesita escanear QR
- `DISCONNECTED` - Desconectado
- `CONNECTING` - Conectando

**No se asume que WhatsApp esté en READY.**

### Limitaciones

❌ **NO automatiza:**
- Escaneo de QR code
- Envío real de mensajes de WhatsApp
- Conexión real a WhatsApp Web

✅ **SÍ valida:**
- Flujo de login/logout
- Renderizado de UI según estado
- Navegación entre vistas
- Visualización correcta de elementos

### Data Test IDs Recomendados

Para mejorar la estabilidad de los tests, agregar estos `data-testid` en el frontend:

```jsx
// Login
<form data-testid="login-form">
  <input data-testid="username-input" />
  <input data-testid="password-input" />
  <button data-testid="login-button">Login</button>
</form>

// Navegación
<a data-testid="nav-whatsapp" href="/whatsapp">WhatsApp</a>

// WhatsApp
<div data-testid="whatsapp-status">{status}</div>
<button data-testid="connect-button">Conectar</button>
<button data-testid="send-message-button">Enviar</button>
<button data-testid="logout-button">Salir</button>

// QR (si aplica)
<div data-testid="qr-code">
  <img alt="QR Code" />
</div>

// Errores
<div data-testid="error-message" role="alert">{error}</div>
```

---

## Troubleshooting

### Error: "Credenciales E2E no configuradas"

```bash
# Verificar que las variables estén seteadas
echo $E2E_USER
echo $E2E_PASS

# Si están vacías, cargar el .env
source .env.test.local
```

### Error: "net::ERR_CONNECTION_REFUSED"

**En localhost:**
```bash
# Verificar que el frontend esté corriendo
curl http://localhost:5173
```

**En producción:**
```bash
# Verificar Nginx
systemctl status nginx

# Verificar conectividad
curl -I https://desarrolloydisenioweb.com.ar

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
```

### Error: "Timeout waiting for selector"

El selector del elemento cambió en el frontend. Opciones:

1. Agregar `data-testid` apropiado en el componente React
2. Actualizar el selector en el test para que sea más flexible

### Screenshots de debugging

```bash
# Ver screenshots en:
ls -lh test-results/*.png

# Abrir última captura
xdg-open test-results/whatsapp-state-*.png
```

---

## Integración Continua (CI)

Para ejecutar en CI/CD:

```yaml
# Ejemplo GitHub Actions
- name: Run E2E Tests
  env:
    E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
    E2E_USER: ${{ secrets.E2E_USER }}
    E2E_PASS: ${{ secrets.E2E_PASS }}
  run: |
    npm run test:pw e2e/whatsapp-smoke.spec.js
```

---

## Mantenimiento

### Actualizar Playwright

```bash
npm update @playwright/test
npx playwright install chromium
```

### Agregar nuevos tests

1. Crear archivo en `e2e/nuevo-test.spec.js`
2. Seguir la estructura de `whatsapp-smoke.spec.js`
3. Usar variables de entorno para configuración
4. NO hardcodear URLs ni credenciales
5. Agregar data-testid en frontend cuando sea necesario

---

## Referencias

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
