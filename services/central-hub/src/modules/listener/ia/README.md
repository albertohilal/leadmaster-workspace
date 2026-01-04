# IA y respuestas automáticas por cliente

Este módulo permite definir reglas, respuestas y contexto de IA para cada cliente de forma desacoplada y extensible.

## Archivos principales
- `analizador.js`: Detecta patrones en mensajes y decide si hay respuesta automática.
- `respuestas.js`: Respuestas automáticas por clave y cliente.
- `contexto.js`: Contexto personalizado para la IA por cliente.
- `chatgpt.js`: Lógica de integración con OpenAI (fallback IA).
- `iaService.js`: Orquesta el flujo: primero reglas, luego IA si no hay coincidencia.

## Cómo agregar reglas para un nuevo cliente
1. Agrega reglas en `analizador.js` bajo el cliente_id correspondiente.
2. Agrega respuestas en `respuestas.js` bajo el mismo cliente_id.
3. (Opcional) Personaliza el contexto en `contexto.js`.

## Ejemplo de uso
```js
const iaService = require('./iaService');

async function onMessageReceived({ cliente_id, telefono, texto }) {
  const respuesta = await iaService.responder({ cliente_id, telefono, texto });
  // ...enviar respuesta por WhatsApp
}
```

## Extensión
- Puedes agregar lógica de logging, métricas o control manual fácilmente.
- El sistema es compatible con multi-cliente y multi-regla.
