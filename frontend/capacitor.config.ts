import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.expensetracker.app',
  appName: 'Expense Tracker',
  webDir: 'www',
  server: {
    // Use Vercel URL for proper OAuth handling
    url: 'https://expense-tracker-delta-ashy.vercel.app',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f0f23',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#14b8a6'
    },
    StatusBar: {
      backgroundColor: '#0f0f23',
      style: 'DARK'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  android: {
    backgroundColor: '#0f0f23',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    backgroundColor: '#0f0f23',
    contentInset: 'automatic',
    scrollEnabled: true
  }
};

export default config;
