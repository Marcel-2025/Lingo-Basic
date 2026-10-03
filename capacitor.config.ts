import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.flondy.lingo',
  appName: 'Lingo Pro',
  webDir: 'out',
  plugins: {
    // Native Google sign-in (Credential Manager) and phone verification (Play Integrity / SMS).
    // skipNativeAuth: the native layer only returns credentials; the session lives in the Firebase JS SDK,
    // so Firestore, token refresh and sign-out behave the same in the browser and in the app.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com', 'phone'],
    },
  },
};

export default config;
