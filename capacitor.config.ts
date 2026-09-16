import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.habithub.app',
  appName: 'HabitHub',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
