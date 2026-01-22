#!/bin/bash
# Script para monitorear conversaciones del listener en tiempo real

echo "🔍 Monitoreando conversaciones del Listener..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Credenciales DB desde .env
source /root/leadmaster-workspace/services/central-hub/.env

# Función para mostrar conversaciones
show_conversations() {
  mysql -h ${DB_HOST:-localhost} \
        -u ${DB_USER:-root} \
        -p${DB_PASSWORD} \
        ${DB_DATABASE} \
        -e "
    SELECT 
      DATE_FORMAT(created_at, '%H:%i:%s') as hora,
      telefono,
      CASE 
        WHEN rol = 'user' THEN '📥'
        WHEN rol = 'assistant' THEN '📤'
        ELSE '❓'
      END as tipo,
      LEFT(mensaje, 80) as mensaje,
      origen_mensaje as origen
    FROM ll_ia_conversaciones
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    ORDER BY created_at DESC
    LIMIT 20;
  " 2>/dev/null
}

# Función para mostrar estadísticas
show_stats() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
  
  mysql -h ${DB_HOST:-localhost} \
        -u ${DB_USER:-root} \
        -p${DB_PASSWORD} \
        ${DB_DATABASE} \
        -e "
    SELECT 
      COUNT(*) as total_mensajes,
      COUNT(DISTINCT telefono) as contactos_activos,
      SUM(CASE WHEN rol = 'user' THEN 1 ELSE 0 END) as mensajes_recibidos,
      SUM(CASE WHEN rol = 'assistant' THEN 1 ELSE 0 END) as mensajes_enviados,
      SUM(CASE WHEN origen_mensaje = 'humano' THEN 1 ELSE 0 END) as intervenciones_humanas
    FROM ll_ia_conversaciones
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);
  " 2>/dev/null
  
  echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
  echo ""
}

# Loop principal
clear
while true; do
  echo -e "${GREEN}🕐 $(date '+%Y-%m-%d %H:%M:%S')${NC}"
  show_stats
  show_conversations
  echo ""
  echo -e "${YELLOW}Actualizando en 5 segundos... (Ctrl+C para salir)${NC}"
  sleep 5
  clear
done
