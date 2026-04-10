# Firebase Setup

## 1) Enable Authentication
- Open Firebase Console -> your project -> Authentication -> Sign-in method.
- Enable `Email/Password`.
- Enable `Google`.

## 2) Add Authorized Domains
- In Authentication -> Settings -> Authorized domains, add each domain you use:
- `localhost`
- your production domain (for example `1600.now`)
- your auth subdomain (for example `auth.1600.now`)
- your preview/staging domain(s)
- If you use an auth subdomain, connect that subdomain in Firebase Hosting so `https://auth.your-domain.com/__/auth/handler` and its scripts are served by Firebase.

## 3) Create Firestore
- Open Firestore Database -> Create database.
- Start in production or test mode (your choice).
- Region: choose the region closest to your users.

## 4) Firestore Rules (minimum needed for this app)
- Use rules that only allow each user to read/write their own progress doc:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /user_progress/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 5) Web App Config
- Firebase Console -> Project settings -> General -> Your apps -> Web app.
- Copy values into `.env`:

```txt
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_AUTH_DOMAIN_LOCAL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Custom authDomain example

```txt
VITE_FIREBASE_AUTH_DOMAIN=auth.1600.now
VITE_FIREBASE_AUTH_DOMAIN_LOCAL=now-483609.firebaseapp.com
```

Use `VITE_FIREBASE_AUTH_DOMAIN_LOCAL` for localhost/dev so Google sign-in works without depending on your production auth subdomain setup.

## 6) Google OAuth Client (Google Cloud)
- Google Cloud Console -> Google Auth Platform -> Clients -> your Web client.
- Authorized JavaScript origins:
  - `https://1600.now`
  - `https://auth.1600.now`
  - `http://localhost:8080`
  - `http://localhost:8081`
- Authorized redirect URI:
  - `https://auth.1600.now/__/auth/handler`
