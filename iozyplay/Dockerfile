# IozyPlay en un seul conteneur : le serveur Node sert le front construit,
# l'API et Socket.IO sous un même préfixe (/play par défaut), pour vivre à
# côté d'IozyCore derrière son nginx (voir backend/docker-compose.nas.yml).
# Le préfixe se change à la construction (--build-arg IOZYPLAY_BASE_PATH=...) :
# le front est compilé avec, le serveur le lit à l'exécution, les deux
# restent d'accord.
#
# Construit depuis la RACINE du dépôt (compose : context `..`, workflow :
# context `.`) : la charte IozyKit est le dossier voisin `iozykit/`, lié par
# node_modules (`file:../iozykit` dans package.json).

# --- Construction du front ---
FROM node:22-alpine AS build
WORKDIR /build/iozyplay
ARG IOZYPLAY_BASE_PATH=/play
ENV IOZYPLAY_BASE_PATH=$IOZYPLAY_BASE_PATH
COPY iozykit /build/iozykit
COPY iozyplay/package.json iozyplay/package-lock.json ./
RUN npm ci
COPY iozyplay/ ./
RUN npm run build

# --- Exécution ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY iozyplay/package.json iozyplay/package-lock.json ./
RUN npm ci --omit=dev
COPY iozyplay/server ./server
# Le jeu de données livré ; sur le NAS, un volume monté sur /app/data le
# reprend au premier démarrage puis garde les questions ajoutées.
COPY iozyplay/data ./data
COPY --from=build /build/iozyplay/dist ./dist
ARG IOZYPLAY_BASE_PATH=/play
ENV IOZYPLAY_BASE_PATH=$IOZYPLAY_BASE_PATH \
    IOZYPLAY_STATIC_DIR=/app/dist \
    PORT=3001
EXPOSE 3001
CMD ["node", "server/index.js"]
