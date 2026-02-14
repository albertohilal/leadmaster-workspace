## 5) `05-pruebas-e2e.md`

```md
# Pruebas End-to-End (E2E)

## 1. Login como admin

curl -X POST http://localhost:3012/api/auth/login
-H "Content-Type: application/json"
-d '{
"usuario": "b3toh",
"password": "..."
}'

shell
Copiar código

## 2. Guardar token en la sesión

export TOKEN_ADMIN="eyJhbGciOiJIUz..."

graphql
Copiar código

## 3. Probar estado del sender

curl http://localhost:3012/api/sender/status
-H "Authorization: Bearer $TOKEN_ADMIN"

shell
Copiar código

## 4. Probar envío de prueba

curl -X POST http://localhost:3012/api/sender/test-send
-H "Authorization: Bearer $TOKEN_ADMIN"
-H "Content-Type: application/json"
-d '{
"clienteId": 51,
"to": "54911XXXXXXXX",
"message": "Prueba E2E OK"
}'