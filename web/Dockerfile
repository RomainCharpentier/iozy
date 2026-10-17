# --- Build step ---
FROM node:24-alpine AS build
WORKDIR /build

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

# The IozyKit charter is a git dependency (`iozykit` in package.json). This
# image has no git on purpose: with the commit pinned in package-lock.json,
# npm downloads the GitHub tarball of that commit and never runs git. If that
# download ever fails, npm falls back to a clone, and the fix is then
# `RUN apk add --no-cache git` before this step.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serving step ---
# nginx serves the static build AND proxies /api internally to the backend
# (see nginx.conf) - the browser sees only one origin, so no CORS is needed
# in prod (unlike dev, where vite.config.ts plays this proxy role). This is
# the option recommended in the TODO of
# backend/src/main/java/com/iozycore/api/config/CorsConfig.java.
FROM nginx:alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
