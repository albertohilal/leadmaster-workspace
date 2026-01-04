# Troubleshooting: QR Event No Emitido en whatsapp-web.js Headless

## 🔍 Causas Probables (Orden de Probabilidad)

### 1. **Chrome no puede renderizar el QR internamente** (90% probabilidad)
**Causa:** Puppeteer/Chrome necesita cargar recursos de WhatsApp Web que generan el QR, pero faltan dependencias gráficas o fonts.

**Verificar:**
```bash
# Ver logs de Chrome en tiempo real
google-chrome-stable --headless --disable-gpu --no-sandbox 2>&1 | grep -i "error\|fail\|font"

# Verificar dependencias
ldd /usr/bin/google-chrome-stable | grep "not found"

# Verificar fonts
fc-list | grep -i "dejavu\|liberation" || echo "Fonts missing"
```

**Corrección Mínima:**
```javascript
// En línea 80, agregar ANTES de los args existentes:
puppeteer: {
  headless: true,
  executablePath: '/usr/bin/google-chrome-stable',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-software-rasterizer',  // ← AGREGAR
    '--disable-dev-tools',             // ← AGREGAR
    '--single-process'                 // ← AGREGAR (último recurso)
  ]
}
```

**Tipo:** Ambiente (VPS sin GUI)

---

### 2. **Timeout de Puppeteer muy corto** (80% probabilidad)
**Causa:** whatsapp-web.js usa timeout default de 45s. En VPS lentos o con latencia, WhatsApp Web tarda más en cargar.

**Verificar:**
```javascript
// Agregar logging temporal en línea 100:
client.on('qr', async (qr) => {
  console.log(`🔑 [DEBUG] QR event fired at ${Date.now()}`);
  // ... resto del código
});

// Agregar antes de client.initialize() (línea ~190):
console.log(`⏱️ [DEBUG] Initializing at ${Date.now()}, waiting for QR...`);
```

**Corrección Mínima:**
```javascript
// Línea 80, agregar dentro del objeto Client:
const client = new Client({
  authStrategy: new LocalAuth({ /* ... */ }),
  puppeteer: { /* ... */ },
  qrMaxRetries: 5,           // ← AGREGAR
  takeoverOnConflict: true,  // ← AGREGAR
  takeoverTimeoutMs: 60000   // ← AGREGAR (60s en vez de 45s)
});
```

**Tipo:** Código + Ambiente (VPS lento)

---

### 3. **Race condition: client.initialize() antes de registrar listeners** (70% probabilidad)
**Causa:** El evento 'qr' se emite ANTES de que el listener sea registrado.

**Verificar:**
```javascript
// Línea 100-110, agregar timestamp:
client.on('qr', async (qr) => {
  console.log(`🔑 [QR] Event received at ${new Date().toISOString()}`);
  // ...
});

// Línea 191, verificar orden:
console.log(`📝 [QR] Listener registered at ${new Date().toISOString()}`);
client.initialize().then(() => {
  console.log(`✅ [INIT] Completed at ${new Date().toISOString()}`);
});
```

**Corrección Mínima:**
```javascript
// MOVER todos los client.on() ANTES de cualquier operación
// Orden correcto (líneas 100-189):

// 1. Crear cliente
const client = new Client({ /* ... */ });

// 2. Registrar TODOS los listeners INMEDIATAMENTE
client.on('qr', async (qr) => { /* ... */ });
client.on('authenticated', () => { /* ... */ });
client.on('ready', () => { /* ... */ });
client.on('auth_failure', (msg) => { /* ... */ });
client.on('disconnected', async (reason) => { /* ... */ });

// 3. DESPUÉS inicializar
client.initialize().catch((error) => { /* ... */ });
```

**Tipo:** Código (timing)

---

### 4. **WhatsApp Web bloquea headless browsers** (60% probabilidad)
**Causa:** WhatsApp detecta Puppeteer/headless y no muestra QR (protección anti-bot).

**Verificar:**
```bash
# Capturar screenshot para ver qué muestra WhatsApp
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: '/tmp/wa-test.png' });
  await browser.close();
  console.log('Screenshot: /tmp/wa-test.png');
})();
"
```

**Corrección Mínima:**
```javascript
// Línea 80, agregar stealth args:
puppeteer: {
  headless: true,
  executablePath: '/usr/bin/google-chrome-stable',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',  // ← AGREGAR (anti-detección)
    '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'  // ← AGREGAR
  ]
}
```

**Tipo:** Ambiente + Código (detección headless)

---

### 5. **Permisos o espacio insuficiente en /tmp** (50% probabilidad)
**Causa:** Puppeteer escribe archivos temporales en `/tmp` o `~/.config/google-chrome`. Si falla, no puede renderizar.

