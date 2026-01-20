# Operación con PM2

Central Hub y Session Manager corren bajo PM2:

## Levantar Central Hub

pm2 start ecosystem.config.js

shell
Copiar código

## Levantar Session Manager

pm2 start ecosystem.config.cjs

shell
Copiar código

## Persistir estado

pm2 save

shell
Copiar código

## Startup en reboot

pm2 startup