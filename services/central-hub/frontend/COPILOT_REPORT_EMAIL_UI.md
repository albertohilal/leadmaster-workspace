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

## Prompt 4 — Destinatarios embebible: hideHeader + back configurable

### Cambios realizados

- Se parametrizó `GestionDestinatariosPage` con las props opcionales `hideHeader`, `backPath` y `title`.
- El header superior propio de `GestionDestinatariosPage` ahora se oculta cuando `hideHeader` es `true`.
- El wrapper `EmailCampaignProspectsPage` pasó a reutilizar `GestionDestinatariosPage` en modo embebido con `hideHeader`.
- El uso legacy `/prospectos` queda intacto porque sigue renderizando el componente sin props, usando los defaults originales.

### Archivos tocados

- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignProspectsPage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se eligieron props opcionales con defaults para preservar compatibilidad hacia atrás sin tocar la ruta `/prospectos`.
- La lógica interna de carga, filtros, selección, modales y envíos no se modificó; sólo se aisló el bloque visual del header superior.
- `backPath` y `title` sólo se usan cuando el header está visible, respetando la regla de ignorarlos en modo embebido.
- El wrapper Email mantiene su propio encabezado y delega el resto del flujo a `GestionDestinatariosPage` sin refactor adicional.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/email/campaigns/prospects`.
2. Verificar que se vea sólo el header del wrapper con `Seleccionar destinatarios (Email)` y `← Volver a Campañas Email`.
3. Confirmar que no aparezca el header interno de `GestionDestinatariosPage` con `Volver` + `Seleccionar Prospectos`.
4. Probar filtros, selección de prospectos y apertura de modales para confirmar que el flujo sigue operativo.
5. Navegar a `/prospectos` y verificar que el header legacy siga visible con su botón `Volver`, título `Seleccionar Prospectos` y contador.
6. Confirmar en `/prospectos` que las acciones existentes de selección, filtros, modales y envío siguen funcionando igual.

### Riesgos / pendientes

- El modo embebido resuelve el header duplicado, pero `GestionDestinatariosPage` sigue siendo una página grande reutilizada dentro de otra vista.
- Si en el futuro se necesitan más variantes visuales del flujo de destinatarios, probablemente convenga extraer subcomponentes más pequeños.
- No se agregó tipado formal de props, por lo que el contrato sigue siendo implícito en JavaScript.

## Prompt 5 — Campañas Email: listado UI (mock) + acciones

### Cambios realizados

- Se reemplazó el placeholder del home de campañas Email por una tabla UI con 3 campañas mock.
- Se mantuvieron los CTAs `Nueva campaña Email` y `Seleccionar destinatarios` dentro de la card de gestión.
- Se agregaron acciones por fila: `Destinatarios` hacia `/email/campaigns/prospects` y `Ver (pendiente)` deshabilitado.
- Se incorporó una estructura de empty state para el caso en que el mock quede vacío.

### Archivos tocados

- `services/central-hub/frontend/src/components/email/EmailCampaignsManager.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- El listado usa un array `MOCK_CAMPAIGNS` in-file para no introducir dependencias ni llamadas a backend en esta etapa.
- Se agregaron helpers locales `badgeForStatus()` y `labelForStatus()` para dejar preparada la UI de estado antes de conectar la API real.
- La tabla y las acciones se diseñaron para que luego sea simple reemplazar el mock por `emailService.listCampaigns()`.
- La acción `Ver` queda deshabilitada con texto explícito `pendiente` para evitar rutas o pantallas no implementadas.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/email/campaigns`.
2. Verificar que sigan visibles los botones `Nueva campaña Email` y `Seleccionar destinatarios`.
3. Confirmar que debajo se muestre una tabla con 3 campañas mock.
4. Verificar que cada fila muestre `Nombre`, `Asunto`, `Estado`, `Actualizado` y `Acciones`.
5. Hacer click en `Destinatarios` desde cualquier fila y confirmar navegación a `/email/campaigns/prospects`.
6. Confirmar que `Ver (pendiente)` aparezca deshabilitado y que no rompa la navegación actual.

### Riesgos / pendientes

- El listado todavía no está conectado a backend ni refleja campañas reales persistidas.
- Los valores de estado y fecha son mock, por lo que pueden diferir del contrato final de la API.
- Cuando se implemente `emailService.listCampaigns()`, habrá que definir loading, error state y posiblemente paginación o filtros.

## Prompt 6 — Destinatarios por campaña: route param con fallback seguro

### Cambios realizados

- Se agregó la ruta protegida `/email/campaigns/:campaignId/prospects` manteniendo también `/email/campaigns/prospects`.
- La acción `Destinatarios` del listado Email ahora navega a la ruta contextual por campaña.
- El wrapper `EmailCampaignProspectsPage` ahora lee `campaignId` desde la URL y lo pasa a `GestionDestinatariosPage`.
- `GestionDestinatariosPage` sólo fija y bloquea la campaña cuando el `campaignId` coincide con una campaña cargada; si no hay match, deja el selector habilitado y muestra un warning no bloqueante.

### Archivos tocados

- `services/central-hub/frontend/src/App.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignsManager.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignProspectsPage.jsx`
- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se reutilizó el mismo wrapper para la ruta genérica y la contextual para no duplicar vistas ni lógica de navegación.
- La coincidencia de campaña se resolvió comparando `campaignId` con los `id` cargados por `campanasService`, evitando fijar un valor inválido en el selector.
- El selector sólo queda `disabled` cuando existe match real; en caso contrario se mantiene el flujo genérico como fallback seguro.
- El warning contextual se muestra sólo cuando llega un `campaignId` sin correspondencia, sin alterar filtros, modales ni lógica operativa existente.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/email/campaigns`.
2. Hacer click en `Destinatarios` desde una fila y confirmar navegación a `/email/campaigns/<id>/prospects`.
3. Verificar que, si ese `id` no existe en las campañas cargadas, el selector siga habilitado y aparezca el warning `Esta campaña Email aún no está vinculada a una campaña operativa. Seleccioná una campaña para continuar.`.
4. Navegar a `/email/campaigns/prospects` y confirmar que el flujo genérico sigue permitiendo elegir campaña manualmente sin warnings.
5. Probar manualmente un caso con `campaignId` que sí exista y verificar que la campaña quede preseleccionada, el selector quede bloqueado y aparezca el hint contextual.
6. Confirmar que `/prospectos` siga funcionando con el comportamiento legacy.

