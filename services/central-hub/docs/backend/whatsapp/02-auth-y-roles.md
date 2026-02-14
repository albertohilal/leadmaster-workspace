# Autenticación y Roles

## Contexto
Central Hub expone APIs protegidas por JWT. La autenticación se realiza mediante usuario y contraseña.

## Modelo de usuarios

| Campo | Descripción |
|-------|-------------|
| id | Identificador interno |
| cliente_id | Contexto de negocio del usuario |
| usuario | Nombre de usuario |
| tipo | `admin` o `cliente` |
| activo | Booleano de habilitación |

## Roles

### Admin
- `cliente_id = 1`
- `tipo = admin`
- Operador del sistema
- Puede enviar mensajes
- Puede operar campañas en nombre de cualquier cliente

### Cliente
- `cliente_id != 1`
- `tipo = cliente`
- Usuarios de visualización y métricas
- No envían mensajes ni operan campañas directamente

## JWT
Al autenticar, se obtiene un JWT con esta forma (payload típico):

```json
{
  "id": 2,
  "cliente_id": 51,
  "usuario": "Haby",
  "tipo": "cliente"
}
