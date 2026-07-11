# check=skip=SecretsUsedInArgOrEnv

# Stage 1: Build the application
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder

WORKDIR /app

# Chromium for the puppeteer-driven prerender step. Alpine's musl libc cannot
# run Google's bundled Chrome, so use the distro Chromium and skip the download.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PRERENDER_NO_SANDBOX=1

# Copy package files
COPY package.json package-lock.json ./

# Install the exact dependency graph from package-lock.json
RUN npm ci

# Copy source code
COPY . .

# Declare build-time args (DigitalOcean passes "Build time" env vars as --build-arg)
ARG VITE_FIREBASE_API_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_AUTH_LINK_DOMAIN
ARG VITE_FIREBASE_AUTH_DOMAIN_LOCAL
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_DESMOS_API_KEY
ARG VITE_USE_FIREBASE_EMULATORS=false

# Expose args as env vars so Vite can read them during the build
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_AUTH_LINK_DOMAIN=$VITE_FIREBASE_AUTH_LINK_DOMAIN
ENV VITE_FIREBASE_AUTH_DOMAIN_LOCAL=$VITE_FIREBASE_AUTH_DOMAIN_LOCAL
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY
ENV VITE_DESMOS_API_KEY=$VITE_DESMOS_API_KEY
ENV VITE_USE_FIREBASE_EMULATORS=$VITE_USE_FIREBASE_EMULATORS

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine@sha256:54f2a904c251d5a34adf545a72d32515a15e08418dae0266e23be2e18c66fefa

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
