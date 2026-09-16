import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  Smartphone, 
  Download, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  X, 
  ChevronRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileInstallPrompt({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, isAndroid, isNative, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If already installed and running in standalone or native Capacitor mode
  if (isInstalled || isNative) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs font-bold">
          <CheckCircle2 size={16} />
          <span>Installed as Mobile App ({isIOS ? 'iOS' : isAndroid ? 'Android' : 'Mobile'})</span>
        </div>
      );
    }
    return null;
  }

  if (isDismissed && !compact) {
    return null;
  }

  // Compact trigger (for Settings view)
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Install Mobile App</p>
              <p className="text-white/40 text-xs">
                {isIOS ? 'Install on your iPhone / iPad' : 'Install on your Android device'}
              </p>
            </div>
          </div>

          {isInstallable ? (
            <button
              onClick={install}
              className="px-3.5 py-2 bg-accent text-paper font-bold text-xs rounded-xl shadow-md shadow-accent/20 hover:bg-accent/90 transition-all flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>Install</span>
            </button>
          ) : (
            <button
              onClick={() => setShowIOSModal(true)}
              className="px-3.5 py-2 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/15 transition-all flex items-center gap-1.5"
            >
              <span>Guide</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Modal Guide */}
        <IOSAndroidInstallGuide 
          isOpen={showIOSModal} 
          onClose={() => setShowIOSModal(false)} 
          isIOS={isIOS}
          isAndroid={isAndroid}
        />
      </div>
    );
  }

  // Floating or Top Banner for mobile browsers
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 bg-gradient-to-r from-accent/20 via-white/5 to-accent/10 border border-accent/30 rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-accent text-paper rounded-2xl flex items-center justify-center shadow-md shadow-accent/20 shrink-0">
              <Smartphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-sm text-white">
                  Get HabitHub Mobile App
                </span>
                <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold uppercase tracking-wider">
                  {isIOS ? 'iOS' : isAndroid ? 'Android' : 'iOS & Android'}
                </span>
              </div>
              <p className="text-white/60 text-xs mt-0.5">
                Install on your home screen for full-screen view, instant partner updates, and offline speed.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="text-white/30 hover:text-white p-1"
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {isInstallable ? (
            <button
              onClick={install}
              className="flex-1 py-2.5 px-4 bg-accent text-paper font-bold text-xs rounded-xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
            >
              <Download size={15} />
              <span>Install HabitHub</span>
            </button>
          ) : (
            <button
              onClick={() => setShowIOSModal(true)}
              className="flex-1 py-2.5 px-4 bg-accent text-paper font-bold text-xs rounded-xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
            >
              <Download size={15} />
              <span>How to Install on {isIOS ? 'iOS (iPhone)' : isAndroid ? 'Android' : 'Your Phone'}</span>
            </button>
          )}

          <button
            onClick={() => setShowIOSModal(true)}
            className="py-2.5 px-3 bg-white/10 text-white hover:bg-white/15 font-bold text-xs rounded-xl transition-all"
          >
            Instructions
          </button>
        </div>
      </motion.div>

      <IOSAndroidInstallGuide 
        isOpen={showIOSModal} 
        onClose={() => setShowIOSModal(false)} 
        isIOS={isIOS}
        isAndroid={isAndroid}
      />
    </>
  );
}

function IOSAndroidInstallGuide({
  isOpen,
  onClose,
  isIOS,
  isAndroid,
}: {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  isAndroid: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0B2B26] border border-white/20 p-7 rounded-[2.5rem] max-w-sm w-full shadow-2xl space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-accent/20 text-accent flex items-center justify-center">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-lg text-white">Mobile Installation</h4>
                  <p className="text-white/40 text-xs">iOS Safari & Android Chrome</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Instruction Tabs or Steps */}
            <div className="space-y-4 text-left">
              {isIOS || (!isAndroid && !isIOS) ? (
                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-wider">
                    <Sparkles size={14} />
                    <span>For Apple iOS (iPhone & iPad)</span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-white/80 font-medium list-decimal list-inside">
                    <li className="leading-relaxed">
                      Open <strong className="text-white">Safari</strong> on your iPhone.
                    </li>
                    <li className="leading-relaxed flex items-start gap-1.5">
                      <span>Tap the</span>
                      <span className="inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">
                        <Share size={12} /> Share
                      </span>
                      <span>button at the bottom toolbar.</span>
                    </li>
                    <li className="leading-relaxed flex items-start gap-1.5">
                      <span>Scroll down and select</span>
                      <span className="inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded text-accent font-bold">
                        <PlusSquare size={12} /> Add to Home Screen
                      </span>
                    </li>
                    <li className="leading-relaxed">
                      Tap <strong className="text-white">Add</strong> in the top-right corner.
                    </li>
                  </ol>
                </div>
              ) : null}

              {isAndroid || (!isAndroid && !isIOS) ? (
                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 text-teal-300 font-bold text-xs uppercase tracking-wider">
                    <Layers size={14} />
                    <span>For Google Android</span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-white/80 font-medium list-decimal list-inside">
                    <li className="leading-relaxed">
                      Open <strong className="text-white">Chrome</strong> on your Android phone.
                    </li>
                    <li className="leading-relaxed">
                      Tap the <strong className="text-white">three dots menu (⋮)</strong> in the top right.
                    </li>
                    <li className="leading-relaxed">
                      Select <strong className="text-accent">"Install App"</strong> or <strong className="text-accent">"Add to Home screen"</strong>.
                    </li>
                    <li className="leading-relaxed">
                      Confirm installation to add HabitHub to your app drawer.
                    </li>
                  </ol>
                </div>
              ) : null}

              <div className="p-3.5 bg-accent/10 border border-accent/20 rounded-2xl flex items-center gap-3 text-xs text-white/80">
                <CheckCircle2 size={18} className="text-accent shrink-0" />
                <span>Runs full-screen with native app performance and no browser address bar!</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-accent text-paper font-bold text-xs rounded-xl hover:bg-accent/90 shadow-lg shadow-accent/20"
            >
              Got It
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
