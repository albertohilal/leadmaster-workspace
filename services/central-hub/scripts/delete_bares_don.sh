#!/bin/bash

# Script para eliminar bares-don del repositorio remoto

echo "🧹 Eliminando bares-don del repositorio..."
echo ""

TEMP_DIR="/tmp/leadmaster-cleanup-bares-$(date +%s)"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "📥 Clonando repositorio..."
git clone https://github.com/albertohilal/leadmaster-central-hub.git
cd leadmaster-central-hub

echo ""
echo "📋 Verificando si bares-don existe..."
if [ -d "bares-don" ] || [ -f "bares-don" ]; then
    echo "   ✓ Encontrado: bares-don"
    echo ""
    echo "⚡ Eliminando..."
    git rm -rf "bares-don"
    
    echo "💾 Creando commit..."
    git commit -m "chore: eliminar directorio bares-don del repositorio

Este directorio es un proyecto independiente que se subió por error
y no pertenece al proyecto leadmaster-central-hub."
    
    echo "🚀 Subiendo cambios..."
    git push origin main
    
    echo ""
    echo "✅ ¡bares-don eliminado exitosamente!"
else
    echo "   ✗ No existe: bares-don"
    echo ""
    echo "✅ El directorio ya no está en el repositorio"
fi

echo ""
echo "🧹 Limpiando directorio temporal..."
cd /
rm -rf "$TEMP_DIR"

echo "✨ Proceso completado"
