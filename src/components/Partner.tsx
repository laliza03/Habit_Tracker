import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, DailyLog } from '../types';
import { format } from 'date-fns';
import { Users, Heart, CheckCircle2, Footprints, Droplets, Flame, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import SharedGoals from './SharedGoals';

export default function Partner({ profile }: { profile: UserProfile }) {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [partnerLog, setPartnerLog] = useState<DailyLog | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [partnerView, setPartnerView] = useState<'goals' | 'daily'>('goals');
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (profile.partnerUid) {
      setIsWaiting(false);
      const unsubPartner = onSnapshot(doc(db, 'users', profile.partnerUid), (snapshot) => {
        if (snapshot.exists()) setPartner(snapshot.data() as UserProfile);
      }, (error) => {
        if (error.code === 'permission-denied') {
          setIsWaiting(true);
        } else {
          handleFirestoreError(error, OperationType.GET, `users/${profile.partnerUid}`);
        }
      });

      const unsubLog = onSnapshot(doc(db, 'logs', `${profile.partnerUid}_${today}`), (snapshot) => {
        if (snapshot.exists()) setPartnerLog(snapshot.data() as DailyLog);
      }, (error) => {
        if (error.code !== 'permission-denied') {
          handleFirestoreError(error, OperationType.GET, `logs/${profile.partnerUid}_${today}`);
        }
      });

      return () => {
        unsubPartner();
        unsubLog();
      };
    }
  }, [profile.partnerUid, today]);

  if (!profile.partnerUid) {
    return (
      <div className="text-center py-20 px-6 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 space-y-4">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/20">
          <Users size={32} />
        </div>
        <div className="space-y-1">
          <p className="text-white font-serif font-bold text-xl">No partner linked yet</p>
          <p className="text-sm text-white/40 max-w-xs mx-auto">
            Connect with your partner in Settings to unlock communal shared fitness goals, live tracking, and mutual encouragement.
          </p>
        </div>
        <p className="text-xs text-accent font-bold uppercase tracking-widest pt-2">Link accounts in Settings tab</p>
      </div>
    );
  }

  if (isWaiting) {
    return (
      <div className="text-center py-20 px-6 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 space-y-4">
        <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
          <Heart size={32} />
        </div>
        <div className="space-y-1">
          <p className="text-white font-serif font-bold text-xl">Waiting for partner to link back</p>
          <p className="text-sm text-white/40 max-w-xs mx-auto">
            Once they enter your email in their Settings, you will be able to set shared fitness goals and track progress together.
          </p>
        </div>
        <p className="text-xs text-accent font-bold uppercase tracking-widest pt-2">Mutual link required</p>
      </div>
    );
  }

  if (!partner) return null;

  const allSupplementsDone = partnerLog ? Object.values(partnerLog.supplements || {}).every(v => v) : false;
  const stepsDone = partnerLog ? partnerLog.steps >= (partner.stepGoal || 10000) : false;
  const waterDone = partnerLog ? partnerLog.water >= (partner.waterGoal || 2000) : false;
  const allDone = stepsDone && waterDone && allSupplementsDone && partnerLog?.affirmations;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-accent uppercase tracking-widest block mb-1">Accountability Duo</span>
          <h2 className="text-3xl sm:text-4xl font-serif font-extrabold text-white tracking-tight">Partner Hub</h2>
        </div>
        <div className="w-12 h-12 bg-white/5 border border-white/10 text-accent rounded-2xl flex items-center justify-center shadow-md">
          <Heart size={22} className="fill-accent/20" />
        </div>
      </div>

      {/* Partner Info Card */}
      <div className="glass-card p-8 rounded-[2.5rem] text-center space-y-4 relative overflow-hidden">
        <div className="relative inline-block">
          {partner.photoURL ? (
            <img 
              src={partner.photoURL} 
              alt={partner.displayName || 'Partner'} 
              className="w-20 h-20 rounded-full border-4 border-accent/30 shadow-xl mx-auto object-cover" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border-4 border-white/10 shadow-lg">
              <Users size={34} className="text-white/30" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-accent text-paper rounded-full flex items-center justify-center border-2 border-paper shadow-md">
            <Heart size={13} className="fill-paper" />
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-serif font-extrabold text-white tracking-tight">{partner.displayName || 'Your Partner'}</h3>
          <p className="text-white/45 text-xs font-semibold mt-0.5">Tracking fitness & habits together</p>
        </div>
      </div>

      {/* Navigation Switch between Shared Fitness Goals and Partner Daily Habits */}
      <div className="flex p-1.5 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
        <button
          onClick={() => setPartnerView('goals')}
          id="btn-partner-view-goals"
          className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
            partnerView === 'goals' 
              ? 'bg-accent text-paper shadow-lg shadow-accent/20' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Target size={16} />
          <span>Shared Goals</span>
        </button>
        <button
          onClick={() => setPartnerView('daily')}
          id="btn-partner-view-daily"
          className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
            partnerView === 'daily' 
              ? 'bg-accent text-paper shadow-lg shadow-accent/20' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Footprints size={16} />
          <span>Partner's Day</span>
        </button>
      </div>

      {/* View Content */}
      {partnerView === 'goals' ? (
        <SharedGoals profile={profile} partner={partner} />
      ) : (
        <div className="space-y-6">
          {allDone && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-accent text-paper p-6 rounded-[2rem] flex items-center gap-4 shadow-xl shadow-accent/20"
            >
              <div className="w-10 h-10 bg-paper/20 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg">All Done!</h3>
                <p className="text-paper/80 text-xs">{partner.displayName || 'Partner'} has completed all habits today.</p>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <PartnerStatCard 
              icon={<Footprints size={20} />} 
              label="Steps" 
              value={partnerLog?.steps || 0} 
              target={partner.stepGoal || 10000} 
              color="bg-blue-500"
            />
            <PartnerStatCard 
              icon={<Droplets size={20} />} 
              label="Water" 
              value={partnerLog?.water || 0} 
              target={partner.waterGoal || 2000} 
              color="bg-cyan-500"
            />
            <PartnerStatCard 
              icon={<Flame size={20} />} 
              label="Calories" 
              value={partnerLog?.calories || 0} 
              target={partner.calorieGoal || 2000} 
              color="bg-orange-500"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Other Habits</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-white/60 text-sm font-medium">Supplements</span>
                {allSupplementsDone ? <CheckCircle2 size={22} className="text-accent" /> : <div className="w-5 h-5 rounded-full border-2 border-white/10" />}
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-white/60 text-sm font-medium">Daily Affirmations</span>
                {partnerLog?.affirmations ? <CheckCircle2 size={22} className="text-accent" /> : <div className="w-5 h-5 rounded-full border-2 border-white/10" />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PartnerStatCard({ icon, label, value, target, color }: { icon: React.ReactNode; label: string; value: number; target: number; color: string }) {
  const progress = Math.min((value / target) * 100, 100);
  
  return (
    <div className="bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-white">{icon}</div>
          <span className="font-serif font-bold text-base text-white">{label}</span>
        </div>
        <div className="text-right">
          <span className="block text-lg font-bold text-white">{value.toLocaleString()}</span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
            Goal: {target.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}