### Riesgos / pendientes

- Los `campaignId` del listado Email siguen siendo mock y hoy no necesariamente coinciden con campañas operativas reales cargadas por `campanasService`.
- Cuando exista integración real entre campañas Email y campañas operativas, habrá que reemplazar esta coincidencia temporal por un vínculo de dominio explícito.
- Si en el futuro se cambia la forma de identificar campañas, habrá que revisar la comparación basada en `String(c.id) === String(campaignId)`.

## Prompt 7 — Sidebar: alinear navegación modular (sin Prospectos como módulo)

### Cambios realizados

- Se quitó `Seleccionar Prospectos` del sidebar para que deje de figurar como módulo global.
- Se mantuvo intacto el acceso a destinatarios desde el módulo Email mediante el CTA `Seleccionar destinatarios`.
- Se agregó un CTA visible `Seleccionar destinatarios` en `CampaignsManager` para conservar acceso operativo desde campañas WhatsApp.
- No se eliminaron ni modificaron las rutas `/prospectos` ni `/email/campaigns/prospects`.

### Archivos tocados

- `services/central-hub/frontend/src/components/layout/Sidebar.jsx`
- `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se priorizó navegación modular removiendo `Prospectos` del menú principal en lugar de renombrarlo o reubicarlo.
- El acceso operativo a `/prospectos` se conservó desde campañas WhatsApp con un CTA directo en la cabecera del módulo.
- No se tocaron las rutas existentes para preservar compatibilidad con flujos legacy y accesos internos ya implementados.
- El CTA agregado en WhatsApp usa estilos consistentes con los botones existentes del frontend.

### Cómo probar (pasos manuales)

1. Iniciar sesión y verificar que el sidebar ya no muestre `Seleccionar Prospectos`.
2. Navegar a `/email/campaigns` y confirmar que sigue visible el CTA `Seleccionar destinatarios`.
3. Hacer click en ese CTA y verificar navegación a `/email/campaigns/prospects`.
4. Navegar a `/campaigns` y verificar que en la cabecera exista el CTA `Seleccionar destinatarios`.
5. Hacer click en ese CTA y confirmar navegación a `/prospectos`.
6. Confirmar que tanto `/prospectos` como `/email/campaigns/prospects` siguen cargando sin romper flujos existentes.

### Riesgos / pendientes

- Usuarios habituados al acceso directo desde el sidebar pueden necesitar adaptación al nuevo esquema modular.
- El acceso a destinatarios desde WhatsApp ahora depende del CTA en `CampaignsManager`, por lo que conviene mantenerlo visible en futuros rediseños.
- Si aparecen más módulos que reutilicen destinatarios, convendrá definir una estrategia consistente para accesos contextuales sin reintroducir un pseudo-módulo global.

## Prompt 8 — WhatsApp: remover referencias a Email (módulos independientes)

### Cambios realizados

- Se eliminó por completo la card `Nuevo frente Email` de `CampaignsManager`.
- Se mantuvo intacto el CTA `Seleccionar destinatarios` dentro del módulo Campañas WhatsApp.
- No se agregó ningún acceso nuevo a Email dentro de la pantalla de WhatsApp; el acceso queda sólo por navegación modular.
- Se preservó el acceso al módulo Email desde el sidebar, sin tocar sus rutas ni componentes.

### Archivos tocados

- `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se removió el bloque promocional de Email para evitar mezclar dominios funcionales dentro del módulo WhatsApp.
- No se alteró la navegación existente: Email sigue entrando por `Campañas Email` en el sidebar y WhatsApp conserva su propio acceso operativo a destinatarios.
- El cambio es únicamente visual y no modifica rutas, contratos ni lógica de negocio.
- Se dejó intacto el CTA `Seleccionar destinatarios` en WhatsApp porque forma parte del flujo operativo propio del módulo.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/campaigns`.
2. Verificar que ya no aparezca la card `Nuevo frente Email`.
3. Confirmar que el CTA `Seleccionar destinatarios` siga visible en la cabecera del módulo.
4. Hacer click en `Seleccionar destinatarios` y verificar navegación a `/prospectos`.
5. Verificar que el sidebar siga mostrando `Campañas Email` como acceso separado al módulo Email.
6. Hacer click en `Campañas Email` desde el sidebar y confirmar que `/email/campaigns` sigue funcionando.

### Riesgos / pendientes

- Al quitar la referencia visual dentro de WhatsApp, algunos usuarios pueden tardar en descubrir el módulo Email si sólo navegaban por esa pantalla.
- Si en el futuro se requiere relacionar ambos canales, convendrá hacerlo desde navegación global o dashboards, no desde copy mezclado en cada módulo.
- El acceso a Email queda correctamente desacoplado en UI, pero todavía resta consolidar esa separación a nivel de datos y backend.

## Prompt 9 — Email destinatarios: shortcuts operativos en header

### Cambios realizados

- Se actualizó el header de `EmailCampaignProspectsPage` para mantener `← Volver a Campañas Email` y sumar el acceso rápido `+ Nueva campaña Email`.
- Se agregó una línea informativa `Contexto campaña: <campaignId>` cuando la ruta incluye un `campaignId`.
- Se mantuvo intacto el render de `GestionDestinatariosPage hideHeader campaignId={campaignId}`.

### Archivos tocados

- `services/central-hub/frontend/src/components/email/EmailCampaignProspectsPage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Los accesos operativos se resolvieron en el wrapper para no tocar la lógica interna del flujo de destinatarios.
- El CTA `+ Nueva campaña Email` usa estilos Tailwind consistentes con otros accesos secundarios del módulo.
- El `campaignId` se muestra sólo como contexto visual y no modifica el comportamiento ya implementado.
- Se mantuvo el patrón actual de navegación del módulo Email sin agregar dependencias nuevas.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/email/campaigns/prospects`.
2. Verificar que se vean `← Volver a Campañas Email` y `+ Nueva campaña Email` en el header.
3. Hacer click en `+ Nueva campaña Email` y confirmar navegación a `/email/campaigns/new`.
4. Volver a `/email/campaigns/prospects` y confirmar que `GestionDestinatariosPage` sigue renderizando normalmente.
5. Navegar a `/email/campaigns/<id>/prospects`.
6. Verificar que además aparezca la línea `Contexto campaña: <id>` sin romper el flujo de destinatarios.

### Riesgos / pendientes

- El `campaignId` mostrado en el header es sólo informativo y todavía puede provenir de datos mock no vinculados al backend real.
- Si en el futuro el header requiere más acciones operativas, convendrá revisar jerarquía visual para no sobrecargar la cabecera.
- La navegación rápida a nueva campaña mejora operación, pero no reemplaza una futura vista de detalle o edición contextual por campaña.

## Prompt 10 — Destinatarios: default filtro canal Email en módulo Email

### Cambios realizados

- Se agregó la prop opcional `defaultCanalDisponibleFiltro` a `GestionDestinatariosPage` con default `'todos'`.
- El estado inicial y el reset del filtro `Canal disponible` ahora respetan `defaultCanalDisponibleFiltro`.
- `EmailCampaignProspectsPage` pasó a renderizar `GestionDestinatariosPage` con `defaultCanalDisponibleFiltro="email"`.
- El flujo legacy `/prospectos` no se tocó, por lo que mantiene el default actual en `Todos`.

### Archivos tocados

- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignProspectsPage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- El default del filtro se parametrizó por prop para reutilizar la misma página en distintos contextos sin duplicar lógica.
- No se fuerza el filtro después del render inicial: el operador puede cambiarlo manualmente y seguir trabajando igual.
- El reset dentro de `cargarProspectos()` usa el mismo valor por defecto para mantener consistencia al cambiar de campaña.
- El flujo Email fija `email` como valor inicial, mientras que el flujo legacy conserva `'todos'` por omisión.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/email/campaigns/prospects`.
2. Verificar que el filtro `Canal disponible` arranque seleccionado en `Email`.
3. Cambiar el filtro manualmente a otro valor y confirmar que la UI responde normalmente.
4. Seleccionar otra campaña dentro del flujo Email y verificar que el filtro vuelva a resetearse a `Email`.
5. Navegar a `/email/campaigns/<id>/prospects` y confirmar que el filtro también arranca en `Email`.
6. Navegar a `/prospectos` y verificar que el filtro `Canal disponible` siga arrancando en `Todos`.

