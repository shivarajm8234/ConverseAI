import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

// ConverseAI — Firebase (hosting + analytics). Client API key is safe to ship in the web app.
const firebaseConfig = {
  apiKey: 'AIzaSyCNlOFWJH81uQzGcrIBnBjwcUHrL-EtrnE',
  authDomain: 'converseaii.firebaseapp.com',
  projectId: 'converseaii',
  storageBucket: 'converseaii.firebasestorage.app',
  messagingSenderId: '911059861364',
  appId: '1:911059861364:web:3167068a0715bde380b621',
  measurementId: 'G-SSZQBC4XJH',
};

export const firebaseApp = initializeApp(firebaseConfig);

void isSupported()
  .then((yes) => (yes ? getAnalytics(firebaseApp) : null))
  .catch(() => null);
