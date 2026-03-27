# Diagnóstico de publicación del frontend de central-hub

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Determinar cómo se publica realmente el frontend de `central-hub` en este entorno y aclarar:

1. qué genera `npm run build` en `services/central-hub/frontend`
2. qué carpeta se sirve realmente hoy
3. si Nginx sirve estáticos directamente o solo hace proxy
4. si hace falta `reload nginx`, copia manual o restart adicional para ver cambios frontend
5. qué hipótesis explica mejor el problema observado: copy viejo antes del build y copy actualizado después del build

## Fuentes revisadas

### Configuración de frontend en repo
- `services/central-hub/frontend/package.json`
- `services/central-hub/frontend/vite.config.js`
- `services/central-hub/frontend/nginx.conf`
- `services/central-hub/src/index.js`
- `services/central-hub/docker/docker-compose.yml`

### Configuración Nginx y despliegue en repo
- `infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`
- `AUXILIAR/sites-available/desarrolloydisenioweb.com.ar.conf`
- `services/central-hub/docs/deployment/DEPLOY_CONTABO.md`
- `services/central-hub/docs/BUGFIX_WHATSAPP_FRONTEND_API_ROUTING.md`
- `services/central-hub/docs/diagnosticos/DIAGNOSTICO_BOTON_WHATSAPP_MANUAL.md`
- `services/central-hub/docs/RESOLUCION_VISUALIZACION_CAMPANAS.md`

### Evidencia observada en este entorno
- archivo activo: `/etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`
- directorio observado: `/root/leadmaster-workspace/services/central-hub/frontend/dist`
- directorio observado: `/var/www/desarrolloydisenioweb`

## Estado verificado del build frontend

### Qué genera `npm run build`

**Verificado por código/config repo:** en `services/central-hub/frontend/package.json`, el script `build` es `vite build`.

**Verificado por código/config repo:** no hay override de `build.outDir` en `services/central-hub/frontend/vite.config.js`.

**Conclusión verificada:** `vite build` genera el artefacto en `services/central-hub/frontend/dist/`.

### Evidencia local del build

**Verificado en este entorno:** existe `services/central-hub/frontend/dist/` con:

- `index.html`
- `assets/index-kvBzo1LD.js`
- `assets/index-B1vk5q3j.css`

**Verificado en este entorno:** `dist/` e `dist/index.html` quedaron con timestamp de `2026-03-24 19:33:52 -0300`, consistente con un build reciente.

### Respuesta a la pregunta 1

**Sí.** `vite build` genera `dist/`.

Lo que cambia según el entorno no es el build, sino **si esa carpeta `dist/` es la que realmente se sirve**.

## Estado verificado de publicación / servido estático

### Lo que dice el repo

Hay dos modelos documentales distintos en el repositorio:

#### Modelo A — Nginx sirviendo archivos estáticos desde `/var/www/desarrolloydisenioweb`

**Verificado por config repo:** `infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf` usa:

- `root /var/www/desarrolloydisenioweb;`
- `location / { try_files $uri $uri/ /index.html; }`

**Verificado por documentación previa:** varios documentos locales del servicio describen el flujo:

1. `npm run build`
2. copiar `dist/*` a `/var/www/desarrolloydisenioweb/`
3. recargar Nginx

Ese patrón aparece, por ejemplo, en:

- `services/central-hub/docs/BUGFIX_WHATSAPP_FRONTEND_API_ROUTING.md`
- `services/central-hub/docs/diagnosticos/DIAGNOSTICO_BOTON_WHATSAPP_MANUAL.md`
- `services/central-hub/docs/RESOLUCION_VISUALIZACION_CAMPANAS.md`

#### Modelo B — Nginx sirviendo o referenciando `frontend/dist` directamente

**Verificado por documentación previa:** `services/central-hub/docs/deployment/DEPLOY_CONTABO.md` describe otro estado:

- frontend estático en `/root/leadmaster-central-hub/frontend/dist`
- Nginx con `root /root/leadmaster-central-hub/frontend/dist;`

Ese documento no coincide con la config repo más reciente en `infra/nginx/...`.

### Lo que gobierna este entorno real hoy

**Verificado en runtime:** el archivo activo `/etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf` no usa `root` para servir el frontend desde disco.

**Verificado en runtime:** el comentario del archivo activo dice explícitamente:

- ya no se sirve frontend desde disco con `root`
- todo el frontend SPA lo sirve Express desde `/frontend/dist`

**Verificado en runtime:** el archivo activo hace:

- `location /api/` → proxy a `127.0.0.1:3012`
- `location /` → proxy a `127.0.0.1:3012`

**Verificado por código/config repo:** `services/central-hub/src/index.js` sirve frontend desde:

