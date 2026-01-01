#!/bin/bash

# Script de instalación y configuración del módulo sync-contacts

echo "🚀 Instalando módulo Sync Contacts..."
echo ""

# 1. Verificar dependencias Node.js
echo "📦 Verificando dependencias de Node.js..."
cd /home/beto/Documentos/Github/leadmaster-central-hub
npm list googleapis > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ googleapis ya instalado"
else
    echo "📥 Instalando googleapis..."
    npm install googleapis
fi

echo ""

# 2. Crear tablas en base de datos
echo "🗄️  Creando tablas en base de datos..."
echo "   Ejecuta manualmente el archivo: sql/ll_sync_contactos_schema.sql"
echo "   MySQL> source /ruta/completa/sql/ll_sync_contactos_schema.sql"

echo ""

# 3. Configurar variables de entorno
echo "🔧 Configuración de variables de entorno..."
if [ ! -f .env ]; then
    echo "   ⚠️  Archivo .env no existe. Copia .env.example y configura:"
    echo "   cp .env.example .env"
fi

echo ""
echo "   Asegúrate de configurar en .env:"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GOOGLE_CLIENT_SECRET"
echo "   - GOOGLE_REDIRECT_URI=http://localhost:3012/sync-contacts/callback"

echo ""

# 4. Instrucciones Google Cloud
echo "☁️  Configuración de Google Cloud Console:"
echo ""
echo "   1. Ve a https://console.cloud.google.com"
echo "   2. Crea un nuevo proyecto (o selecciona uno existente)"
echo "   3. Habilita 'Google People API'"
echo "   4. Ve a 'Credenciales' → 'Crear credenciales' → 'ID de cliente de OAuth 2.0'"
echo "   5. Tipo de aplicación: 'Aplicación web'"
echo "   6. URI de redireccionamiento autorizado: http://localhost:3012/sync-contacts/callback"
echo "   7. Copia el Client ID y Client Secret al archivo .env"

echo ""

# 5. Verificar módulo instalado
echo "✅ Verificando instalación del módulo..."
if [ -f "src/modules/sync-contacts/routes/index.js" ]; then
    echo "✅ Módulo sync-contacts encontrado"
else
    echo "❌ ERROR: Módulo sync-contacts no encontrado"
    exit 1
fi

echo ""
echo "🎉 Instalación del módulo Sync Contacts completada!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Ejecuta el SQL: mysql -u usuario -p database < sql/ll_sync_contactos_schema.sql"
echo "   2. Configura Google Cloud OAuth (ver instrucciones arriba)"
echo "   3. Actualiza .env con las credenciales de Google"
echo "   4. Reinicia el servidor: npm start"
echo "   5. Prueba la autorización: GET /sync-contacts/authorize/51 (como usuario Haby)"
echo ""
