1. Resumen Ejecutivo

El módulo whatsappQrAuthorization ha alcanzado un estado estable, validado y cerrado en términos de arquitectura, lógica de negocio y cobertura de pruebas unitarias.
Se decide pausar deliberadamente el avance técnico del proyecto para priorizar tareas urgentes de negocio, en particular la reactivación de la campaña de Haby, evitando dispersión cognitiva y pérdida de timing comercial.

Esta pausa no responde a deuda técnica, sino a una decisión estratégica consciente.

2. Estado Técnico Actual (al momento de la pausa)
2.1 Testing y Coverage

Core de negocio (repositories + services):

~100% de cobertura real y honesta.

Tests unitarios completos y estables.

Controllers:

Excluidos del scope de testing unitario.

Destinados a pruebas de integración / API.

2.2 Configuración de herramientas

Jest

Configurado con scope explícito por módulo.

Separado correctamente de Playwright.

Playwright

Utilizado exclusivamente para pruebas API / E2E.

Sin interferencia con Jest.

2.3 Estado del módulo

whatsappQrAuthorization

Repositories: cerrados.

Services: cerrados.

Listo para refactor seguro e integración futura.

Considerado production-ready a nivel core.

3. Decisión Tomada y Justificación

Se decide detener el avance técnico por los siguientes motivos:

Prioridad comercial inmediata
La reactivación de la campaña de Haby es time-sensitive y tiene impacto directo en resultados de negocio.

Estado técnico suficiente y seguro
El módulo alcanzó un nivel de calidad que permite pausar sin riesgo de regresión ni deuda oculta.

Gestión del foco y carga cognitiva
Avanzar simultáneamente en arquitectura compleja y tareas comerciales aumenta el riesgo de errores y diluye la efectividad en ambos frentes.

Esta pausa es intencional, temporal y documentada.

4. Qué NO hacer al retomar (reglas explícitas)

❌ No modificar whatsappQrAuthorization sin una nueva decisión técnica documentada.

❌ No reconfigurar Jest ni Playwright “por ajuste rápido”.

❌ No mezclar nuevamente tests unitarios y E2E.

❌ No iniciar nuevos módulos sin definir primero scope, testing y prioridad.

Estas restricciones existen para preservar la calidad lograda.

5. Punto exacto de reanudación (muy importante)

Cuando se retome el desarrollo técnico, el próximo paso recomendado y único es:

▶ Módulo session-manager

Orden sugerido:

Revisión del estado actual del módulo.

Identificación de repositories y services.

Definición de tests unitarios (mismo estándar que QR Authorization).

Coverage acotado por módulo.

Integración progresiva con whatsappQrAuthorization.

No se recomienda retomar por otro módulo sin justificarlo explícitamente.

6. Nota final

Este documento actúa como:

Registro de decisión técnica.

Punto de control de calidad.

Guía de reanudación sin pérdida de contexto.

Debe leerse antes de cualquier nuevo desarrollo técnico en el Central Hub.

Veredicto profesional

✔ El contenido original era correcto
✔ Esta versión lo deja a prueba de tiempo y olvidos
✔ Sirve tanto para vos como para cualquier colaborador futuro

Si querés, el próximo paso lógico es:

guardar esto en /docs/decisiones/

y cambiar de contexto sin culpa a la campaña de Haby

Cuando quieras, pasamos 100% a Haby.