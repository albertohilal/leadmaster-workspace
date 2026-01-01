#!/bin/bash

echo "🧪 Iniciando pruebas del flujo de campañas..."
echo ""

# 1. Verificar backend
echo "1. Verificando backend..."
HEALTH_RESPONSE=$(curl -s http://localhost:3011/health)
if [[ $? -eq 0 ]]; then
    echo "✅ Backend responde correctamente"
    echo "   Respuesta: $HEALTH_RESPONSE"
else
    echo "❌ Backend no responde"
    exit 1
fi

echo ""

# 2. Hacer login como cliente
echo "2. Probando login de cliente Haby..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3011/auth/login \
    -H "Content-Type: application/json" \
    -d '{"usuario":"Haby","password":"haby1973"}')

echo "   Respuesta login: $LOGIN_RESPONSE"

# Extraer token si el login fue exitoso
if echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
    echo "✅ Login exitoso"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "   Token obtenido: ${TOKEN:0:20}..."
    
    echo ""
    
    # 3. Verificar endpoint de campañas
    echo "3. Verificando endpoint de campañas..."
    CAMPAIGNS_RESPONSE=$(curl -s http://localhost:3011/sender/campaigns \
        -H "Authorization: Bearer $TOKEN")
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Endpoint de campañas funciona"
        echo "   Respuesta: $CAMPAIGNS_RESPONSE"
    else
        echo "❌ Error en endpoint de campañas"
    fi
    
    echo ""
    
    # 4. Verificar endpoint de leads
    echo "4. Verificando endpoint de leads..."
    LEADS_RESPONSE=$(curl -s http://localhost:3011/sender/leads \
        -H "Authorization: Bearer $TOKEN")
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Endpoint de leads funciona"
        echo "   Respuesta: $LEADS_RESPONSE"
    else
        echo "❌ Error en endpoint de leads"
    fi
else
    echo "❌ Error en login de cliente"
fi

echo ""

# 5. Hacer login como administrador
echo "5. Probando login de administrador..."
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3011/auth/login \
    -H "Content-Type: application/json" \
    -d '{"usuario":"b3toh","password":"elgeneral2018"}')

echo "   Respuesta login admin: $ADMIN_LOGIN_RESPONSE"

if echo "$ADMIN_LOGIN_RESPONSE" | grep -q '"token"'; then
    echo "✅ Login de admin exitoso"
else
    echo "❌ Error en login de admin"
fi

echo ""
echo "🎉 ¡Pruebas completadas!"