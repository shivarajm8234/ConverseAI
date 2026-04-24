import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

// ConverseAI — Firebase (hosting + analytics). Client API key is safe to ship in the web app.
const firebaseConfig = {
  

export const firebaseApp = initializeApp(firebaseConfig);

void isSupported()
  .then((yes) => (yes ? getAnalytics(firebaseApp) : null))
  .catch(() => null);
