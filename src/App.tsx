import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { UserProfile } from './types';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import Partner from './components/Partner';
import Settings from './components/Settings';
import { Layout, LogIn, Activity, Target, Users, Settings as SettingsIcon, LogOut, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'goals' | 'partner' | 'settings'>('dashboard');

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const path = `users/${u.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'User',
              email: u.email || '',
              photoURL: u.photoURL || '',
              calorieGoal: 2000,
              stepGoal: 10000,
              waterGoal: 2000,
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }

        // Real-time profile updates
        onSnapshot(doc(db, 'users', u.uid), (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, path);
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-[#0B2B26] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-accent"
        >
          <Activity size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white/5 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10"
        >
          <div className="w-20 h-20 bg-accent text-paper rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-accent/30">
            <Activity size={40} />
          </div>
          <h1 className="text-4xl font-serif font-bold text-white mb-4 tracking-tight">HabitHub</h1>
          <p className="text-white/40 mb-10 font-medium">Track healthy habits together with your partner and reach your goals.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-4 bg-accent text-paper py-5 rounded-2xl font-bold hover:bg-accent/90 transition-all active:scale-[0.98] shadow-lg shadow-accent/20"
          >
            <LogIn size={22} />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-32">
      <header className="bg-paper/80 border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-md mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent text-paper rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
              <Activity size={20} />
            </div>
            <span className="font-serif font-bold text-2xl tracking-tight text-white">HabitHub</span>
          </div>
          <div className="flex items-center gap-5">
            {profile?.photoURL && (
              <img 
                src={profile.photoURL} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border-2 border-white/10 shadow-sm" 
                referrerPolicy="no-referrer" 
              />
            )}
            <button onClick={handleLogout} className="text-white/40 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-8 py-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Dashboard profile={profile!} />
            </motion.div>
          )}
          {activeTab === 'goals' && (
            <motion.div 
              key="goals" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Goals profile={profile!} />
            </motion.div>
          )}
          {activeTab === 'partner' && (
            <motion.div 
              key="partner" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Partner profile={profile!} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div 
              key="settings" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Settings profile={profile!} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-md bg-white/5 backdrop-blur-xl px-8 py-5 rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white/10 z-20">
        <div className="flex items-center justify-between">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={22} />} label="Daily" />
          <NavButton active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon={<Target size={22} />} label="Goals" />
          <NavButton active={activeTab === 'partner'} onClick={() => setActiveTab('partner')} icon={<Users size={22} />} label="Partner" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={22} />} label="Settings" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'text-accent scale-110' : 'text-white/30 hover:text-white/60'}`}
    >
      {icon}
      <span className={`text-sm font-bold tracking-wide ${active ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
    </button>
  );
}