- `path.join(__dirname, '../frontend/dist')`
- `express.static(frontendDistPath)`
- fallback SPA vía `sendFile(.../frontend/dist/index.html)`

### Conclusión sobre publicación real actual

**Verificado por runtime + código:** en este entorno actual el frontend no lo sirve Nginx directamente desde `/var/www/...` ni desde un `root` local de Nginx. Lo sirve **Express (`central-hub`)** desde `services/central-hub/frontend/dist`, y Nginx solo hace **reverse proxy** hacia el proceso Node.

### Evidencia adicional de directorios observados

**Verificado en runtime:** `/var/www/desarrolloydisenioweb` existe y contiene estáticos con timestamp `2026-02-26`, incluyendo:

- `assets/index-D8BU_pgS.js`
- `assets/index-Ctf07tAo.css`

**Verificado en runtime:** esos artefactos no coinciden con el build más reciente en `services/central-hub/frontend/dist` del `2026-03-24`.

**Inferido:** `/var/www/desarrolloydisenioweb` parece un artefacto histórico de un esquema anterior de publicación, no la fuente efectiva servida hoy en este entorno.

### Respuesta a la pregunta 2

**Sí.** Hay evidencia fuerte de que existe otra carpeta distinta históricamente usada (`/var/www/desarrolloydisenioweb`), pero **no es la carpeta servida hoy** en este entorno actual.

### Respuesta a la pregunta 3

**Para este entorno actual, no hay evidencia de que haga falta copiar `dist/` a otra ubicación para que el cambio se vea.**

Al contrario:

- Nginx activo hoy proxya todo `/` a Express
- Express sirve `frontend/dist` directamente
- el cambio observado después de `npm run build` es consistente con ese modelo

## Hipótesis sobre el problema observado

### Hecho observado

- antes del build, el navegador seguía mostrando copy viejo en `/email/campaigns/new`
- después del build, el navegador mostró copy actualizado
- no hubo evidencia en este tramo de copia manual a `/var/www/...`
- no hubo evidencia en este tramo de cambio de config Nginx

### Hipótesis evaluadas

#### Hipótesis 1 — Cache de navegador

**Inferido:** posible, pero no es la hipótesis principal.

Motivo:

- si el problema hubiera sido solo cache, faltaría una evidencia clara de hard refresh / invalidez de assets como causa única
- además, la observación central es que el cambio apareció inmediatamente después de regenerar el build

#### Hipótesis 2 — Build no regenerado

**Inferido con alta fuerza:** esta es la hipótesis que mejor encaja con la evidencia actual.

Motivo:

- Express sirve `frontend/dist` directamente
- el build reciente actualizó `dist/index.html` y los assets fingerprinted
- el navegador pasó a mostrar el copy nuevo después de regenerar `dist`

#### Hipótesis 3 — Carpeta estática vieja

**Verificado parcialmente:** existe una carpeta estática vieja en `/var/www/desarrolloydisenioweb`.

**Pero inferido:** esa carpeta no explica el comportamiento actual observado, porque Nginx activo hoy no la usa como `root`.

#### Hipótesis 4 — Nginx apuntando a otra ruta

**Verificado en runtime:** sí, Nginx actual no apunta a `root /var/www/...` para frontend. Proxya a Express.

**Conclusión:** esta hipótesis es verdadera como hecho de configuración, pero no como problema. Es parte de la explicación correcta del entorno actual.

### Diagnóstico consolidado del incidente observado

**Conclusión principal:** el comportamiento observado encaja más con **artefacto frontend no regenerado** que con problema de backend.

Clasificación:

- **más probable:** build frontend viejo / no regenerado
- **secundario posible:** cache de navegador
- **menos probable con evidencia actual:** Nginx sirviendo otra carpeta para este entorno actual


## Procedimiento mínimo recomendado

### Procedimiento correcto para este entorno actual

Este procedimiento aplica al entorno actual verificado en esta instancia:

- Nginx actúa como reverse proxy
- `central-hub` sirve el frontend estático desde `services/central-hub/frontend/dist`
- los cambios de frontend no se publican por restart de backend solamente
- el artefacto determinante es el build de Vite

Secuencia mínima recomendada para publicar cambios normales de frontend en este entorno:

