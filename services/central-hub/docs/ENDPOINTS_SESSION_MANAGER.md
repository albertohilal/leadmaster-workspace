# Endpoints de gestión de sesión WhatsApp (session-manager)

El módulo `session-manager` expone endpoints REST para controlar y consultar el estado de la sesión de WhatsApp utilizada por el sistema. Estos endpoints permiten iniciar sesión (escaneo QR), consultar el estado, cerrar sesión y obtener el QR para autenticación.

## Endpoints disponibles

### 1. Consultar estado de la sesión
- **GET** `/session-manager/state`
- **Respuesta:**
  ```json
  {
    "state": "conectado" | "qr" | "desconectado",
    "hasQR": true | false
  }
  ```
- **Uso:**
  - `conectado`: Sesión activa y lista para enviar mensajes.
  - `qr`: Se requiere escanear el QR para iniciar sesión.
  - `desconectado`: Cliente no inicializado o desconectado.

### 2. Obtener QR de autenticación (imagen PNG)
- **GET** `/session-manager/qr`
- **Respuesta:**
  - Imagen PNG del QR (content-type: image/png)
  - **404** si el QR no está disponible.
- **Uso:**
  - Accede a este endpoint cuando `state` sea `qr` para mostrar el QR y escanearlo con la app de WhatsApp.

### 3. Estado general del servicio
- **GET** `/session-manager/status`
- **Respuesta:**
  ```json
  { "status": "session-manager ok" }
  ```

### 4. Iniciar login manualmente (placeholder)
- **POST** `/session-manager/login`
- **Respuesta:**
  ```json
  { "message": "login iniciado (placeholder)" }
  ```

### 5. Cerrar sesión manualmente (placeholder)
- **POST** `/session-manager/logout`
- **Respuesta:**
  ```json
  { "message": "logout iniciado (placeholder)" }
  ```

## Ejemplo de flujo para iniciar sesión
1. Consultar `/session-manager/state`.
2. Si `state` es `qr`, acceder a `/session-manager/qr` y escanear el QR con la app de WhatsApp.
3. Esperar a que el estado cambie a `conectado`.
4. Ya puedes enviar mensajes desde el sistema.

---

> **Nota:** Estos endpoints están pensados para ser consumidos por el listener, panel de administración o scripts de prueba. Si necesitas exponer el QR o el estado para un cliente específico, adapta los endpoints para recibir un parámetro `cliente_id` o similar.
