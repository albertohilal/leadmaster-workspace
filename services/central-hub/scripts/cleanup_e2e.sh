#!/bin/bash

# Cleanup E2E Testing Environment
echo "🧹 Limpiando entorno E2E..."

# Función para terminar proceso por PID
kill_process() {
    local pid=$1
    local service_name=$2
    
    if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
        echo "🛑 Terminando $service_name (PID: $pid)..."
        kill $pid
        sleep 2
        
        # Force kill si no respondió
        if kill -0 $pid 2>/dev/null; then
            echo "💀 Force kill $service_name..."
            kill -9 $pid 2>/dev/null || true
        fi
    fi
}

# Leer PIDs de archivos si existen
if [ -f ".backend_pid" ]; then
    BACKEND_PID=$(cat .backend_pid)
    kill_process $BACKEND_PID "Backend"
    rm .backend_pid
fi

if [ -f ".frontend_pid" ]; then
    FRONTEND_PID=$(cat .frontend_pid)
    kill_process $FRONTEND_PID "Frontend"
    rm .frontend_pid
fi

# Cerrar cualquier proceso en los puertos 3011 y 5173
echo "🔌 Cerrando puertos 3011 y 5173..."
lsof -ti:3011,5173 | xargs kill -9 2>/dev/null || true

# Limpiar archivos temporales de testing
echo "🗑️  Limpiando archivos temporales..."
rm -rf playwright-report 2>/dev/null || true
rm -rf test-results 2>/dev/null || true

# Limpiar logs si existen
rm -f *.log 2>/dev/null || true

echo ""
echo "✅ Limpieza completada"
echo ""