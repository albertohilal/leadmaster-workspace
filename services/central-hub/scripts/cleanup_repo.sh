#!/bin/bash

# Script para limpiar directorios no relacionados del repositorio remoto
# Estos directorios se subieron por error y deben ser eliminados

echo "🧹 Limpiando repositorio leadmaster-central-hub..."
echo ""

# Lista de directorios a eliminar
DIRS_TO_REMOVE=(
    "bares-don"
    "catalogo-habysupply"
    "crud-bares"
    "desarrolloydisenio.com.ar"
    "menu-bares"
    "wappflow-n8n"
    "menu-bares.zip"
)

# Confirmar antes de proceder
echo "Se eliminarán los siguientes directorios del repositorio remoto:"
for dir in "${DIRS_TO_REMOVE[@]}"; do
    echo "  - $dir"
done
echo ""
read -p "¿Deseas continuar? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "📦 Eliminando directorios del historial de git..."
echo ""

# Eliminar cada directorio del historial de git
for dir in "${DIRS_TO_REMOVE[@]}"; do
    echo "🗑️  Eliminando: $dir"
    git rm -r --cached "$dir" 2>/dev/null || echo "   (no existe localmente, continuando...)"
done

echo ""
echo "💾 Creando commit de limpieza..."
git commit -m "chore: eliminar proyectos no relacionados del repositorio

- Elimina bares-don, catalogo-habysupply, crud-bares
- Elimina desarrolloydisenio.com.ar, menu-bares, wappflow-n8n
- Actualiza .gitignore para prevenir futuras subidas

Estos directorios son proyectos independientes que se subieron por error."

echo ""
echo "🚀 Subiendo cambios al repositorio remoto..."
git push origin main

echo ""
echo "✅ ¡Limpieza completada!"
echo ""
echo "📋 Próximos pasos opcionales:"
echo "   1. Verifica en GitHub que los directorios fueron eliminados"
echo "   2. Si los archivos todavía aparecen en el historial, considera usar:"
echo "      git filter-branch o BFG Repo-Cleaner para limpiar el historial"
echo ""
