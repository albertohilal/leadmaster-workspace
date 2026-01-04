# Dockerfile para LeadMaster Central Hub
FROM node:20-alpine

# Variables de entorno para producción
ENV NODE_ENV=production
ENV PORT=3011

# Crear directorio de aplicación
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY src/ ./src/
COPY .env.example ./.env

# Exponer puerto
EXPOSE 3011

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3011/health || exit 1

# Comando de inicio
CMD ["node", "src/index.js"]