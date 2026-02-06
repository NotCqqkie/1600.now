# Firebase Setup

## 1) Enable Authentication
- Open Firebase Console -> your project -> Authentication -> Sign-in method.
- Enable `Email/Password`.
- Enable `Google`.

## 2) Add Authorized Domains
- In Authentication -> Settings -> Authorized domains, add each domain you use:
- `localhost`
- your production domain (for example `1600.now`)
- your preview/staging domain(s)

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
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```
