import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneytracker.app',
  appName: 'Money Tracker',
  webDir: 'out',
  server: {
    // Production: load from Vercel URL
    url: 'https://money-tracker-six-eta.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    scheme: 'Money Tracker',
  },
};

export default config;
