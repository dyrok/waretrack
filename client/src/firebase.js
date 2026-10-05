// Google sign-in with the Firebase web SDK.
//
// These values are NOT secrets. A Firebase web config identifies the project
// in public; what protects the account is the Authorized domains list in the
// Firebase console plus the token check on the server. The real secret is the
// service-account key, and that one only ever lives on the server.
//
// The SDK is imported lazily so a build with no Firebase configured still
// loads the console and still offers email sign-in.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Hide the Google button unless the build actually has a project to talk to.
export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId);

let authPromise = null;
const getFirebaseAuth = () => {
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth } = await import("firebase/auth");
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
      return getAuth(app);
    })();
  }
  return authPromise;
};

// Opens the Google popup and returns the Firebase ID token.
// The server swaps that token for one of our own JWTs.
export const signInWithGoogle = async () => {
  const auth = await getFirebaseAuth();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user.getIdToken();
};

// Firebase keeps its own session in browser storage. Our sign-out clears the
// JWT, so clear the Firebase side too or the next popup silently reuses the
// previous Google account.
export const signOutOfGoogle = async () => {
  if (!firebaseEnabled || !authPromise) return;
  const auth = await getFirebaseAuth();
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
};
