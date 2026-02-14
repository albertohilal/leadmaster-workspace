#!/bin/bash
#
# Script de ejemplo: Activar diagnóstico, esperar 2 minutos, capturar logs y desactivar
#
# Uso en Contabo:
#   chmod +x scripts/diag-sender-capture.sh
#   ./scripts/diag-sender-capture.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/diag_sender_${TIMESTAMP}.log"

echo "=================================================="
echo "  Diagnóstico Operativo: Scheduler de Campañas"
echo "=================================================="
echo ""

# 1. Activar diagnóstico
echo "✅ Activando DIAG_SENDER..."
export DIAG_SENDER=1
pm2 restart central-hub --update-env
sleep 3

# 2. Capturar logs por 2 minutos
echo "📊 Capturando logs por 2 minutos..."
echo "   (Ctrl+C para detener antes)"
echo ""

timeout 120 pm2 logs central-hub --nostream | grep DIAG_SENDER > "$LOG_FILE" || true

# 3. Desactivar diagnóstico
echo ""
echo "✅ Desactivando DIAG_SENDER..."
unset DIAG_SENDER
pm2 restart central-hub --update-env

# 4. Resumen
echo ""
echo "=================================================="
echo "  Captura finalizada"
echo "=================================================="
echo ""
echo "📁 Archivo generado: $LOG_FILE"
echo ""

if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
  LINEAS=$(wc -l < "$LOG_FILE")
  echo "📊 Total de líneas capturadas: $LINEAS"
  echo ""
  
  # Mostrar resúmenes finales si existen
  RESUMENES=$(grep -c "RESUMEN FINAL" "$LOG_FILE" || echo 0)
  if [ "$RESUMENES" -gt 0 ]; then
    echo "🏁 Resúmenes encontrados: $RESUMENES"
    echo ""
    grep "RESUMEN FINAL" "$LOG_FILE" | tail -5
    echo ""
  fi
  
  # Mostrar errores si existen
  ERRORES=$(grep -c "ERROR sendMessage" "$LOG_FILE" || echo 0)
  if [ "$ERRORES" -gt 0 ]; then
    echo "⚠️  Errores encontrados: $ERRORES"
    echo ""
    grep "ERROR sendMessage" "$LOG_FILE" | head -5
    echo ""
  fi
  
  echo "💡 Ver archivo completo:"
  echo "   cat $LOG_FILE | jq ."
  echo "   grep 'ENVIADO' $LOG_FILE"
  echo "   grep 'ABORT' $LOG_FILE"
else
  echo "⚠️  No se capturaron logs (posible inactividad del scheduler)"
fi

echo ""
