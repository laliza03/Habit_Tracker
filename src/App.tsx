import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from './types';
import MobileInstallPrompt from './components/MobileInstallPrompt';
import { Layout, LogIn, Activity, Target, Users, Settings as SettingsIcon, LogOut, AlertCircle, Smartphone, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Goals = lazy(() => import('./components/Goals'));
const Partner = lazy(() => import('./components/Partner'));
const Settings = lazy(() => import('./components/Settings'));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('habithub_active_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [showSlowWarning, setShowSlowWarning] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'goals' | 'partner' | 'settings'>('dashboard');

  const unsubPublicRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Show recovery options if loading takes longer than 1.5 seconds
    const slowTimer = setTimeout(() => {
      setShowSlowWarning(true);
    }, 1500);

    // Hard fallback: force loading to false after 2.5 seconds max
    const hardTimeout = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // Clean up previous snapshot listeners
      if (unsubPublicRef.current) {
        unsubPublicRef.current();
        unsubPublicRef.current = null;
      }

      if (!u) {
        // If there is no stored guest/active profile, clear it
        if (!localStorage.getItem('habithub_active_profile')) {
          setProfile(null);
        }
        setLoading(false);
        return;
      }

      // 1. Create immediate local fallback profile so the user is NEVER stuck waiting
      const defaultProfile: UserProfile = {
        uid: u.uid,
        displayName: u.displayName || 'User',
        email: u.email || '',
        photoURL: u.photoURL || '',
        calorieGoal: 2000,
        stepGoal: 10000,
        waterGoal: 2000,
        supplements: ['creatine', 'biotin', 'omega', 'magnesium'],
      };
      setProfile(defaultProfile);
      try {
        localStorage.setItem('habithub_active_profile', JSON.stringify(defaultProfile));
      } catch {}

      try {
        // 2. Fetch public profile from Firestore
        const userDocRef = doc(db, 'users', u.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const merged = {
            ...defaultProfile,
            ...userDoc.data(),
          } as UserProfile;
          setProfile(merged);
          try {
            localStorage.setItem('habithub_active_profile', JSON.stringify(merged));
          } catch {}
        } else {
          // Initialize new profile in Firestore
          const { email, ...publicProfile } = defaultProfile;
          await setDoc(userDocRef, publicProfile);
          try {
            await setDoc(doc(db, 'user_private', u.uid), { email: u.email || '' });
          } catch (e) {
            console.warn('Could not write private profile', e);
          }
        }

        // Update email to UID mapping for partner linking (non-blocking)
        if (u.email) {
          setDoc(doc(db, 'email_to_uid', u.email.toLowerCase()), { uid: u.uid }).catch(() => {});
        }

        // 3. Attach real-time listeners for profile updates
        unsubPublicRef.current = onSnapshot(doc(db, 'users', u.uid), (snapshot) => {
          if (snapshot.exists()) {
            setProfile(prev => {
              const updated = { ...(prev || defaultProfile), ...snapshot.data() } as UserProfile;
              try {
                localStorage.setItem('habithub_active_profile', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        }, (err) => {
          console.warn('Realtime public profile sync warning:', err);
        });

      } catch (error) {
        console.warn('Error loading profile from Firestore, using default profile:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(hardTimeout);
      unsubscribeAuth();
      if (unsubPublicRef.current) unsubPublicRef.current();
    };
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error?.code === 'auth/popup-blocked') {
        setLoginError('Sign-in popup was blocked by the browser. Open in a new tab or continue as Guest.');
      } else if (error?.code === 'auth/cancelled-popup-request') {
        setLoginError('Sign-in request was cancelled. Try again or continue as Guest.');
      } else {
        setLoginError(error?.message || 'Failed to sign in. You can continue as Guest to use the app right away.');
      }
    }
  };

  const handleGuestLogin = () => {
    const guestId = localStorage.getItem('habithub_guest_id') || `guest_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('habithub_guest_id', guestId);
    
    const guestProfile: UserProfile = {
      uid: guestId,
      displayName: 'Partner Explorer',
      email: 'guest@habithub.app',
      calorieGoal: 2000,
      stepGoal: 10000,
      waterGoal: 2000,
      supplements: ['creatine', 'biotin', 'omega', 'magnesium'],
    };

    setProfile(guestProfile);
    try {
      localStorage.setItem('habithub_active_profile', JSON.stringify(guestProfile));
    } catch {}
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('habithub_active_profile');
    setProfile(null);
    setUser(null);
    signOut(auth).catch(() => {});
  };

  const handleProfileChange = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    try {
      localStorage.setItem('habithub_active_profile', JSON.stringify(updatedProfile));
    } catch {}
  };

  const currentProfile: UserProfile | null = profile || (user ? {
    uid: user.uid,
    displayName: user.displayName || 'User',
    email: user.email || '',
    photoURL: user.photoURL || '',
    calorieGoal: 2000,
    stepGoal: 10000,
    waterGoal: 2000,
  } : null);

  if (loading && !profile && !user) {
    return (
      <div className="min-h-screen bg-[#0B2B26] flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="text-accent mb-6"
        >
          <Activity size={52} />
        </motion.div>

        <p className="text-white/70 font-medium text-sm">Loading HabitHub...</p>

        {showSlowWarning && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-xs w-full bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3"
          >
            <p className="text-xs text-white/50">
              Taking longer than expected?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleGuestLogin}
                className="flex-1 py-2.5 px-3 bg-accent text-paper font-bold text-xs rounded-xl hover:bg-accent/90 transition-all active:scale-95"
              >
                Instant Access
              </button>
              <button
                onClick={() => window.location.reload()}
                className="py-2.5 px-3 bg-white/10 text-white font-medium text-xs rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-1 active:scale-95"
                title="Reload page"
              >
                <RotateCcw size={13} />
                <span>Reload</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10"
        >
          <div className="w-20 h-20 bg-accent text-paper rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-accent/30">
            <Activity size={40} />
          </div>
          <h1 className="text-4xl font-serif font-bold text-white mb-3 tracking-tight">HabitHub</h1>
          <p className="text-white/50 mb-8 font-medium text-sm sm:text-base">
            Track healthy habits together with your partner and reach your daily goals.
          </p>

          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs text-left space-y-2"
            >
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle size={15} />
                <span>Sign-In Notice</span>
              </div>
              <p>{loginError}</p>
            </motion.div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-accent text-paper py-4 rounded-2xl font-bold hover:bg-accent/90 transition-all active:scale-[0.98] shadow-lg shadow-accent/20"
            >
              <LogIn size={20} />
              <span>Sign In with Google</span>
            </button>

            <button
              onClick={handleGuestLogin}
              className="w-full flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-white/15 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] border border-white/10"
            >
              <span>Instant Guest Mode</span>
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-white/40 text-xs font-medium">
            <Smartphone size={14} className="text-accent" />
            <span>Mobile-ready for iOS & Android</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-36">
      <header className="bg-paper/80 border-b border-white/10 sticky top-0 z-30 backdrop-blur-xl safe-top">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-accent to-pink-300 text-paper rounded-2xl flex items-center justify-center shadow-lg shadow-accent/25 shrink-0">
              <Activity size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <span className="font-serif font-extrabold text-2xl tracking-tight text-white block leading-none">HabitHub</span>
              <span className="text-[9px] font-bold text-accent uppercase tracking-widest mt-0.5 block">Fitness & Duo Habits</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentProfile?.photoURL ? (
              <img 
                src={currentProfile.photoURL} 
                alt="Profile" 
                className="w-9 h-9 rounded-full border-2 border-accent/40 shadow-sm object-cover" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 border border-white/15 text-xs font-bold">
                {currentProfile?.displayName ? currentProfile.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <button 
              onClick={handleLogout} 
              className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-xl"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 sm:px-8 py-6 sm:py-8">
        <MobileInstallPrompt />
        <Suspense fallback={<PageLoading />}>
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Dashboard profile={currentProfile} />
            </motion.div>
          )}
          {activeTab === 'goals' && (
            <motion.div 
              key="goals" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Goals profile={currentProfile} />
            </motion.div>
          )}
          {activeTab === 'partner' && (
            <motion.div 
              key="partner" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Partner profile={currentProfile} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div 
              key="settings" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Settings profile={currentProfile} onProfileChange={handleProfileChange} />
            </motion.div>
          )}
        </AnimatePresence>
        </Suspense>
      </main>

      <nav className="fixed safe-nav-bottom left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-black/60 backdrop-blur-2xl px-3 py-2.5 rounded-[2.5rem] shadow-2xl shadow-black/60 border border-white/10 z-40">
        <div className="flex items-center justify-around">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={20} />} label="Daily" />
          <NavButton active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon={<Target size={20} />} label="Goals" />
          <NavButton active={activeTab === 'partner'} onClick={() => setActiveTab('partner')} icon={<Users size={20} />} label="Partner" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={20} />} label="Settings" />
        </div>
      </nav>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm font-medium text-white/50">
      Loading your habits…
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 rounded-2xl flex flex-col items-center gap-1 transition-all duration-200 active:scale-95 ${
        active 
          ? 'text-paper bg-accent font-extrabold shadow-lg shadow-accent/25' 
          : 'text-white/45 hover:text-white/90 hover:bg-white/5 font-semibold'
      }`}
    >
      {icon}
      <span className="text-[11px] tracking-tight">{label}</span>
    </button>
  );
}
