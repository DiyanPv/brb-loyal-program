import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCgp5VRBJgqVVv-wU6EBBAGmEHzqCXltd4",
  authDomain: "loyalty-program-d3f96.firebaseapp.com",
  projectId: "loyalty-program-d3f96",
  storageBucket: "loyalty-program-d3f96.firebasestorage.app",
  messagingSenderId: "170441487708",
  appId: "1:170441487708:web:9f9637be0e18c49ad37d99"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
