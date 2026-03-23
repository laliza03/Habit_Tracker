import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, collection, query, where, getDoc } from 'firebase/firestore';
import { UserProfile, DailyLog } from '../types';
import { format } from 'date-fns';
import { Users, Heart, CheckCircle2, Footprints, Droplets, Flame } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Partner({ profile }: { profile: UserProfile }) {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [partnerLog, setPartnerLog] = useState<DailyLog | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (profile.partnerUid) {
      const partnerPath = `users/${profile.partnerUid}`;
      const unsubPartner = onSnapshot(doc(db, 'users', profile.partnerUid), (snapshot) => {
        if (snapshot.exists()) setPartner(snapshot.data() as UserProfile);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, partnerPath);
      });

      const logPath = `logs/${profile.partnerUid}_${today}`;
      const unsubLog = onSnapshot(doc(db, 'logs', `${profile.partnerUid}_${today}`), (snapshot) => {
        if (snapshot.exists()) setPartnerLog(snapshot.data() as DailyLog);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, logPath);
      });

      return () => {
        unsubPartner();
        unsubLog();
      };
    }
  }, [profile.partnerUid, today]);

  if (!profile.partnerUid) {
    return (
      <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
          <Users size={32} />
        </div>
        <p className="text-white/60 font-medium mb-2">No partner linked yet.</p>
        <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Link accounts in Settings</p>
      </div>
    );
  }

  if (!partner) return null;

  const allSupplementsDone = partnerLog ? Object.values(partnerLog.supplements).every(v => v) : false;
  const stepsDone = partnerLog ? partnerLog.steps >= (partner.stepGoal || 10000) : false;
  const waterDone = partnerLog ? partnerLog.water >= (partner.waterGoal || 2000) : false;
  const allDone = stepsDone && waterDone && allSupplementsDone && partnerLog?.affirmations;

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-serif font-bold text-white tracking-tight">Partner Progress</h2>
        <div className="w-12 h-12 bg-accent/10 text-accent rounded-2xl flex items-center justify-center">
          <Heart size={24} />
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/10 shadow-xl shadow-black/20 text-center space-y-6">
        <div className="relative inline-block">
          {partner.photoURL ? (
            <img 
              src={partner.photoURL} 
              alt={partner.displayName || 'Partner'} 
              className="w-24 h-24 rounded-full border-4 border-white/10 shadow-lg mx-auto"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto border-4 border-white/10 shadow-lg">
              <Users size={40} className="text-white/20" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent text-paper rounded-full flex items-center justify-center border-2 border-white/10 shadow-md">
            <Heart size={14} />
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-serif font-bold text-white">{partner.displayName || 'Your Partner'}</h3>
          <p className="text-white/40 font-medium">Tracking together since forever</p>
        </div>
      </div>

      {allDone && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-accent text-white p-8 rounded-[2rem] flex items-center gap-5 shadow-xl shadow-accent/20"
        >
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-xl">All Done!</h3>
            <p className="text-white/80">{partner.displayName || 'Partner'} has finished all habits today.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6">
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

      <div className="bg-white/5 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/10 space-y-6">
        <h3 className="text-xl font-serif font-bold text-white">Other Habits</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-4 border-b border-white/5">
            <span className="text-white/60 font-medium">Supplements</span>
            {allSupplementsDone ? <CheckCircle2 size={24} className="text-accent" /> : <div className="w-6 h-6 rounded-full border-2 border-white/5" />}
          </div>
          <div className="flex items-center justify-between py-4">
            <span className="text-white/60 font-medium">Daily Affirmations</span>
            {partnerLog?.affirmations ? <CheckCircle2 size={24} className="text-accent" /> : <div className="w-6 h-6 rounded-full border-2 border-white/5" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function PartnerStatCard({ icon, label, value, target, color }: { icon: React.ReactNode; label: string; value: number; target: number; color: string }) {
  const progress = Math.min((value / target) * 100, 100);
  
  return (
    <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white">{icon}</div>
          <span className="font-serif font-bold text-lg text-white">{label}</span>
        </div>
        <div className="text-right">
          <span className="block text-xl font-bold text-white">{value.toLocaleString()}</span>
          <span className="text-xs font-bold text-white/30 uppercase tracking-wider">
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
