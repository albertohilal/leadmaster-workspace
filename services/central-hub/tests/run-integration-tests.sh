#!/bin/bash
#
# Script de ejecución rápida para tests de integración de campaña
# Uso: ./tests/run-integration-tests.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=================================================="
echo "  Test de Integración: Envío de Campaña"
echo "=================================================="
echo ""

# Verificar que existe .env
if [ ! -f ".env" ]; then
  echo "❌ Error: Archivo .env no encontrado"
  echo "   Crea un .env con las variables DB_HOST, DB_USER, DB_PASSWORD, DB_NAME"
  exit 1
fi

# Verificar conexión a MySQL
echo "🔍 Verificando conexión a MySQL..."
DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2)
DB_USER=$(grep DB_USER .env | cut -d '=' -f2)
DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d '=' -f2)
DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2)

if ! mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_NAME;" 2>/dev/null; then
  echo "❌ Error: No se pudo conectar a MySQL"
  echo "   Host: $DB_HOST, User: $DB_USER, DB: $DB_NAME"
  exit 1
fi

echo "✅ Conexión a MySQL OK"
echo ""

# Ejecutar tests
echo "🧪 Ejecutando tests de integración..."
echo ""

npm test -- tests/campaign-send.integration.test.js --verbose

echo ""
echo "=================================================="
echo "  ✅ Tests completados"
echo "=================================================="
