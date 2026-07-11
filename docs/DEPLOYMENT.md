# Deployment & Hosting Guide

This guide covers options for making your website accessible to everyone on the internet.

## Self-Hosting with Docker

If you prefer to run the server yourself (e.g., on a VPS like DigitalOcean, AWS, or your own server), use the Docker setup.

### Prerequisites
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start
Copy the public Vite build configuration and fill in the required Firebase and
App Check values before building:

```bash
cp .env.example .env
docker compose up -d --build
```

The app is available at `http://127.0.0.1:8080`. Set `APP_PORT` in `.env` to
change the host port. Docker Compose intentionally binds only to loopback.

### Public TLS Reverse Proxy

Public deployments must terminate TLS in a reverse proxy and forward requests
to `127.0.0.1:8080`. Do not expose the container's HTTP port directly. The
proxy must redirect HTTP to HTTPS and preserve the original `Host` and
`X-Forwarded-Proto` headers. For example, a Caddy site block can be:

```caddyfile
1600.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Add the public HTTPS domain to Firebase Authentication's authorized domains and
set `VITE_FIREBASE_AUTH_DOMAIN` to that domain before building.

## Configuration Files Included
- `nginx.conf`: Nginx configuration for Docker/Self-hosting.
- `Dockerfile`: Instructions for building the container.
- `docker-compose.yml`: Simple script to run the container.

### Firebase Google Sign-In on custom domain
If you set Firebase `authDomain` to a custom domain like `1600.now`, your host must route `/__/auth/*` to your Firebase project domain (`https://<project>.firebaseapp.com/__/auth/*`). This repo includes that proxy in `nginx.conf` for Docker/self-hosting.
