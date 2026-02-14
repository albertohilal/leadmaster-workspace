#!/bin/bash

# Script de testing para login local de WhatsApp
# Ejecutar desde: /root/leadmaster-workspace/services/session-manager

set -e

echo "======================================"
echo "WhatsApp Local Login - Testing Script"
echo "======================================"
echo ""

# Verificar si ya hay tokens
if [ -d "tokens/admin" ]; then
  echo "⚠️  ADVERTENCIA: Ya existen tokens en tokens/admin/"
  echo ""
  read -p "¿Borrar tokens existentes y hacer login fresco? (y/N): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Borrando tokens existentes..."
    rm -rf tokens/admin
    echo "✅ Tokens borrados"
  else
    echo "ℹ️  Manteniendo tokens existentes (se reutilizarán si son válidos)"
  fi
  echo ""
fi

# Detener session-manager si está corriendo
if pm2 describe session-manager > /dev/null 2>&1; then
  echo "🛑 Deteniendo session-manager existente..."
  pm2 stop session-manager
  pm2 delete session-manager
  echo "✅ Session-manager detenido"
  echo ""
fi

# Iniciar en modo local
echo "🚀 Iniciando session-manager en modo LOCAL (Chrome visible)..."
echo ""
export LOGIN_MODE=local
pm2 start ecosystem.config.js --env local
pm2 save

echo ""
echo "⏳ Esperando 5 segundos para que inicie el servicio..."
sleep 5

# Verificar estado inicial
echo ""
echo "📊 Estado inicial:"
curl -s http://localhost:3001/status | jq .
echo ""

# Iniciar conexión
echo ""
echo "🔗 Iniciando proceso de conexión..."
echo "   (Se abrirá ventana de Chrome con QR de WhatsApp)"
echo ""
curl -X POST http://localhost:3001/connect &
CURL_PID=$!

echo ""
echo "======================================"
echo "INSTRUCCIONES:"
echo "======================================"
echo ""
echo "1. Busca la ventana de Chrome que se abrió"
echo "2. Verás el QR de WhatsApp Web"
echo "3. Abre WhatsApp en tu celular"
echo "4. Ve a: Ajustes > Dispositivos vinculados > Vincular un dispositivo"
echo "5. Escanea el QR que apareció en Chrome"
echo ""
echo "Esperando escaneo de QR..."
echo "(Este script checkeará el estado cada 10 segundos)"
echo ""

# Monitorear estado
ATTEMPTS=0
MAX_ATTEMPTS=30 # 5 minutos máximo

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  sleep 10
  STATUS=$(curl -s http://localhost:3001/status)
  STATE=$(echo $STATUS | jq -r .state)
  
  echo "[$(date +%H:%M:%S)] Estado actual: $STATE"
  
  if [ "$STATE" = "READY" ]; then
    echo ""
    echo "✅ ¡CONEXIÓN EXITOSA!"
    echo ""
    echo "======================================"
    echo "PRÓXIMOS PASOS:"
    echo "======================================"
    echo ""
    echo "1. Los tokens se guardaron en: tokens/admin/"
    echo ""
    echo "2. Para copiar al servidor VPS:"
    echo "   rsync -avz tokens/admin/ user@vps-ip:/path/to/session-manager/tokens/admin/"
    echo ""
    echo "3. En el servidor, iniciar con LOGIN_MODE=server:"
    echo "   export LOGIN_MODE=server"
    echo "   pm2 start ecosystem.config.js"
    echo ""
    echo "4. Verificar en servidor:"
    echo "   curl http://localhost:3001/status"
    echo "   # Debe mostrar READY sin pedir QR"
    echo ""
    exit 0
  fi
  
  ATTEMPTS=$((ATTEMPTS + 1))
done

# Timeout
echo ""
echo "⏱️  Timeout después de 5 minutos"
echo ""
echo "Verifica:"
echo "1. pm2 logs session-manager"
echo "2. curl http://localhost:3001/status"
echo "3. Que la ventana de Chrome esté abierta"
echo ""
exit 1
