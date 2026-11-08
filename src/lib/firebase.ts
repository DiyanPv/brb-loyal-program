import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCgp5VRBJgqVVv-wU6EBBAGmEHzqCXltd4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "loyalty-program-d3f96.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "loyalty-program-d3f96",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "loyalty-program-d3f96.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "170441487708",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:170441487708:web:9f9637be0e18c49ad37d99",
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('your-api-key')
  );
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
