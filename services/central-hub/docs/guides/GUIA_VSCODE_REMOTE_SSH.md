# Guía: VS Code Remote SSH para Contabo

## ¿Por qué usar VS Code Remote SSH?

✅ Editas archivos directamente en el servidor  
✅ Terminal integrado en el servidor  
✅ No necesitas git pull/push constantemente  
✅ Depuración en tiempo real  
✅ Intellisense con el código del servidor  

## Paso a Paso

### 1. Instalar extensión en VS Code Local

1. Abre VS Code en tu máquina local
2. Ve a extensiones (Ctrl+Shift+X)
3. Busca: **Remote - SSH**
4. Instala: `ms-vscode-remote.remote-ssh`

### 2. Configurar conexión SSH

1. Presiona `F1` o `Ctrl+Shift+P`
2. Escribe: **Remote-SSH: Connect to Host...**
3. Selecciona: **Configure SSH Hosts...**
4. Elige: `~/.ssh/config`
5. Agrega esta configuración:

```ssh
Host contabo-leadmaster
    HostName vmi2656219.contaboserver.net
    User root
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

### 3. Conectar al servidor

1. Presiona `F1` o `Ctrl+Shift+P`
2. Escribe: **Remote-SSH: Connect to Host...**
3. Selecciona: **contabo-leadmaster**
4. Ingresa la contraseña cuando te la pida
5. Espera que VS Code instale el servidor remoto (solo primera vez)

### 4. Abrir carpeta del proyecto

1. Una vez conectado: `File > Open Folder`
2. Navega a: `/root/leadmaster-central-hub`
3. Click en **OK**

### 5. Trabajar en el servidor

**Terminal integrado:**
```bash
Ctrl+` (acento grave)
```

**Editar archivos:**
- Directamente desde el explorador lateral
- Los cambios se guardan en el servidor instantáneamente

**Ejecutar comandos:**
```bash
pm2 logs leadmaster-central-hub
pm2 restart leadmaster-central-hub
npm install paquete
```

**Debugging:**
- Puedes attachear el debugger a procesos Node.js del servidor
- Breakpoints funcionan directamente

## Ventajas para tu problema actual

🔧 **Depurar venom-bot en tiempo real**  
📊 **Ver logs mientras editas código**  
🚀 **Probar cambios sin commit/push/pull**  
🔍 **Inspeccionar archivos del servidor**  

## Workflow Recomendado

```bash
# 1. Conectar con VS Code Remote SSH
# 2. Editar código directamente en /root/leadmaster-central-hub
# 3. Guardar cambios (se aplican instantáneamente)
# 4. En terminal integrado:
pm2 restart leadmaster-central-hub
pm2 logs leadmaster-central-hub --lines 50

# 5. Una vez que funcione:
git add .
git commit -m "Fix: descripción"
git push
```

## Tip: Mantener sincronizado con local

Si también trabajas en local, recuerda:

```bash
# En tu máquina local (cuando NO estés en Remote SSH):
cd ~/Documentos/Github/leadmaster-central-hub
git pull  # Traer cambios hechos en el servidor
```

## Alternativa: Usar --display en browserArgs

Si Remote SSH no es opción, prueba agregar display en browserArgs:

```javascript
browserArgs: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--display=:99'  // ← Forzar Xvfb display
],
```

Y asegúrate que Xvfb esté corriendo:

```bash
ps aux | grep Xvfb
# Si no está corriendo:
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
```
