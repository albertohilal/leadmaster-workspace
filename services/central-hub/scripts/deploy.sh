#!/bin/bash

# Script de Deployment para LeadMaster Central Hub
# Autor: LeadMaster Central Hub Team
# Fecha: 2025-12-19
# Versión: 1.0

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
PROJECT_DIR="/home/beto/Documentos/Github/leadmaster-central-hub"
LOG_DIR="/var/log/leadmaster"
PID_DIR="/var/run/leadmaster"
BACKEND_PORT=3011
FRONTEND_PORT=5174

# Función para imprimir con colores
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Función para verificar prerequisitos
check_prerequisites() {
    print_step "Verificando prerequisitos del sistema..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js no está instalado"
        exit 1
    fi
    print_status "Node.js: $(node --version)"
    
    # Verificar NPM
    if ! command -v npm &> /dev/null; then
        print_error "NPM no está instalado"
        exit 1
    fi
    print_status "NPM: $(npm --version)"
    
    # Verificar MySQL/MariaDB
    if ! command -v mysql &> /dev/null; then
        print_warning "MySQL client no encontrado, verificando conexión con el backend..."
    fi
    
    # Crear directorios necesarios
    sudo mkdir -p "$LOG_DIR" "$PID_DIR"
    sudo chown $USER:$USER "$LOG_DIR" "$PID_DIR"
    
    print_status "Prerequisitos verificados correctamente"
}

# Función para instalar dependencias
install_dependencies() {
    print_step "Instalando dependencias..."
    
    cd "$PROJECT_DIR"
    
    # Backend dependencies
    if [ -f package.json ]; then
        print_status "Instalando dependencias del backend..."
        npm install
    fi
    
    # Frontend dependencies
    cd "$PROJECT_DIR/frontend"
    if [ -f package.json ]; then
        print_status "Instalando dependencias del frontend..."
        npm install
    fi
    
    cd "$PROJECT_DIR"
    print_status "Dependencias instaladas correctamente"
}

# Función para construir el proyecto
build_project() {
    print_step "Construyendo el proyecto..."
    
    cd "$PROJECT_DIR/frontend"
    print_status "Construyendo frontend para producción..."
    npm run build
    
    cd "$PROJECT_DIR"
    print_status "Proyecto construido correctamente"
}

# Función para verificar puertos
check_ports() {
    print_step "Verificando disponibilidad de puertos..."
    
    if nc -z localhost $BACKEND_PORT 2>/dev/null; then
        print_warning "Puerto $BACKEND_PORT ya está en uso"
        return 1
    fi
    
    if nc -z localhost $FRONTEND_PORT 2>/dev/null; then
        print_warning "Puerto $FRONTEND_PORT ya está en uso"
        return 1
    fi
    
    print_status "Puertos disponibles"
    return 0
}

# Función para detener servicios existentes
stop_services() {
    print_step "Deteniendo servicios existentes..."
    
    # Detener por PIDs guardados
    if [ -f "$PID_DIR/backend.pid" ]; then
        local backend_pid=$(cat "$PID_DIR/backend.pid")
        if kill -0 "$backend_pid" 2>/dev/null; then
            kill "$backend_pid"
            print_status "Backend detenido (PID: $backend_pid)"
        fi
        rm -f "$PID_DIR/backend.pid"
    fi
    
    if [ -f "$PID_DIR/frontend.pid" ]; then
        local frontend_pid=$(cat "$PID_DIR/frontend.pid")
        if kill -0 "$frontend_pid" 2>/dev/null; then
            kill "$frontend_pid"
            print_status "Frontend detenido (PID: $frontend_pid)"
        fi
        rm -f "$PID_DIR/frontend.pid"
    fi
    
    # Fuerza detener procesos por nombre
    pkill -f "node src/index.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    sleep 3
    print_status "Servicios detenidos"
}

