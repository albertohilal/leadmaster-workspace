# Decisiones clave

- Separamos Central Hub y Session Manager como procesos distintos.
- El admin (`cliente_id=1`) es quien se loguea para enviar.
- El cliente verdadero nunca envía mensajes directamente.
- Session Manager expone HTTP con encabezados `X-Cliente-Id`.
- Central Hub valida siempre estado (`READY`) antes de enviar.
- Las variables DRY_RUN se fijan en PM2, no en .env.