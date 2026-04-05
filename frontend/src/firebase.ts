import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyADkh4O5kElf0ngfiIP8msA2N4QlTkxw54",
  authDomain: "voiceai-19830.firebaseapp.com",
  projectId: "voiceai-19830",
  storageBucket: "voiceai-19830.firebasestorage.app",
  messagingSenderId: "643775655393",
  appId: "1:643775655393:web:7c2f0904fc761a2a3236a0",
  measurementId: "G-ZZMNVBJ1VR"
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export default app;
