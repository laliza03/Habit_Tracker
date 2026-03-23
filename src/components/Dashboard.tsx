import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, DailyLog } from '../types';
import { format } from 'date-fns';
import { Droplets, Footprints, Flame, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { fetchFitbitSteps, fetchFitbitWater, fetchFitbitCalories } from '../services/fitbit';
import { motion } from 'framer-motion';

export default function Dashboard({ profile }: { profile: UserProfile }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const logId = `${profile.uid}_${today}`;
  const [log, setLog] = useState<DailyLog | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const path = `logs/${logId}`;
    const unsubscribe = onSnapshot(doc(db, 'logs', logId), (snapshot) => {
      if (snapshot.exists()) {
        setLog(snapshot.data() as DailyLog);
      } else {
        const newLog: DailyLog = {
          uid: profile.uid,
          date: today,
          steps: 0,
          water: 0,
          calories: 0,
          supplements: {
            creatine: false,
            biotin: false,
            omega: false,
            magnesium: false,
          },
          affirmations: false,
          completedAll: false,
        };
        setDoc(doc(db, 'logs', logId), newLog).catch(e => handleFirestoreError(e, OperationType.WRITE, path));
        setLog(newLog);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [logId, profile.uid, today]);

  const toggleSupplement = async (name: string) => {
    if (!log) return;
    const path = `logs/${logId}`;
    const newSupplements = { ...log.supplements, [name]: !log.supplements[name] };
    try {
      await updateDoc(doc(db, 'logs', logId), { supplements: newSupplements });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const toggleAffirmations = async () => {
    if (!log) return;
    const path = `logs/${logId}`;
    try {
      await updateDoc(doc(db, 'logs', logId), { affirmations: !log.affirmations });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const syncFitbit = async () => {
    if (!profile.fitbitAccessToken || !profile.fitbitUserId) {
      alert('Please connect your Fitbit account in Settings first.');
      return;
    }
    setSyncing(true);
    const path = `logs/${logId}`;
    try {
      const steps = await fetchFitbitSteps(profile.fitbitAccessToken, profile.fitbitUserId, today);
      const water = await fetchFitbitWater(profile.fitbitAccessToken, profile.fitbitUserId, today);
      const calories = await fetchFitbitCalories(profile.fitbitAccessToken, profile.fitbitUserId, today);
      
      await updateDoc(doc(db, 'logs', logId), { steps, water, calories });
    } catch (error) {
      console.error('Sync error:', error);
      if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } finally {
      setSyncing(false);
    }
  };

  if (!log) return null;

  const allSupplementsDone = Object.values(log.supplements).every(v => v);
  const stepsDone = log.steps >= (profile.stepGoal || 10000);
  const waterDone = log.water >= (profile.waterGoal || 2000);
  const allDone = stepsDone && waterDone && allSupplementsDone && log.affirmations;

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-white tracking-tight">Today</h2>
          <p className="text-white/60 font-medium">{format(new Date(), 'EEEE, MMMM do')}</p>
        </div>
        <button 
          onClick={syncFitbit}
          disabled={syncing}
          className="w-12 h-12 flex items-center justify-center bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 active:scale-95"
        >
          <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
        </button>
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
            <h3 className="font-serif font-bold text-xl">All Habits Complete!</h3>
            <p className="text-white/80">You're killing it today. Partner notified!</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <StatCard 
          icon={<Footprints size={20} />} 
          label="Steps" 
          value={log.steps} 
          target={profile.stepGoal || 10000} 
          unit="steps"
          color="bg-blue-500"
        />
        <StatCard 
          icon={<Droplets size={20} />} 
          label="Water" 
          value={log.water} 
          target={profile.waterGoal || 2000} 
          unit="ml"
          color="bg-cyan-500"
        />
        <StatCard 
          icon={<Flame size={20} />} 
          label="Calories" 
          value={log.calories} 
          target={profile.calorieGoal || 2000} 
          unit="kcal"
          color="bg-orange-500"
        />
      </div>

      <section className="space-y-6">
        <h3 className="text-xl font-serif font-bold text-white flex items-center gap-3">
          <Sparkles size={20} className="text-accent" />
          Supplements
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(log.supplements).map(([name, done]) => {
            return (
              <button
                key={name}
                onClick={() => toggleSupplement(name)}
                className={`p-6 rounded-[1.5rem] border-2 text-left transition-all duration-300 ${
                  done 
                    ? `bg-accent border-transparent text-paper shadow-lg shadow-accent/20` 
                    : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="capitalize font-bold tracking-tight text-white">{name}</span>
                  {done && <CheckCircle2 size={18} className="text-paper" />}
                </div>
                <p className={`text-sm font-bold ${done ? 'text-paper/60' : 'text-white/30'}`}>
                  {done ? 'Completed' : 'Pending'}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-serif font-bold text-white">Daily Affirmation</h3>
        <button
          onClick={toggleAffirmations}
          className={`w-full p-8 rounded-[2rem] border-2 text-left transition-all duration-300 ${
            log.affirmations 
              ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
              : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${log.affirmations ? 'bg-paper/20' : 'bg-white/5'}`}>
              <Sparkles size={28} className={log.affirmations ? 'text-paper' : 'text-accent'} />
            </div>
            <div className="flex-1">
              <p className="font-serif font-bold text-lg text-white">5 Nice Things</p>
              <p className={`text-sm ${log.affirmations ? 'text-paper/70' : 'text-white/40'}`}>Say them in front of the mirror</p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${log.affirmations ? 'bg-paper text-accent scale-110' : 'bg-white/10 text-white/20'}`}>
              {log.affirmations ? <CheckCircle2 size={20} /> : <div className="w-2 h-2 rounded-full bg-current" />}
            </div>
          </div>
        </button>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, target, unit, color }: { icon: React.ReactNode; label: string; value: number; target: number; unit: string; color: string }) {
  const progress = Math.min((value / target) * 100, 100);
  
  return (
    <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white">{icon}</div>
          <span className="font-serif font-bold text-lg text-white">{label}</span>
        </div>
        <div className="text-right">
          <span className="block text-xl font-bold text-white">{value.toLocaleString()}</span>
          <span className="text-xs font-bold text-white/30 uppercase tracking-wider">
            Goal: {target.toLocaleString()} {unit}
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
