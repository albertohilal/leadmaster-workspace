# Dockerfile para Frontend LeadMaster
FROM node:20-alpine as build

# Directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build para producción
RUN npm run build

# Etapa de producción con nginx
FROM nginx:alpine

# Copiar archivos build
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto
EXPOSE 80

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]