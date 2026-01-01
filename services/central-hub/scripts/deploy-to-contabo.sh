#!/bin/bash

# Script de Deploy a Contabo - LeadMaster Central Hub
# Uso: ./scripts/deploy-to-contabo.sh

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       🚀 DEPLOY A CONTABO - LEADMASTER CENTRAL HUB           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Servidor de producción
SERVER="root@desarrolloydisenioweb.com.ar"
PROJECT_PATH="~/leadmaster-central-hub"

echo -e "${BLUE}📡 Conectando a Contabo...${NC}"
echo ""

# Ejecutar comandos en el servidor remoto
ssh $SERVER << 'ENDSSH'
    set -e  # Detener si hay errores
    
    echo "📂 Navegando al proyecto..."
    cd ~/leadmaster-central-hub
    
    echo ""
    echo "🔍 Estado actual del repositorio:"
    git status --short
    git log --oneline -1
    
    echo ""
    read -p "¿Continuar con el deploy? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        echo "❌ Deploy cancelado"
        exit 1
    fi
    
    echo ""
    echo "📥 Descargando cambios de GitHub..."
    git pull origin main
    
    if [ $? -ne 0 ]; then
        echo "❌ Error al hacer git pull"
        exit 1
    fi
    
    echo ""
    echo "📦 Instalando dependencias backend..."
    npm install
    
    echo ""
    echo "🎨 Compilando frontend..."
    cd frontend
    npm install
    npm run build
    
    if [ $? -ne 0 ]; then
        echo "❌ Error al compilar frontend"
        exit 1
    fi
    
    cd ..
    
    echo ""
    echo "🔄 Reiniciando backend con PM2..."
    pm2 restart leadmaster-central-hub
    
    if [ $? -ne 0 ]; then
        echo "❌ Error al reiniciar PM2"
        exit 1
    fi
    
    echo ""
    echo "⏳ Esperando que el servicio inicie..."
    sleep 3
    
    echo ""
    echo "📊 Estado de PM2:"
    pm2 status
    
    echo ""
    echo "📋 Últimas 20 líneas de logs:"
    pm2 logs leadmaster-central-hub --lines 20 --nostream
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    ✅ DEPLOY COMPLETADO                       ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🌐 Probar en: https://desarrolloydisenioweb.com.ar"
    echo "📊 Ver logs: pm2 logs leadmaster-central-hub"
    echo "🔍 Ver estado: pm2 status"
    echo ""
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deploy exitoso en Contabo${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Hubo errores durante el deploy${NC}"
    echo ""
    exit 1
fi
