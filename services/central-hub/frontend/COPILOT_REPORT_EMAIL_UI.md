## Prompt 1 — Módulo Campañas Email: routing + navegación

### Cambios realizados

- Se actualizó el sidebar para que la entrada principal del canal Email sea `Campañas Email` y navegue a `/email/campaigns`.
- Se agregó la nueva ruta protegida `/email/campaigns` en el router principal del frontend.
- Se creó la pantalla `EmailCampaignsManager` como home del módulo, con acceso a `Nueva campaña Email` y placeholder visible para el futuro listado.
- Se mantuvo sin cambios funcionales la ruta existente `/email/campaigns/new`.

### Archivos tocados

- `services/central-hub/frontend/src/components/layout/Sidebar.jsx`
- `services/central-hub/frontend/src/App.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignsManager.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se reutilizó el patrón existente de `ProtectedRoute` + `Layout` para mantener consistencia con el resto de módulos.
- Se usó el componente compartido `Card` para respetar el estilo visual ya presente en el frontend.
- La entrada del sidebar apunta a `/email/campaigns` y, por la lógica actual de `startsWith`, queda activa tanto en la home del módulo como en `/email/campaigns/new`.
- No se agregaron llamadas a backend ni dependencias nuevas; el listado queda explícitamente marcado como pendiente de API.

### Cómo probar (pasos manuales)

1. Iniciar sesión en el frontend con un usuario válido.
2. Verificar que en el sidebar aparezca la opción `Campañas Email`.
3. Hacer click en `Campañas Email` y confirmar navegación a `/email/campaigns`.
4. Confirmar que la pantalla muestre el título `Campañas Email`, el botón `Nueva campaña Email` y el placeholder `Listado de campañas (pendiente de API)`.
5. Hacer click en `Nueva campaña Email` y verificar navegación a `/email/campaigns/new`.
6. Confirmar que la pantalla de creación existente siga funcionando como antes.

### Riesgos / pendientes

- El módulo home todavía no consume API ni muestra campañas reales.
- Falta definir el contrato backend para listado, detalle y acciones sobre campañas Email.
- La activación visual del sidebar depende de prefijos de ruta; hoy funciona para el flujo pedido, pero conviene revisarla si en el futuro se agregan subrutas más específicas.

## Prompt 2 — Nueva campaña Email: volver + redirect

### Cambios realizados

- Se agregó un acceso visible `← Volver a Campañas Email` en el header de la pantalla de creación.
- Se incorporó navegación programática con `useNavigate` para redirigir a `/email/campaigns` cuando la creación responde OK.
- Se mantuvieron intactas la validación, el mensaje actual de éxito y la llamada a `emailService.createCampaign()`.

### Archivos tocados

- `services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se usó `Link` para la navegación manual de regreso, manteniendo una UX simple y consistente con React Router.
- Se usó `useNavigate` para la redirección post-submit sin agregar dependencias ni alterar el flujo actual del formulario.
- La redirección ocurre sólo dentro del bloque exitoso del submit, por lo que no afecta validaciones ni errores de backend.
- El estado `success` se sigue seteando antes de navegar, cumpliendo el requisito de no romper el estado actual aunque la vista cambie enseguida.

### Cómo probar (pasos manuales)

1. Iniciar sesión y entrar a `/email/campaigns/new`.
2. Verificar que arriba del título aparezca `← Volver a Campañas Email`.
3. Hacer click en ese enlace y confirmar navegación a `/email/campaigns`.
4. Volver a `/email/campaigns/new`, completar el formulario con datos válidos y enviar.
5. Confirmar que, si la respuesta es exitosa, la app redirige automáticamente a `/email/campaigns`.
6. Confirmar que, si hay error de validación o de backend, no hay redirección y el comportamiento actual se mantiene.

### Riesgos / pendientes

- La redirección inmediata impide ver el mensaje de éxito en esta pantalla, aunque el estado siga seteándose como se pidió.
- Cuando exista detalle o identificador de campaña, convendrá reemplazar esta redirección al home por navegación a una vista específica.
- El módulo sigue sin listado real, por lo que el destino actual después del alta es todavía una home con placeholder.

## Prompt 3 — Prospects en módulo Email: ruta wrapper

### Cambios realizados

- Se agregó la nueva ruta protegida `/email/campaigns/prospects` dentro del módulo Email.
- Se creó `EmailCampaignProspectsPage` como wrapper liviano con título propio, link de regreso al módulo y reutilización directa de `GestionDestinatariosPage`.
- Se incorporó el CTA `Seleccionar destinatarios` en la home `/email/campaigns`.
- Se mantuvo la ruta legacy/compatible `/prospectos` sin cambios.

### Archivos tocados

- `services/central-hub/frontend/src/App.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignsManager.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignProspectsPage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se implementó un wrapper en vez de refactorizar `GestionDestinatariosPage`, respetando el alcance pedido y preservando compatibilidad con `/prospectos`.
- La nueva ruta usa el mismo patrón de `ProtectedRoute` + `Layout` del resto del frontend.
- El wrapper sólo agrega contexto visual del módulo Email y delega toda la lógica existente de destinatarios al componente actual.
- El CTA adicional en la home del módulo usa `Link` y estilos Tailwind consistentes con el botón principal ya existente.

### Cómo probar (pasos manuales)

1. Iniciar sesión y entrar a `/email/campaigns`.
2. Verificar que exista el botón `Seleccionar destinatarios` junto a `Nueva campaña Email`.
3. Hacer click en `Seleccionar destinatarios` y confirmar navegación a `/email/campaigns/prospects`.
4. Verificar que la pantalla cargue sin crash, muestre `Seleccionar destinatarios (Email)` y el link `← Volver a Campañas Email`.
5. Hacer click en `← Volver a Campañas Email` y confirmar retorno a `/email/campaigns`.
6. Navegar manualmente a `/prospectos` y confirmar que sigue cargando el flujo existente como antes.

### Riesgos / pendientes

- `GestionDestinatariosPage` conserva su comportamiento y UI original, por lo que puede mostrar elementos pensados para el flujo general además del contexto Email.
- Al renderizar el wrapper arriba del componente existente, puede haber duplicación visual de títulos o controles propios de la página reutilizada.
- Cuando se avance el módulo Email, probablemente convenga extraer una versión más composable de destinatarios en lugar de depender de una página completa reutilizada como child.