### Riesgos / pendientes

- El filtro por default mejora la operación de Email, pero sigue dependiendo de la disponibilidad real de emails en los prospectos cargados.
- Si más adelante aparecen otros módulos con defaults distintos, convendrá documentar explícitamente los valores admitidos por `defaultCanalDisponibleFiltro`.
- El comportamiento de reset al cambiar campaña ahora es contextual; si en el futuro se quiere preservar la última selección manual, habrá que revisar esta decisión.

## Prompt 11 — Destinatarios Email: ocultar acciones WhatsApp en módulo Email

### Cambios realizados

- Se agregó la prop opcional `hideWhatsappActions` a `GestionDestinatariosPage`.
- Cuando `hideWhatsappActions` es `true`, se oculta el botón `Preparar envío WhatsApp`.
- El texto del bloque `Acciones sobre seleccionados` ahora cambia a una versión neutral en el contexto Email.
- `EmailCampaignProspectsPage` pasó a activar `hideWhatsappActions`, manteniendo intacto el flujo legacy `/prospectos`.

### Archivos tocados

- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- `services/central-hub/frontend/src/components/email/EmailCampaignProspectsPage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se ocultó sólo la UI de WhatsApp y no se modificaron funciones ni lógica interna del envío para evitar regresiones en el flujo legacy.
- El copy descriptivo se resolvió de forma condicional para que el módulo Email no siga hablando de WhatsApp como flujo principal.
- La activación de este modo ocurre únicamente desde el wrapper Email, preservando el comportamiento completo de `/prospectos`.
- El botón `Preparar envío Email` y el resto de la operativa de destinatarios permanecen sin cambios.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/email/campaigns/prospects`.
2. Verificar que en `Acciones sobre seleccionados` ya no aparezca `Preparar envío WhatsApp`.
3. Confirmar que el texto descriptivo no mencione WhatsApp y diga `Prepará y enviá Email sobre la selección común.`.
4. Confirmar que `Preparar envío Email` siga visible y funcione igual.
5. Navegar a `/email/campaigns/<id>/prospects` y verificar el mismo comportamiento.
6. Navegar a `/prospectos` y confirmar que el botón `Preparar envío WhatsApp` y el texto legacy siguen visibles.

