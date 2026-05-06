# Deployment & Hosting Guide

This guide covers options for making your website accessible to everyone on the internet.

## Self-Hosting with Docker

If you prefer to run the server yourself (e.g., on a VPS like DigitalOcean, AWS, or your own server), use the Docker setup.

### Prerequisites
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start
Run the following in your terminal:
```bash
docker-compose up -d --build
```
Your app will be available at http://localhost:8080 (or your server's IP).

## Configuration Files Included
- `nginx.conf`: Nginx configuration for Docker/Self-hosting.
- `Dockerfile`: Instructions for building the container.
- `docker-compose.yml`: Simple script to run the container.

### Firebase Google Sign-In on custom domain
If you set Firebase `authDomain` to a custom domain like `1600.now`, your host must route `/__/auth/*` to your Firebase project domain (`https://<project>.firebaseapp.com/__/auth/*`). This repo includes that proxy in `nginx.conf` for Docker/self-hosting.
