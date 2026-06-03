# Dev stage — Vite dev server with hot reload
FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Builder stage — produces dist/ for production
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Prod stage — Nginx (unprivileged, runs as non-root on port 8080) serving static files
FROM nginxinc/nginx-unprivileged:alpine AS prod
LABEL org.opencontainers.image.source=https://github.com/kavindujayarathne/pulsecheck
USER root
RUN apk add --no-cache curl
USER nginx
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
