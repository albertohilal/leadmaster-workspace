#!/bin/bash

# Script de ejecución para E2E WhatsApp Smoke Test
# Uso: ./run-whatsapp-smoke-test.sh

set -e

echo "======================================"
echo "WhatsApp Smoke Test - E2E Playwright"
echo "======================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: Ejecutar desde /root/leadmaster-workspace/services/central-hub"
  exit 1
fi

# Verificar variables de entorno
if [ -f ".env.test.local" ]; then
  echo "✓ Cargando variables de entorno desde .env.test.local"
  source .env.test.local
else
  echo "⚠️  Advertencia: .env.test.local no encontrado, usando valores por defecto"
fi

# Verificar credenciales
if [ -z "$E2E_USER" ] || [ -z "$E2E_PASS" ]; then
  echo ""
  echo "❌ Error: Credenciales E2E no configuradas"
  echo ""
  echo "Crear archivo .env.test.local con:"
  echo "  E2E_BASE_URL=http://localhost:5173"
  echo "  E2E_USER=tu_usuario"
  echo "  E2E_PASS=tu_password"
  echo ""
  exit 1
fi

echo "✓ Credenciales configuradas"
echo ""

# Verificar que el frontend está corriendo
BASE_URL=${E2E_BASE_URL:-http://localhost:5173}
echo "Verificando frontend en: $BASE_URL"

if curl -s --head --request GET "$BASE_URL" | grep "200\|301\|302" > /dev/null; then 
  echo "✓ Frontend respondiendo"
else
  echo ""
  echo "❌ Error: Frontend no responde en $BASE_URL"
  echo ""
  echo "Levantar frontend con:"
  echo "  cd frontend && npm run dev"
  echo ""
  exit 1
fi

echo ""
echo "Ejecutando tests E2E..."
echo ""

# Ejecutar Playwright
npx playwright test e2e/whatsapp-smoke.spec.js --reporter=list

echo ""
echo "======================================"
echo "Tests completados"
echo "======================================"
echo ""
echo "Ver reporte HTML:"
echo "  npm run test:report"
echo ""
echo "Ver screenshots:"
echo "  ls test-results/*.png"
echo ""
