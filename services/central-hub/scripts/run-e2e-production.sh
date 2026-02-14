#!/bin/bash

# Script de ejecución E2E para Producción (Contabo VPS)
# Uso: ./run-e2e-production.sh

set -e

echo "=========================================="
echo "WhatsApp E2E Test - Producción (Contabo)"
echo "=========================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: Ejecutar desde /root/leadmaster-workspace/services/central-hub"
  exit 1
fi

# Verificar que Playwright está instalado
if ! npx playwright --version > /dev/null 2>&1; then
  echo "❌ Error: Playwright no instalado"
  echo ""
  echo "Instalar con:"
  echo "  npm install -D @playwright/test"
  echo "  npx playwright install chromium"
  echo ""
  exit 1
fi

echo "✓ Playwright instalado: $(npx playwright --version)"
echo ""

# Verificar variables de entorno
if [ -z "$E2E_USER" ] || [ -z "$E2E_PASS" ]; then
  echo "⚠️  Advertencia: Credenciales no configuradas en variables de entorno"
  echo ""
  echo "Setear antes de ejecutar:"
  echo "  export E2E_USER=tu_usuario"
  echo "  export E2E_PASS=tu_password"
  echo ""
  
  # Intentar cargar desde archivo .env si existe
  if [ -f ".env.test.local" ]; then
    echo "Cargando desde .env.test.local..."
    source .env.test.local
    echo "✓ Variables cargadas"
  else
    echo "❌ Error: No hay credenciales disponibles"
    exit 1
  fi
fi

# URL de producción (hardcodeada para este VPS)
export E2E_BASE_URL="${E2E_BASE_URL:-https://desarrolloydisenioweb.com.ar}"

echo "Configuración:"
echo "  URL: $E2E_BASE_URL"
echo "  Usuario: $E2E_USER"
echo "  Password: [OCULTO]"
echo ""

# Verificar conectividad a producción
echo "Verificando conectividad con producción..."
if curl -s --head --max-time 10 "$E2E_BASE_URL" | grep -E "HTTP/[0-9.]+ [23]" > /dev/null; then 
  echo "✓ Servidor productivo respondiendo"
else
  echo ""
  echo "❌ Error: No se puede conectar a $E2E_BASE_URL"
  echo ""
  echo "Verificar:"
  echo "  1. Nginx está corriendo: systemctl status nginx"
  echo "  2. SSL configurado correctamente"
  echo "  3. Firewall permite conexiones HTTPS"
  echo ""
  exit 1
fi

echo ""
echo "Ejecutando tests E2E en producción..."
echo "(Modo headless - sin interfaz gráfica)"
echo ""

# Ejecutar Playwright con configuración de producción
npx playwright test \
  --project="E2E Tests - WhatsApp" \
  --reporter=list \
  --workers=1

EXIT_CODE=$?

echo ""
echo "=========================================="

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Tests completados exitosamente"
else
  echo "❌ Tests fallaron (código: $EXIT_CODE)"
fi

echo "=========================================="
echo ""
echo "Evidencia generada:"
echo "  Screenshots: ls test-results/*.png"
echo "  Videos: ls test-results/*.webm"
echo "  Reporte HTML: npm run test:report"
echo ""

exit $EXIT_CODE