1. entrar al directorio del frontend:
   ```bash
   cd ~/leadmaster-workspace/services/central-hub/frontend




**Verificado por runtime + código:** para cambios de frontend, el paso mínimo que hoy parece necesario es:

1. entrar a `services/central-hub/frontend`
2. ejecutar `npm run build`
3. refrescar navegador de forma fuerte si hubiera duda de cache

### Qué no aparece como obligatorio hoy

**No verificado como necesario en este entorno actual:** `reload nginx` para cambios puros de frontend.

Fundamento:

- Nginx no está sirviendo archivos estáticos locales del frontend
- Nginx solo proxya a Express
- Express sirve `frontend/dist` directamente desde disco

**No verificado como necesario en este entorno actual:** copiar `dist/*` a `/var/www/desarrolloydisenioweb/`.

Fundamento:

- esa carpeta existe, pero no hay evidencia de que sea la fuente efectiva servida hoy

**No verificado como necesario en este entorno actual:** restart adicional de `leadmaster-central-hub` para cambios de frontend ya compilados en `dist/`.

**Inferido:** como `express.static` y `sendFile` leen desde disco, un rebuild de `dist/` debería bastar para que los archivos nuevos queden disponibles sin restart, salvo casos especiales de caché o de despliegue parcial.

### Cuándo sí haría falta reload de Nginx

**Inferido y consistente con operación normal:** solo si cambió la config de Nginx, no por un cambio común de copy/componente ya compilado a `dist/`.

### Respuesta a la pregunta 6

**Procedimiento correcto y mínimo para este entorno:**

1. `cd services/central-hub/frontend`
2. `npm run build`
3. hard refresh del navegador o prueba en incógnito si el cambio no aparece al instante

**Solo si se modifica Nginx:** validar config y recargar Nginx.

### Respuesta a la pregunta 7

**Sí, conviene documentar un checklist explícito de deploy frontend.**

Motivo:

- el repositorio contiene evidencia de al menos tres modelos distintos de publicación
- existe documentación previa que habla de copiar a `/var/www/...`
- existe otra que habla de `root .../frontend/dist`
- el runtime actual usa un tercer comportamiento: Nginx proxy a Express, y Express sirve `frontend/dist`

Esa mezcla documental favorece diagnósticos equivocados sobre si el problema está en backend, en Nginx o en el build.

## Riesgos y puntos no verificados

1. **No verificado:** no se probó con trazabilidad HTTP si el navegador estaba recibiendo exactamente el nuevo `index.html` y nuevos assets por cada request después del build.
2. **No verificado:** no se inspeccionaron headers de cache del frontend servido por Express en este entorno.
3. **No verificado:** no se confirmó si existe algún CDN o capa extra de cache por delante del dominio público.
4. **Riesgo documental real:** el repo contiene configuraciones y documentos que describen modelos de publicación distintos entre sí.
5. **Riesgo operativo:** alguien puede seguir copiando a `/var/www/desarrolloydisenioweb/` aunque ese directorio ya no sea la fuente efectiva en este entorno actual.
6. **Riesgo de conclusión incorrecta:** asumir que un restart PM2 del backend actualiza frontend por sí mismo. Con la evidencia actual, el factor determinante para el cambio observado fue el rebuild de `frontend/dist`.

## Respuestas directas

1. **¿`vite build` genera `dist/` y eso coincide con la carpeta que debería servir Nginx?**
   - **Verificado:** `vite build` genera `dist/`.
   - **No coincide con el modelo histórico de `root /var/www/...`, pero sí coincide con el modelo actual donde Express sirve `frontend/dist` y Nginx solo proxya.**

2. **¿Hay evidencia de que Nginx esté apuntando a otra carpeta distinta?**
   - **Sí.** En repo aparece `root /var/www/desarrolloydisenioweb` y también `root /root/leadmaster-central-hub/frontend/dist` en docs históricas.
   - **Pero en runtime actual Nginx no sirve frontend desde carpeta estática; proxya a Express.**

3. **¿Hace falta copiar `dist/` a otra ubicación para producción?**
   - **No hay evidencia de que haga falta en este entorno actual.**
   - **Sí aparece como paso histórico en documentación anterior, pero no como necesidad del runtime actual.**

4. **¿El `nginx.conf` dentro de `frontend/` gobierna este entorno o es artefacto Docker/local?**
   - **Inferido con alta confianza:** es artefacto Docker/local.
   - Usa `root /usr/share/nginx/html` y `proxy_pass http://backend:3011/`, patrón de contenedor Nginx + backend Docker, no del entorno PM2 + system Nginx observado hoy.

5. **¿La actualización observada después del build sugiere cache o artefacto no regenerado?**
   - **Sugiere principalmente artefacto frontend no regenerado.**
   - Cache de navegador queda como factor secundario posible, no como explicación principal.

6. **¿Cuál es el procedimiento correcto y mínimo para que un cambio frontend se vea en este entorno?**
   - `npm run build` en `services/central-hub/frontend`
   - luego hard refresh o incógnito si hubiera duda de cache
   - no hay evidencia actual de que haga falta copiar a `/var/www/...` ni recargar Nginx para cambios normales de frontend

7. **¿Conviene documentar un checklist explícito de deploy frontend?**
   - **Sí.** La evidencia del repo muestra confusión documental real sobre el mecanismo de publicación.
