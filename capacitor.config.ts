import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pos.kuwait',
  appName: 'POS Kuwait',
  webDir: 'dist/renderer',
  android: {
    backgroundColor: '#0f172a',
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