# Función para iniciar backend
start_backend() {
    print_step "Iniciando backend..."
    
    cd "$PROJECT_DIR"
    
    # Iniciar en modo producción con PM2 si está disponible
    if command -v pm2 &> /dev/null; then
        pm2 stop leadmaster-backend 2>/dev/null || true
        pm2 delete leadmaster-backend 2>/dev/null || true
        pm2 start src/index.js --name leadmaster-backend --log "$LOG_DIR/backend.log"
        print_status "Backend iniciado con PM2"
    else
        # Iniciar con nohup
        nohup node src/index.js > "$LOG_DIR/backend.log" 2>&1 &
        local backend_pid=$!
        echo $backend_pid > "$PID_DIR/backend.pid"
        print_status "Backend iniciado (PID: $backend_pid)"
    fi
    
    # Esperar que esté disponible
    local attempts=0
    while ! nc -z localhost $BACKEND_PORT && [ $attempts -lt 30 ]; do
        attempts=$((attempts + 1))
        sleep 1
    done
    
    if nc -z localhost $BACKEND_PORT; then
        print_status "Backend disponible en puerto $BACKEND_PORT"
    else
        print_error "Backend no pudo iniciarse"
        return 1
    fi
}

# Función para iniciar frontend (modo desarrollo)
start_frontend_dev() {
    print_step "Iniciando frontend (modo desarrollo)..."
    
    cd "$PROJECT_DIR/frontend"
    
    # Iniciar servidor de desarrollo
    nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$PID_DIR/frontend.pid"
    print_status "Frontend iniciado (PID: $frontend_pid)"
    
    # Esperar que esté disponible
    local attempts=0
    while ! nc -z localhost $FRONTEND_PORT && [ $attempts -lt 30 ]; do
        attempts=$((attempts + 1))
        sleep 1
    done
    
    if nc -z localhost $FRONTEND_PORT; then
        print_status "Frontend disponible en puerto $FRONTEND_PORT"
    else
        print_error "Frontend no pudo iniciarse"
        return 1
    fi
}

# Función para verificar servicios
verify_services() {
    print_step "Verificando servicios..."
    
    # Verificar backend
    local health_response=$(curl -s http://localhost:$BACKEND_PORT/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        print_status "Backend funcionando: $health_response"
    else
        print_error "Backend no responde"
        return 1
    fi
    
    # Verificar frontend
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        print_status "Frontend funcionando en http://localhost:$FRONTEND_PORT"
    else
        print_error "Frontend no responde"
        return 1
    fi
    
    print_status "Todos los servicios funcionando correctamente"
}

# Función para mostrar información de deployment
show_deployment_info() {
    print_step "Información de deployment:"
    echo ""
    echo "📊 Estado de servicios:"
    echo "   Backend:  http://localhost:$BACKEND_PORT (Health: /health)"
    echo "   Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
    echo "📁 Logs:"
    echo "   Backend:  tail -f $LOG_DIR/backend.log"
    echo "   Frontend: tail -f $LOG_DIR/frontend.log"
    echo ""
    echo "🔧 PIDs:"
    if [ -f "$PID_DIR/backend.pid" ]; then
        echo "   Backend:  $(cat $PID_DIR/backend.pid)"
    fi
    if [ -f "$PID_DIR/frontend.pid" ]; then
        echo "   Frontend: $(cat $PID_DIR/frontend.pid)"
    fi
    echo ""
    echo "🛑 Para detener:"
    echo "   $0 stop"
}

# Función principal
main() {
    local action=${1:-"start"}
    
    case $action in
        "start")
            print_step "Iniciando deployment de LeadMaster Central Hub..."
            check_prerequisites
            install_dependencies
            stop_services
            start_backend
            start_frontend_dev
            verify_services
            show_deployment_info
            print_status "🎉 Deployment completado exitosamente!"
            ;;
        "stop")
            print_step "Deteniendo servicios de LeadMaster Central Hub..."
            stop_services
            print_status "🛑 Servicios detenidos"
            ;;
        "status")
            verify_services
            ;;
        "restart")
            $0 stop
            sleep 2
            $0 start
            ;;
        "logs")
            echo "Backend logs:"
            tail -n 20 "$LOG_DIR/backend.log" 2>/dev/null || echo "No hay logs del backend"
            echo ""
            echo "Frontend logs:"
            tail -n 20 "$LOG_DIR/frontend.log" 2>/dev/null || echo "No hay logs del frontend"
            ;;
        *)
            echo "Uso: $0 {start|stop|restart|status|logs}"
            echo ""
            echo "Comandos:"
            echo "  start   - Iniciar todos los servicios"
            echo "  stop    - Detener todos los servicios"
            echo "  restart - Reiniciar todos los servicios"
            echo "  status  - Verificar estado de servicios"
            echo "  logs    - Mostrar logs recientes"
            exit 1
            ;;
    esac
}

# Ejecutar función principal
main "$@"