**Verificar:**
```bash
# Espacio en /tmp
df -h /tmp

# Permisos de escritura
touch /tmp/test-puppeteer && rm /tmp/test-puppeteer && echo "OK" || echo "FAIL"

# Espacio en dataPath
du -sh /root/leadmaster-workspace/services/central-hub/tokens
df -h /root/leadmaster-workspace/services/central-hub/tokens
```

**Corrección Mínima:**
```javascript
// Línea 80, forzar directorio temporal custom:
puppeteer: {
  headless: true,
  executablePath: '/usr/bin/google-chrome-stable',
  userDataDir: '/tmp/puppeteer-chrome-data',  // ← AGREGAR
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    `--user-data-dir=/tmp/puppeteer-chrome-${Date.now()}`  // ← AGREGAR (único por sesión)
  ]
}
```

**Tipo:** Ambiente (VPS config)

---

### 6. **LocalAuth dataPath corrupto o inaccesible** (40% probabilidad)
**Causa:** La ruta `../../../tokens` no existe o no tiene permisos.

**Verificar:**
```bash
# Verificar que la ruta existe
cd /root/leadmaster-workspace/services/central-hub/src/modules/session-manager/services
ls -la ../../../tokens

# Permisos
stat ../../../tokens | grep "Access"

# Crear si no existe
mkdir -p ../../../tokens
chmod 755 ../../../tokens
```

**Corrección Mínima:**
```javascript
// Línea 81, usar ruta absoluta:
authStrategy: new LocalAuth({
  clientId: name,
  dataPath: path.resolve(__dirname, '../../../tokens')  // ← path.resolve en vez de path.join
}),
```

**Tipo:** Código (path handling)

---

## 🎯 Diagnóstico Rápido (Ejecutar en Orden)

```bash
# 1. Verificar Chrome funcional
google-chrome-stable --version && echo "✅ Chrome OK" || echo "❌ Chrome FAIL"

# 2. Verificar dependencias críticas
ldd /usr/bin/google-chrome-stable | grep "not found" && echo "❌ Faltan libs" || echo "✅ Libs OK"

# 3. Verificar espacio
df -h /tmp && du -sh tokens/

# 4. Test Puppeteer básico
node -e "require('puppeteer').launch({headless:true,args:['--no-sandbox']}).then(b=>b.close()).then(()=>console.log('✅ Puppeteer OK')).catch(e=>console.log('❌',e.message))"

# 5. Verificar permisos tokens/
ls -la tokens/ 2>/dev/null || mkdir -p tokens && echo "✅ Created tokens/"
```

---

## 🔧 Parche Combinado (Aplicar Si Falla Todo)

Reemplazar líneas 80-98 en `sessionService.js`:

```javascript
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: name,
    dataPath: path.resolve(__dirname, '../../../tokens')
  }),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    ]
  },
  qrMaxRetries: 5,
  takeoverOnConflict: true,
  takeoverTimeoutMs: 0  // Deshabilitar timeout QR
});
```

---

## 🚨 Si Nada Funciona: Plan B (Timeout Manual)

Agregar después de `client.initialize()` (línea ~190):

```javascript
// Timeout manual para forzar re-generación de QR
setTimeout(() => {
  const sess = clientSessions.get(clienteId);
  if (sess && !sess.qr && !sess.ready) {
    console.error(`❌ [TIMEOUT] QR no generado en 60s para cliente ${clienteId}`);
    console.log(`🔄 [RETRY] Destruyendo y reiniciando...`);
    sess.client?.destroy();
    clientSessions.delete(clienteId);
    getOrCreateClient(clienteId);  // Reintentar
  }
}, 60000);  // 60 segundos
```

---

## 📋 Orden de Aplicación Sugerido

1. **Causa #1** (Chrome rendering) - Más común en VPS
2. **Causa #4** (Anti-bot detection) - WhatsApp es estricto
3. **Causa #2** (Timeout) - VPS lentos
4. **Causa #3** (Race condition) - Verificar orden de código
5. **Causa #5** (Permisos /tmp) - Problemas de ambiente
6. **Causa #6** (dataPath) - Menos común pero fácil de verificar

---

## 🧪 Test de Verificación Final

```bash
# Después de aplicar cambios, verificar:
curl http://localhost:3012/session-manager/status

# Debería cambiar de INITIALIZING a uno de:
# - QR disponible (success)
# - Error específico (para diagnosticar más)
```

---

## 📚 Referencias

- [whatsapp-web.js Docs](https://wwebjs.dev/)
- [Puppeteer Troubleshooting](https://pptr.dev/troubleshooting)
- [Chrome Headless Args](https://peter.sh/experiments/chromium-command-line-switches/)

---

**Fecha:** 4 de enero de 2026  
**Contexto:** Node.js v20.19.6, whatsapp-web.js, Headless Chrome, VPS sin GUI