### Riesgos / pendientes

- La tabla sigue mostrando la columna de disponibilidad WhatsApp también en el contexto Email, porque este prompt sólo oculta acciones y copy operativo.
- Si en el futuro se busca una experiencia Email aún más enfocada, convendrá revisar también columnas, badges y acciones por fila.
- La lógica de WhatsApp sigue presente en el componente compartido, aunque quede oculta en el wrapper Email.

## Prompt 12 — Destinatarios Email: ocultar Web WhatsApp por fila

### Cambios realizados

- Se reutilizó `hideWhatsappActions` para ocultar el botón `Web WhatsApp` en la columna de acciones por fila.
- El flujo Email hereda este comportamiento desde su wrapper sin cambios adicionales.
- El flujo legacy `/prospectos` conserva la acción `Web WhatsApp` cuando corresponde.

### Archivos tocados

- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- `services/central-hub/frontend/COPILOT_REPORT_EMAIL_UI.md`

### Decisiones técnicas

- Se ocultó únicamente la UI del botón `Web WhatsApp`, sin tocar `handleAbrirModalWhatsApp()` ni la lógica interna existente.
- Se reutilizó la misma prop ya introducida para el contexto Email, evitando agregar nuevas banderas innecesarias.
- El comportamiento legacy se preserva por default porque `hideWhatsappActions` sigue siendo `false` fuera del wrapper Email.

### Cómo probar (pasos manuales)

1. Iniciar sesión y navegar a `/email/campaigns/prospects`.
2. Verificar que en ninguna fila aparezca el botón `Web WhatsApp`.
3. Navegar a `/email/campaigns/<id>/prospects` y confirmar el mismo comportamiento.
4. Verificar que el resto de acciones por fila, como `Clasificar post-envío`, sigan visibles cuando corresponda.
5. Navegar a `/prospectos`.
6. Confirmar que el botón `Web WhatsApp` siga apareciendo en las filas que cumplan la condición legacy.

### Riesgos / pendientes

- En el contexto Email todavía se ve la columna de disponibilidad WhatsApp, aunque la acción por fila quede oculta.
- Si más adelante se requiere una experiencia Email completamente aislada, convendrá revisar también acciones de clasificación y columnas contextuales.
- La lógica de apertura de WhatsApp sigue viva en el componente compartido, aunque quede inaccesible desde el wrapper Email.