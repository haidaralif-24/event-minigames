import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, signInAnonymously } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const authPersistenceReady = setPersistence(auth, browserSessionPersistence).catch(() => {});

export async function ensureAnonymousAuth() {
  try {
    await authPersistenceReady;
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return auth.currentUser;
  } catch (error) {
    console.warn('Anonymous auth was skipped or is disabled in Firebase console.', error);
    return null;
  }
}
