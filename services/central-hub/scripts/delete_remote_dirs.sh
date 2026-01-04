#!/bin/bash

# Script para eliminar directorios del repositorio remoto de GitHub
# Estos directorios existen solo en GitHub y deben ser eliminados

echo "🧹 Eliminando directorios del repositorio remoto de GitHub..."
echo ""
echo "IMPORTANTE: Este script requiere que primero clones una copia limpia"
echo "del repositorio desde GitHub para eliminar los directorios."
echo ""

# Directorios a eliminar
DIRS_TO_REMOVE=(
    "bares-don"
    "catalogo-habysupply"
    "crud-bares"
    "desarrolloydisenio.com.ar"
    "menu-bares"
    "wappflow-n8n"
    "menu-bares.zip"
)

# Crear directorio temporal
TEMP_DIR="/tmp/leadmaster-cleanup-$(date +%s)"
echo "📁 Creando directorio temporal: $TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Clonar el repositorio
echo "📥 Clonando repositorio desde GitHub..."
git clone https://github.com/albertohilal/leadmaster-central-hub.git
cd leadmaster-central-hub

# Verificar qué directorios existen
echo ""
echo "📋 Verificando directorios existentes..."
for dir in "${DIRS_TO_REMOVE[@]}"; do
    if [ -d "$dir" ] || [ -f "$dir" ]; then
        echo "   ✓ Encontrado: $dir"
    else
        echo "   ✗ No existe: $dir"
    fi
done

echo ""
echo "⚡ Procediendo con la eliminación automática..."

# Eliminar directorios
echo ""
echo "🗑️  Eliminando directorios..."
for dir in "${DIRS_TO_REMOVE[@]}"; do
    if [ -d "$dir" ] || [ -f "$dir" ]; then
        echo "   Eliminando: $dir"
        git rm -rf "$dir"
    fi
done

# Crear commit
echo ""
echo "💾 Creando commit..."
git commit -m "chore: eliminar proyectos no relacionados del repositorio

Directorios eliminados:
- bares-don
- catalogo-habysupply
- crud-bares
- desarrolloydisenio.com.ar
- menu-bares
- wappflow-n8n
- menu-bares.zip

Estos directorios son proyectos independientes que se subieron por error
y no pertenecen al proyecto leadmaster-central-hub."

# Push
echo ""
echo "🚀 Subiendo cambios a GitHub..."
git push origin main

echo ""
echo "✅ ¡Directorios eliminados exitosamente!"
echo ""
echo "🧹 Limpiando directorio temporal..."
cd /
rm -rf "$TEMP_DIR"

echo ""
echo "✨ Proceso completado. Verifica en GitHub:"
echo "   https://github.com/albertohilal/leadmaster-central-hub"
