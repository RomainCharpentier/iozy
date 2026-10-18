# Built from the REPOSITORY ROOT (compose: context `../..`, workflow: context
# `.`), because the IozyKit charter lives there (`iozykit/`), linked through
# node_modules (`file:../../iozykit` in package.json).

# --- Build step ---
FROM node:24-alpine AS build
WORKDIR /build/iozycore/web

# Where the app lives on the site: /core/, because the root is the home
# home page of the site and /play is IozyPlay (see nginx.conf). Dev and the e2e stack stay at
# the root; an empty ARG would serve the app alone at the root.
ARG IOZYCORE_BASE_PATH=/core
ENV IOZYCORE_BASE_PATH=$IOZYCORE_BASE_PATH

# The release number is fixed AT BUILD TIME: the bundle is a static file, so it
# cannot ask for it later. `VITE_` is the prefix Vite requires for an
# environment variable to cross the build boundary.
#
# It is used to detect the case where the interface and the server do not come
# from the same release - a service worker that keeps the old shell, or one
# image out of two that was not pulled. Without it, the app would show the
# SERVER version and pass it off as its own.
ARG VERSION=dev
ENV VITE_VERSION=$VERSION

# The charter first: `npm ci` links it from ../../iozykit.
COPY iozykit /build/iozykit
COPY iozycore/web/package.json iozycore/web/package-lock.json ./
RUN npm ci
COPY iozycore/web/ ./
RUN npm run build

# --- Serving step ---
# nginx serves the static build AND proxies /api internally to the backend
# (see nginx.conf) - the browser sees only one origin, so no CORS is needed
# in prod (unlike dev, where vite.config.ts plays this proxy role). This is
# the option recommended in the TODO of
# backend/src/main/java/com/iozycore/api/config/CorsConfig.java.
FROM nginx:alpine
# The build goes under /core so that files and URLs match; the home of the
# page, built with it, is served at / by nginx (see nginx.conf).
COPY --from=build /build/iozycore/web/dist /usr/share/nginx/html/core
COPY iozycore/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
