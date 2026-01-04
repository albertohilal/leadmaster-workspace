#!/bin/bash

# Script para mantener el frontend estable en el entorno de staging
# Autor: LeadMaster Central Hub
# Fecha: 2025-12-19

echo "🚀 Iniciando entorno de staging de LeadMaster Central Hub..."

# Función para limpiar procesos al salir
cleanup() {
    echo "🧹 Limpiando procesos..."
    pkill -f "node src/index.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    exit 0
}

# Configurar trap para limpiar al salir
trap cleanup SIGINT SIGTERM

# Función para verificar si un puerto está en uso
check_port() {
    local port=$1
    nc -z localhost $port 2>/dev/null
    return $?
}

# Función para esperar que un servicio esté disponible
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0

    echo "⏳ Esperando que $service_name esté disponible en puerto $port..."
    
    while ! check_port $port && [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        echo "   Intento $attempt/$max_attempts..."
        sleep 2
    done
    
    if check_port $port; then
        echo "✅ $service_name está funcionando en puerto $port"
        return 0
    else
        echo "❌ $service_name no pudo iniciarse en puerto $port"
        return 1
    fi
}

# Función para iniciar el backend
start_backend() {
    echo "🟦 Iniciando backend..."
    cd /home/beto/Documentos/Github/leadmaster-central-hub
    
    # Verificar si ya está funcionando
    if check_port 3011; then
        echo "✅ Backend ya está funcionando en puerto 3011"
        return 0
    fi
    
    # Iniciar backend en background
    nohup node src/index.js > /tmp/leadmaster-backend.log 2>&1 &
    local backend_pid=$!
    echo "Backend iniciado con PID: $backend_pid"
    
    # Esperar que esté disponible
    if wait_for_service 3011 "Backend"; then
        return 0
    else
        echo "❌ Error al iniciar backend"
        return 1
    fi
}

# Función para iniciar el frontend
start_frontend() {
    echo "🟦 Iniciando frontend..."
    cd /home/beto/Documentos/Github/leadmaster-central-hub/frontend
    
    # Verificar si ya está funcionando
    if check_port 5174; then
        echo "✅ Frontend ya está funcionando en puerto 5174"
        return 0
    fi
    
    # Iniciar frontend en background
    nohup npm run dev > /tmp/leadmaster-frontend.log 2>&1 &
    local frontend_pid=$!
    echo "Frontend iniciado con PID: $frontend_pid"
    
    # Esperar que esté disponible
    if wait_for_service 5174 "Frontend"; then
        return 0
    else
        echo "❌ Error al iniciar frontend"
        return 1
    fi
}

# Función para verificar estado de servicios
check_services() {
    echo "🔍 Verificando estado de servicios..."
    
    if check_port 3011; then
        echo "✅ Backend (Puerto 3011): Funcionando"
        # Verificar health endpoint
        local health_response=$(curl -s http://localhost:3011/health 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "   Health: $health_response"
        fi
    else
        echo "❌ Backend (Puerto 3011): No disponible"
    fi
    
    if check_port 5174; then
        echo "✅ Frontend (Puerto 5174): Funcionando"
        echo "   URL: http://localhost:5174/"
    else
        echo "❌ Frontend (Puerto 5174): No disponible"
    fi
}

# Verificar dependencias
echo "🔧 Verificando dependencias..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ NPM no está instalado"
    exit 1
fi

if ! command -v nc &> /dev/null; then
    echo "❌ netcat no está instalado. Instalando..."
    sudo apt update && sudo apt install -y netcat
fi

# Iniciar servicios
echo "🚀 Iniciando servicios..."

# Iniciar backend
if ! start_backend; then
    echo "❌ No se pudo iniciar el backend"
    exit 1
fi

# Iniciar frontend
if ! start_frontend; then
    echo "❌ No se pudo iniciar el frontend"
    exit 1
fi

# Verificar estado final
echo ""
echo "📊 Estado final del entorno de staging:"
check_services

echo ""
echo "🎉 Entorno de staging iniciado exitosamente!"
echo "   Backend:  http://localhost:3011"
echo "   Frontend: http://localhost:5174"
echo ""
echo "Para verificar logs:"
echo "   Backend:  tail -f /tmp/leadmaster-backend.log"
echo "   Frontend: tail -f /tmp/leadmaster-frontend.log"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios..."

# Mantener el script funcionando
while true; do
    sleep 10
    
    # Verificar que los servicios sigan funcionando
    if ! check_port 3011; then
        echo "⚠️  Backend se desconectó. Reiniciando..."
        start_backend
    fi
    
    if ! check_port 5174; then
        echo "⚠️  Frontend se desconectó. Reiniciando..."
        start_frontend
    fi
done