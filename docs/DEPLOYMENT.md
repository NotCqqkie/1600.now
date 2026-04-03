# Deployment & Hosting Guide

This guide covers options for making your website accessible to everyone on the internet.

## Option 1: Free Cloud Hosting (Recommended)

The easiest way to host this website for free is using **Vercel** or **Netlify**. Both are free for personal projects and support the configuration files included in this repository.

### **Vercel (Fastest)**
1.  Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2.  Click **"Add New..."** -> **"Project"**.
3.  Import this repository (`1600-prep-hub`).
4.  Vercel will detect it's a Vite project.
5.  Click **Deploy**.
6.  *Done! Your site is live at `https://your-project.vercel.app`.*
    *(Note: The included `vercel.json` ensures routing works correctly).*

### **Netlify**
1.  Go to [netlify.com](https://netlify.com) and sign up with GitHub.
2.  Click **"Add new site"** -> **"Import an existing project"**.
3.  Select GitHub and choose this repository.
4.  Click **Deploy**.
5.  *Done! Your site is live at `https://your-project.netlify.app`.*
    *(Note: The included `netlify.toml` ensures routing works correctly).*

---

## Option 2: Self-Hosting with Docker

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
- `vercel.json`: Handles routing for Vercel.
- `netlify.toml`: Handles routing for Netlify.
- `nginx.conf`: Nginx configuration for Docker/Self-hosting.
- `Dockerfile`: Instructions for building the container.
- `docker-compose.yml`: Simple script to run the container.

### Firebase Google Sign-In on custom domain
If you set Firebase `authDomain` to a custom domain like `1600.now`, your host must route `/__/auth/*` to your Firebase project domain (`https://<project>.firebaseapp.com/__/auth/*`). This repo includes that proxy in `nginx.conf` for Docker/self-hosting.
