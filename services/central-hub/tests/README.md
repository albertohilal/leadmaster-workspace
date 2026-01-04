# Tests de API con Playwright

Este proyecto incluye tests automatizados de API REST usando Playwright para validar todos los endpoints del sistema.

## 📦 Dependencias

- `@playwright/test` - Framework de testing
- `playwright` - Navegador headless para tests
- `start-server-and-test` - Inicia el servidor automáticamente antes de ejecutar tests

## 🚀 Ejecutar tests

### Opción 1: Con servidor ya corriendo
```bash
npm test
```

### Opción 2: Iniciar servidor automáticamente y ejecutar tests
```bash
npm run test:api
```

## 📝 Estructura de tests

```
tests/
├── session-manager.api.spec.ts  # Tests de gestión de sesión WhatsApp
├── listener.api.spec.ts         # Tests de respuestas automáticas e IA
└── sender.api.spec.ts           # Tests de envíos masivos
```

## ✅ Cobertura de tests

### Session Manager (7 tests)
- ✅ Health check del servicio
- ✅ Estado de sesión WhatsApp
- ✅ Consistencia entre state y ready
- ✅ QR cuando no está disponible (404)
- ✅ QR cuando está disponible (PNG)
- ✅ Tiempo de respuesta razonable

### Listener (13 tests)
- ✅ Obtener estado del listener
- ✅ Cambiar modo a respond/listen
- ✅ Rechazar modos inválidos
- ✅ Habilitar/deshabilitar IA por lead
- ✅ Validar teléfono requerido
- ✅ Simular mensajes en modo listen/respond
- ✅ Validar campos requeridos
- ✅ Obtener logs

### Sender (9 tests)
- ✅ Envío individual con/sin sesión activa
- ✅ Validar campos requeridos
- ✅ Envío masivo con/sin sesión
- ✅ Validar estructura de mensajes
- ✅ Diferentes formatos de mensaje
- ✅ Consultar estado de mensaje
- ✅ Tiempo de respuesta
- ✅ Manejo de números con diferentes formatos

**Total: 29 tests de API REST**

## 📊 Ver reportes

Después de ejecutar los tests, puedes ver el reporte HTML:

```bash
npx playwright show-report test-results/html-report
```

## 🔧 Configuración

La configuración está en `playwright.config.js`:
- **Base URL:** http://localhost:3010
- **Timeout:** 30 segundos por test
- **Retries:** 0 (sin reintentos)
- **Reporters:** Lista, HTML, JSON

## 🎯 Estrategia de testing

Los tests están diseñados para:

1. **No depender de estado externo:** Cada test es independiente
2. **Manejar estados variables:** Los tests se adaptan si WhatsApp está conectado o no
3. **Validar contratos de API:** Verifican estructura de respuestas
4. **Detectar regresiones:** Alertan si algo deja de funcionar
5. **Documentar comportamiento:** Los tests sirven como documentación viva

## 🚨 Consideraciones

- **WhatsApp:** Los tests de envío validarán si la sesión está activa
- **Base de datos:** Los tests de control de IA usan la DB real (tabla `ll_ia_control`)
- **OpenAI:** Los tests de respuestas automáticas NO consumen tokens (se valida estructura, no contenido)
- **Performance:** Cada test debe completar en < 30 segundos

## 🔍 Debugging

Para ejecutar un test específico:

```bash
npx playwright test tests/session-manager.api.spec.ts
```

Para ver el test en modo debug:

```bash
npx playwright test --debug
```

Para ver qué requests se están haciendo:

```bash
npx playwright test --headed
```

## 📈 CI/CD

Los tests están listos para integrarse en pipelines de CI/CD:

```bash
npm run test:api
```

El archivo `test-results/results.json` contiene los resultados en formato máquina para integración con herramientas de CI.
