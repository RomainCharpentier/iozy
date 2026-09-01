# --- Étape de build ---
FROM node:24-alpine AS build
WORKDIR /build

# Le numéro de livraison est figé À LA COMPILATION : le bundle est un fichier
# statique, il ne peut pas le demander plus tard. `VITE_` est le préfixe
# qu'exige Vite pour qu'une variable d'environnement franchisse la frontière
# du build.
#
# Elle sert à repérer le cas où l'interface et le serveur ne viennent pas de la
# même livraison - un service worker qui garde l'ancienne coquille, une image
# sur deux qui n'a pas été tirée. Sans elle, l'app afficherait la version du
# SERVEUR en la faisant passer pour la sienne.
ARG VERSION=dev
ENV VITE_VERSION=$VERSION

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
