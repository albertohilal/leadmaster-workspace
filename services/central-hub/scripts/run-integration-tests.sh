#!/bin/bash

# =================================================================
# Script de ejecución de tests de integración backend
# =================================================================
# Autor: Test Engineering Team
# Fecha: 2026-01-21
# Descripción: Ejecuta tests de integración con base de datos real
# =================================================================

set -e

echo "🧪 Iniciando tests de integración..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# 1. Validar que Jest esté instalado
echo "📦 Validando dependencias..."
if ! npm list jest > /dev/null 2>&1; then
  echo -e "${RED}❌ Jest no está instalado${NC}"
  echo "Instálalo con: npm install --save-dev jest"
  exit 1
fi
echo -e "${GREEN}✓ Jest instalado${NC}"

# 2. Validar variables de entorno DB
echo ""
echo "🔧 Validando configuración de base de datos..."

if [ -z "$DB_HOST" ]; then
  echo -e "${YELLOW}⚠️  DB_HOST no configurado, usando localhost${NC}"
  export DB_HOST=localhost
fi

if [ -z "$DB_NAME" ]; then
  echo -e "${YELLOW}⚠️  DB_NAME no configurado, usando leadmaster_test${NC}"
  export DB_NAME=leadmaster_test
fi

if [ -z "$DB_USER" ]; then
  echo -e "${RED}❌ DB_USER no configurado${NC}"
  echo "Configura con: export DB_USER=tu_usuario"
  exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
  echo -e "${YELLOW}⚠️  DB_PASSWORD vacío (puede ser válido)${NC}"
fi

echo -e "${GREEN}✓ Configuración DB validada${NC}"
echo "  Host: $DB_HOST"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"

# 3. Verificar conectividad a MySQL
echo ""
echo "🔌 Verificando conectividad a MySQL..."

if command -v mysql > /dev/null 2>&1; then
  if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Conexión a MySQL exitosa${NC}"
  else
    echo -e "${RED}❌ No se pudo conectar a MySQL${NC}"
    echo "Verifica credenciales y que el servidor esté corriendo"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  Cliente mysql no disponible, saltando verificación${NC}"
fi

# 4. Ejecutar tests
echo ""
echo "🚀 Ejecutando tests de integración..."
echo ""
echo "════════════════════════════════════════════════════════════"

# Opciones:
# - Solo tests de integración (*.integration.test.js)
# - Con cobertura opcional
# - Verbose para debugging

TEST_PATTERN="tests/**/*.integration.test.js"
VERBOSE_FLAG=""
COVERAGE_FLAG=""

# Parsear argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE_FLAG="--verbose"
      shift
      ;;
    --coverage|-c)
      COVERAGE_FLAG="--coverage"
      shift
      ;;
    --pattern|-p)
      TEST_PATTERN="$2"
      shift 2
      ;;
    --help|-h)
      echo "Uso: $0 [opciones]"
      echo ""
      echo "Opciones:"
      echo "  -v, --verbose       Salida detallada"
      echo "  -c, --coverage      Generar reporte de cobertura"
      echo "  -p, --pattern PATH  Patrón de archivos de test (default: tests/**/*.integration.test.js)"
      echo "  -h, --help          Mostrar esta ayuda"
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Opción desconocida: $1${NC}"
      echo "Usa --help para ver opciones disponibles"
      exit 1
      ;;
  esac
done

# Ejecutar Jest
npx jest $TEST_PATTERN $VERBOSE_FLAG $COVERAGE_FLAG

TEST_EXIT_CODE=$?

echo ""
echo "════════════════════════════════════════════════════════════"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Todos los tests pasaron exitosamente${NC}"
  
  if [ -n "$COVERAGE_FLAG" ]; then
    echo ""
    echo "📊 Reporte de cobertura generado en: coverage/"
  fi
else
  echo -e "${RED}❌ Algunos tests fallaron (exit code: $TEST_EXIT_CODE)${NC}"
  echo ""
  echo "💡 Tips de debugging:"
  echo "  - Ejecuta con --verbose para más detalles"
  echo "  - Verifica logs de la base de datos"
  echo "  - Revisa que los datos de prueba se limpiaron correctamente"
fi

exit $TEST_EXIT_CODE
