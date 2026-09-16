import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [platformName, setPlatformName] = useState<'ios' | 'android' | 'web'>('web');

  useEffect(() => {
    // 1. Check if running inside Capacitor native iOS/Android shell
    const isCapacitorNative = Capacitor.isNativePlatform();
    setIsNative(isCapacitorNative);

    // 2. Detect standalone display mode (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      isCapacitorNative;
    setIsInstalled(isStandalone);

    // 3. Detect operating system platform
    const userAgent = (window.navigator.userAgent || '').toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    if (isCapacitorNative) {
      setPlatformName(Capacitor.getPlatform() === 'ios' ? 'ios' : 'android');
    } else if (isIOSDevice) {
      setPlatformName('ios');
    } else if (isAndroidDevice) {
      setPlatformName('android');
    } else {
      setPlatformName('web');
    }

    // 4. Android / Chromium PWA install prompt handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isNative,
    platformName,
    install,
  };
}
