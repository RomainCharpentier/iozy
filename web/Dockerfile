# --- Étape de build ---
FROM node:24-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Étape de service ---
# nginx sert le build statique ET proxy /api en interne vers le backend
# (voir nginx.conf) - le navigateur ne voit qu'une seule origine, donc pas
# besoin de CORS en prod (contrairement au dev où vite.config.ts joue ce
# rôle de proxy). C'est l'option recommandée dans le TODO de
# backend/src/main/java/com/iozycore/api/config/CorsConfig.java.
FROM nginx:alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
