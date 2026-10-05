# Firebase setup — where to get the env vars

WareTrack uses Firebase for two things, both optional in development:

1. **Firebase login** (`POST /api/auth/firebase`) — verifies an ID token from a mobile app
2. **Push notifications** (`PUSH_DRIVER=fcm`) — sends through Firebase Cloud Messaging

Everything comes from the [Firebase console](https://console.firebase.google.com). You need a
Google account. All steps below are in that console.

## 1. Create the project (once)

1. Open <https://console.firebase.google.com> → **Add project**.
2. Name it (e.g. `waretrack`) → continue. Analytics is optional → **Create project**.

## 2. Web app config (client-side env vars)

Needed if the console or a mobile/web app signs in with Firebase. The server itself does not
need these.

1. **Project settings** (gear icon, top-left) → **General** tab → *Your apps*.
2. Click the **Web** icon (`</>`), give the app a nickname, **Register app**.
3. Skip "Add Firebase Hosting" → **Continue to console**.
4. Under *SDK setup and configuration*, choose **Config**. You get an object like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "waretrack.firebaseapp.com",
     projectId: "waretrack",
     storageBucket: "waretrack.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc…",
   };
   ```

Map each key to a Vite env var (e.g. in `.env` for the React console):

| firebaseConfig key      | Env var                        |
| ----------------------- | ------------------------------ |
| `apiKey`                | `VITE_FIREBASE_API_KEY`        |
| `authDomain`            | `VITE_FIREBASE_AUTH_DOMAIN`    |
| `projectId`             | `VITE_FIREBASE_PROJECT_ID`     |
| `storageBucket`         | `VITE_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId`     | `VITE_FIREBASE_SENDER_ID`      |
| `appId`                 | `VITE_FIREBASE_APP_ID`         |

These values are public identifiers (they ship in the bundle) — access is controlled by
Firebase Auth and security rules, not by hiding them.

## 3. Enable sign-in methods (for Firebase login)

1. **Build** → **Authentication** → **Get started** → **Sign-in method** tab.
2. Enable **Email/Password** (and e.g. **Google** if you want social login) → **Save**.
3. Users created there (or via your mobile app) can then call `POST /api/auth/firebase`
   with their Firebase ID token.

## 4. Service account JSON (the server's env var)

Needed for **Firebase login verification** and for **`PUSH_DRIVER=fcm`**. This one is a
**secret** — anyone holding it can send pushes and read your Firebase project.

1. **Project settings** → **Service accounts** tab (*Firebase Admin SDK*).
2. Click **Generate new private key** → **Generate key**. A `<project>-firebase-adminsdk-….json`
   file downloads.
3. Move it **outside the repository** (e.g. `~/.firebase/waretrack-fcm.json`) so it can never
   be committed. `chmod 600` it for good measure.
4. In `.env` set the **absolute** path:

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/Users/you/.firebase/waretrack-fcm.json
   PUSH_DRIVER=fcm
   ```

If the variable is empty, the backend uses `applicationDefault()` credentials (works on
Google Cloud / Cloud Run without a file) and `PUSH_DRIVER=log` needs no Firebase at all.

**On Render:** the file system is ephemeral. Paste the whole JSON into a *Secret File*
(Render dashboard → Environment → Secret Files) and point `GOOGLE_APPLICATION_CREDENTIALS`
at its mount path (e.g. `/etc/secrets/waretrack-fcm.json`).

## 4b. Google sign-in in the React console

The console has a **Continue with Google** button. It renders only when the four
`VITE_FIREBASE_*` variables from step 2 are present at **build** time, so a build without
them silently falls back to email and password.

The flow: Firebase shows the Google popup, the browser gets a Firebase **ID token**, the
console posts it to `POST /api/auth/firebase`, the server verifies it with `firebase-admin`
and returns a WareTrack JWT. Every protected route still checks only the WareTrack token,
so Firebase is the identity provider and never the session.

A new Google user is created with the **staff** role. Promote them from the Team screen as a
manager.

Two things break the popup if you skip them:

1. **Authentication → Sign-in method → Google** must be enabled.
2. **Authentication → Settings → Authorized domains** must list every host the console is
   served from, including the deployed one (e.g. `waretrack-iota.vercel.app`). `localhost`
   is there by default.

## 4c. On Vercel: the key goes in an env var, not a file

Vercel has no persistent disk, so `GOOGLE_APPLICATION_CREDENTIALS` (a *path*) cannot work.
Put the whole service-account JSON into `FIREBASE_SERVICE_ACCOUNT` instead — `app.js` prefers
it when present and calls `cert(JSON.parse(...))`:

```bash
vercel env add FIREBASE_SERVICE_ACCOUNT production < ~/.firebase/waretrack-adminsdk.json
```

The `VITE_FIREBASE_*` variables are read during the build, so after changing any of them you
must **redeploy** — editing them alone does not update the already-built bundle.

## 5. Cloud Messaging (push)

FCM is enabled by default for new projects — no extra env vars. Only the service account
above authenticates sends. To target a device, the app registers its FCM token and sends it
to the API (`POST /api/notifications/send` with `token`); topic sends use `topic`
(default `all-staff`).

## Quick check

```bash
PUSH_DRIVER=fcm node -e "
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
initializeApp({ credential: applicationDefault() });
getMessaging().send({ topic: 'all-staff', notification: { title: 'test', body: 'it works' } })
  .then((id) => console.log('sent', id)).catch((e) => console.error(e.message));
"
```

If you see `sent …`, the credentials and messaging are wired correctly.

**Never commit** the service-account JSON. Rotate it immediately in
*Service accounts → … → Manage keys* if it ever leaks.
