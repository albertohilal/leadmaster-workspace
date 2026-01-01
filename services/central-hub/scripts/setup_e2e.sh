#!/bin/bash

# Setup E2E Testing Environment for Campaigns
echo "🚀 Configurando entorno E2E para pruebas de campañas..."

# Verificar que los servicios estén corriendo
check_service() {
    local port=$1
    local service_name=$2
    
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "✅ $service_name corriendo en puerto $port"
        return 0
    else
        echo "❌ $service_name NO está corriendo en puerto $port"
        return 1
    fi
}

# Función para esperar que un servicio esté listo
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0
    
    echo "⏳ Esperando que $service_name esté listo..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s $url > /dev/null 2>&1; then
            echo "✅ $service_name está listo"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "   Intento $attempt/$max_attempts..."
        sleep 2
    done
    
    echo "❌ $service_name no respondió después de $max_attempts intentos"
    return 1
}

# Verificar prerequisitos
echo "📋 Verificando prerequisitos..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado"
    exit 1
fi

# Verificar que existen los directorios necesarios
if [ ! -d "frontend" ]; then
    echo "❌ Directorio frontend no encontrado"
    exit 1
fi

if [ ! -f "src/index.js" ]; then
    echo "❌ Backend src/index.js no encontrado"
    exit 1
fi

# Instalar dependencias si no están instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias del backend..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Instalando dependencias del frontend..."
    cd frontend && npm install && cd ..
fi

# Cerrar puertos si están ocupados
echo "🧹 Cerrando puertos ocupados..."
lsof -ti:3011,5173 | xargs kill -9 2>/dev/null || true

# Esperar un momento para que se liberen los puertos
sleep 2

# Iniciar backend
echo "🚀 Iniciando backend en puerto 3011..."
node src/index.js &
BACKEND_PID=$!

# Dar tiempo al backend para inicializar
sleep 5

# Verificar que el backend está corriendo
if ! check_service 3011 "Backend"; then
    echo "❌ Error: No se pudo iniciar el backend"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Iniciar frontend
echo "🎨 Iniciando frontend en puerto 5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

# Esperar a que los servicios estén listos
wait_for_service "http://localhost:3011/health" "Backend"
BACKEND_READY=$?

wait_for_service "http://localhost:5173" "Frontend"
FRONTEND_READY=$?

if [ $BACKEND_READY -ne 0 ] || [ $FRONTEND_READY -ne 0 ]; then
    echo "❌ Error: No se pudieron iniciar los servicios"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 1
fi

# Crear datos de prueba si es necesario
echo "📊 Verificando datos de prueba..."

# Verificar autenticación
AUTH_TEST=$(curl -s -X POST http://localhost:3011/auth/login \
    -H "Content-Type: application/json" \
    -d '{"usuario": "Haby", "password": "haby1973"}')

if echo $AUTH_TEST | grep -q '"success":true'; then
    echo "✅ Usuario de prueba Haby autenticado correctamente"
else
    echo "⚠️  Advertencia: No se pudo autenticar usuario de prueba Haby"
fi

# Guardar PIDs para limpieza posterior
echo $BACKEND_PID > .backend_pid
echo $FRONTEND_PID > .frontend_pid

echo ""
echo "🎉 Entorno E2E configurado correctamente!"
echo ""
echo "Servicios corriendo:"
echo "  📡 Backend:  http://localhost:3011"
echo "  🎨 Frontend: http://localhost:5173"
echo ""
echo "Para ejecutar las pruebas:"
echo "  npm test                    # Todas las pruebas"
echo "  npm run test:campaigns      # Solo pruebas de campañas"
echo "  npm run test:e2e            # Solo pruebas E2E"
echo ""
echo "Para detener los servicios:"
echo "  ./scripts/cleanup_e2e.sh"
echo ""