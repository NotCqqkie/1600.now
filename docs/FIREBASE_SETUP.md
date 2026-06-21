# Firebase Setup

## 1) Enable Authentication
- Open Firebase Console -> your project -> Authentication -> Sign-in method.
- Enable `Email/Password`.
- Enable `Google`.
- In Authentication -> Settings -> Password policy, require at least `8` characters and at least `1` number.
- In Authentication -> Settings -> User actions, keep email enumeration protection enabled if available for the project.
- Keep Firebase Auth's abuse protection enabled. The client adds a local throttle, but production throttling must be enforced by Firebase because the public web API can be called directly.

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
- Deploy `firestore.rules` from this repo. Admin access depends on a Firebase custom claim:

```js
await admin.auth().setCustomUserClaims("<ADMIN_UID>", { admin: true });
```

- Do not grant admin access by email address. A deleted-and-recreated account with the same email must not become admin.

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

## 7) Verification Email Deliverability
- Firebase Console -> Authentication -> Templates:
  - Set the public-facing sender name to `1600.now`.
  - Edit the verification and password-reset templates so the subject and first line clearly mention `1600.now`.
  - Avoid marketing language, all-caps copy, link shorteners, or multiple external links.
- Firebase Console -> Authentication -> Settings -> Authorized domains:
  - Keep `1600.now` authorized.
  - If you use branded Firebase action links, add and verify the same Firebase Hosting domain you set as `VITE_FIREBASE_AUTH_LINK_DOMAIN`.
- Recommended production env:

```txt
VITE_FIREBASE_AUTH_DOMAIN=auth.1600.now
VITE_FIREBASE_AUTH_LINK_DOMAIN=auth.1600.now
```

The app passes Firebase action-code settings for verification and password-reset emails so links continue back to `https://1600.now/verify-email` or `https://1600.now/login`. Inbox placement still depends on the Firebase template, sender reputation, and the configured action-link domain.
