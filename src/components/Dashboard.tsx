import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';
import { UserProfile, DailyLog, MonthlyGoal, SharedGoal } from '../types';
import { format } from 'date-fns';
import { 
  Droplets, 
  Footprints, 
  Flame, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Target, 
  TrendingUp, 
  Plus, 
  Users,
  Award,
  Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import QuickLogStatCard from './QuickLogStatCard';
import { isGuestProfile, readGuestGoals, readGuestLog, writeGuestGoals, writeGuestLog } from '../localData';

export default function Dashboard({ profile }: { profile: UserProfile }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentMonth = format(new Date(), 'yyyy-MM');
  const logId = `${profile.uid}_${today}`;
  const [log, setLog] = useState<DailyLog | null>(null);
  const [personalGoals, setPersonalGoals] = useState<(MonthlyGoal & { id: string })[]>([]);
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);

  // 1. Listen to today's log
  useEffect(() => {
    if (isGuestProfile(profile)) {
      const localLog = readGuestLog(profile, today);
      setLog(localLog);
      writeGuestLog(localLog);
      return;
    }
    const path = `logs/${logId}`;
    const userSupplements = profile.supplements && profile.supplements.length > 0
      ? profile.supplements
      : ['creatine', 'biotin', 'omega', 'magnesium'];

    const unsubscribe = onSnapshot(doc(db, 'logs', logId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DailyLog;
        // Make sure all user supplements exist in log.supplements map
        let needsSupplementSync = false;
        const currentSupplements = { ...(data.supplements || {}) };

        Object.keys(currentSupplements).forEach((supp) => {
          if (!userSupplements.includes(supp)) {
            delete currentSupplements[supp];
            needsSupplementSync = true;
          }
        });
        
        userSupplements.forEach(supp => {
          if (currentSupplements[supp] === undefined) {
            currentSupplements[supp] = false;
            needsSupplementSync = true;
          }
        });

        if (needsSupplementSync) {
          updateDoc(doc(db, 'logs', logId), { supplements: currentSupplements }).catch(e => {
            console.warn("Auto-sync supplement keys warning:", e);
          });
          setLog({ ...data, supplements: currentSupplements });
        } else {
          setLog(data);
        }
      } else {
        const initialSupplements: { [key: string]: boolean } = {};
        userSupplements.forEach(supp => {
          initialSupplements[supp] = false;
        });

        const newLog: DailyLog = {
          uid: profile.uid,
          date: today,
          steps: 0,
          water: 0,
          calories: 0,
          supplements: initialSupplements,
          affirmations: false,
          completedAll: false,
          customGoals: {},
        };
        setDoc(doc(db, 'logs', logId), newLog).catch(e => handleFirestoreError(e, OperationType.WRITE, path));
        setLog(newLog);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [logId, profile.uid, today, JSON.stringify(profile.supplements || [])]);

  // 2. Real-time listener for personal monthly goals created in Goals tab
  useEffect(() => {
    if (isGuestProfile(profile)) {
      setPersonalGoals(readGuestGoals(profile, currentMonth));
      return;
    }
    const q = query(
      collection(db, 'goals'),
      where('uid', '==', profile.uid),
      where('month', '==', currentMonth)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPersonalGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyGoal & { id: string })));
    }, (err) => {
      console.warn("Could not fetch personal goals for daily board:", err);
    });
    return () => unsubscribe();
  }, [profile.uid, currentMonth]);

  // 3. Real-time listener for shared partner goals
  useEffect(() => {
    if (isGuestProfile(profile)) {
      setSharedGoals([]);
      return;
    }
    const q = query(
      collection(db, 'shared_goals'),
      where('members', 'array-contains', profile.uid),
      where('status', '==', 'active')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSharedGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SharedGoal)));
    }, (err) => {
      console.warn("Could not fetch shared goals for daily board:", err);
    });
    return () => unsubscribe();
  }, [profile.uid]);

  // Quick manual increment or decrement
  const handleQuickAddMetric = async (metric: 'steps' | 'water' | 'calories', amount: number) => {
    if (!log) return;
    const current = log[metric] || 0;
    const nextVal = Math.max(0, current + amount);
    if (isGuestProfile(profile)) {
      const updated = { ...log, [metric]: nextVal };
      setLog(updated);
      writeGuestLog(updated);
      return;
    }
    const path = `logs/${logId}`;
    try {
      await updateDoc(doc(db, 'logs', logId), { [metric]: nextVal });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // Set exact metric value
  const handleSetMetric = async (metric: 'steps' | 'water' | 'calories', exactValue: number) => {
    if (!log) return;
    const nextVal = Math.max(0, exactValue);
    if (isGuestProfile(profile)) {
      const updated = { ...log, [metric]: nextVal };
      setLog(updated);
      writeGuestLog(updated);
      return;
    }
    const path = `logs/${logId}`;
    try {
      await updateDoc(doc(db, 'logs', logId), { [metric]: nextVal });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // Increment or update custom monthly goal from daily board
  const handleUpdateCustomGoal = async (goal: MonthlyGoal & { id: string }, delta: number) => {
    const nextVal = Math.max(0, (goal.currentValue || 0) + delta);
    if (isGuestProfile(profile)) {
      const updatedGoals = personalGoals.map((item) => item.id === goal.id ? { ...item, currentValue: nextVal } : item);
      setPersonalGoals(updatedGoals);
      writeGuestGoals(profile, updatedGoals);
      return;
    }
    try {
      await updateDoc(doc(db, 'goals', goal.id), { currentValue: nextVal });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `goals/${goal.id}`);
    }
  };

  const handleDeletePersonalGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    if (isGuestProfile(profile)) {
      const updatedGoals = personalGoals.filter((goal) => goal.id !== goalId);
      setPersonalGoals(updatedGoals);
      writeGuestGoals(profile, updatedGoals);
      return;
    }
    try {
      await deleteDoc(doc(db, 'goals', goalId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `goals/${goalId}`);
    }
  };

  const toggleSupplement = async (name: string) => {
    if (!log) return;
    const path = `logs/${logId}`;
    const newSupplements = { ...log.supplements, [name]: !log.supplements[name] };
    if (isGuestProfile(profile)) {
      const updated = { ...log, supplements: newSupplements };
      setLog(updated);
      writeGuestLog(updated);
      return;
    }
    try {
      await updateDoc(doc(db, 'logs', logId), { supplements: newSupplements });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleRemoveSupplement = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove "${name}" from your daily supplements?`)) return;

    // 1. Remove from current log
    if (log) {
      const nextSupplements = { ...log.supplements };
      delete nextSupplements[name];
      if (isGuestProfile(profile)) {
        const updated = { ...log, supplements: nextSupplements };
        setLog(updated);
        writeGuestLog(updated);
      } else {
      try {
        await updateDoc(doc(db, 'logs', logId), { supplements: nextSupplements });
      } catch (err) {
        console.warn("Could not remove supplement from daily log:", err);
      }
      }
    }

    if (isGuestProfile(profile)) return;

    // 2. Remove from user profile list
    const currentList = profile.supplements && profile.supplements.length > 0
      ? profile.supplements
      : ['creatine', 'biotin', 'omega', 'magnesium'];
    const updated = currentList.filter(s => s !== name);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { supplements: updated });
    } catch (err) {
      console.warn("Could not remove supplement from profile:", err);
    }
  };

  const toggleAffirmations = async () => {
    if (!log) return;
    const path = `logs/${logId}`;
    if (isGuestProfile(profile)) {
      const updated = { ...log, affirmations: !log.affirmations };
      setLog(updated);
      writeGuestLog(updated);
      return;
    }
    try {
      await updateDoc(doc(db, 'logs', logId), { affirmations: !log.affirmations });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const syncFitbit = async () => {
    alert('Fitbit sync is temporarily unavailable while we complete a secure server-side integration. Manual logging remains available.');
  };

  if (!log) return null;

  const supplementEntries = Object.entries(log.supplements);
  const allSupplementsDone = supplementEntries.length > 0 && supplementEntries.every(([_, done]) => done);
  const stepsDone = log.steps >= (profile.stepGoal || 10000);
  const waterDone = log.water >= (profile.waterGoal || 2000);
  const allDone = stepsDone && waterDone && allSupplementsDone && log.affirmations;

  return (
    <div className="space-y-9">
      {/* Header with Date Badge & Sync Action */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-accent uppercase tracking-widest block mb-1">Daily Overview</span>
          <h2 className="text-3xl sm:text-4xl font-serif font-extrabold text-white tracking-tight">Today</h2>
          <p className="text-white/50 font-medium text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM do')}</p>
        </div>
        <button 
          onClick={syncFitbit}
          title="Fitbit sync is temporarily unavailable; use the manual logging controls below"
          className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-accent hover:text-paper text-white rounded-2xl shadow-lg border border-white/10 hover:border-transparent transition-all active:scale-95 group"
        >
          <RefreshCw size={19} className="transition-transform group-hover:rotate-180 duration-500" />
        </button>
      </div>

      {allDone && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-r from-accent to-pink-300 text-paper p-7 rounded-[2.2rem] flex items-center gap-5 shadow-2xl shadow-accent/25 relative overflow-hidden"
        >
          <div className="w-14 h-14 bg-paper/20 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={32} className="text-paper" />
          </div>
          <div>
            <h3 className="font-serif font-extrabold text-xl leading-snug">All Habits Complete!</h3>
            <p className="text-paper/85 text-sm font-semibold">You and your partner are in sync today. Great job!</p>
          </div>
        </motion.div>
      )}

      {/* Core Fitness Metrics with Direct Manual Quick-Log Tap Controls */}
      <div className="grid grid-cols-1 gap-5">
        {/* Steps Card */}
        <QuickLogStatCard
          icon={<Footprints size={22} />}
          label="Steps"
          value={log.steps}
          target={profile.stepGoal || 10000}
          unit="steps"
          color="bg-gradient-to-r from-blue-500 to-indigo-400"
          quickOptions={[
            { label: '+500', amount: 500 },
            { label: '+1k', amount: 1000 },
            { label: '+2.5k', amount: 2500 },
          ]}
          onAdd={(amt) => handleQuickAddMetric('steps', amt)}
          onSet={(val) => handleSetMetric('steps', val)}
        />

        {/* Water Card */}
        <QuickLogStatCard
          icon={<Droplets size={22} />}
          label="Water"
          value={log.water}
          target={profile.waterGoal || 2000}
          unit="ml"
          color="bg-gradient-to-r from-cyan-400 to-teal-400"
          quickOptions={[
            { label: '+250', amount: 250 },
            { label: '+500', amount: 500 },
            { label: '+750', amount: 750 },
          ]}
          onAdd={(amt) => handleQuickAddMetric('water', amt)}
          onSet={(val) => handleSetMetric('water', val)}
        />

        {/* Calories Card */}
        <QuickLogStatCard
          icon={<Flame size={22} />}
          label="Calories"
          value={log.calories}
          target={profile.calorieGoal || 2000}
          unit="kcal"
          color="bg-gradient-to-r from-orange-400 to-rose-500"
          quickOptions={[
            { label: '+150', amount: 150 },
            { label: '+300', amount: 300 },
            { label: '+500', amount: 500 },
          ]}
          onAdd={(amt) => handleQuickAddMetric('calories', amt)}
          onSet={(val) => handleSetMetric('calories', val)}
        />
      </div>

      {/* Active Created Goals Tracker (Displayed Directly on the Daily Board) */}
      {(personalGoals.length > 0 || sharedGoals.length > 0) && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold text-white flex items-center gap-3">
              <Target size={20} className="text-accent" />
              Active Goals On Board
            </h3>
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
              {personalGoals.length + sharedGoals.length} tracked
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Personal Goals Created in Goals Tab */}
            {personalGoals.map((goal) => {
              const progress = Math.min(((goal.currentValue || 0) / goal.targetValue) * 100, 100);
              const isDone = (goal.currentValue || 0) >= goal.targetValue;
              return (
                <div
                  key={goal.id}
                  className="bg-white/5 backdrop-blur-md p-6 rounded-[1.8rem] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                        <TrendingUp size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white capitalize text-base">{goal.goalType}</h4>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                          Monthly Goal
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-lg font-bold text-white">
                          {(goal.currentValue || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-white/40"> / {goal.targetValue.toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePersonalGoal(goal.id)}
                        title="Delete goal"
                        className="p-1.5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-accent rounded-full"
                    />
                  </div>

                  {/* Quick-add progress to this goal right from Today board */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-white/50">
                      {isDone ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 size={13} /> Completed!
                        </span>
                      ) : (
                        `${Math.round(progress)}% reached`
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateCustomGoal(goal, 1)}
                        className="py-1 px-2.5 bg-white/10 hover:bg-accent hover:text-paper text-white text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Plus size={12} /> +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateCustomGoal(goal, 5)}
                        className="py-1 px-2.5 bg-white/10 hover:bg-accent hover:text-paper text-white text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Plus size={12} /> +5
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Shared Partner Goals */}
            {sharedGoals.map((shared) => {
              const total = (shared.partner1Contribution || 0) + (shared.partner2Contribution || 0);
              const progress = Math.min((total / shared.targetValue) * 100, 100);
              return (
                <div
                  key={shared.id}
                  className="bg-white/5 backdrop-blur-md p-6 rounded-[1.8rem] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <Users size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base line-clamp-1">{shared.title}</h4>
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                          <Award size={10} /> Partner Shared Goal
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-white">{total.toLocaleString()}</span>
                      <span className="text-xs text-white/40"> / {shared.targetValue.toLocaleString()} {shared.unit}</span>
                    </div>
                  </div>

                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-purple-400 rounded-full"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-white/50 pt-1">
                    <span>Category: <strong className="text-white capitalize">{shared.category}</strong></span>
                    <span className="font-bold text-purple-300">{Math.round(progress)}% Duo Progress</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <h3 className="text-xl font-serif font-bold text-white tracking-tight">Supplements</h3>
          </div>
          <span className="text-[11px] font-bold text-accent px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 uppercase tracking-wider">
            {Object.values(log.supplements).filter(Boolean).length} / {Object.keys(log.supplements).length} Done
          </span>
        </div>

        {Object.keys(log.supplements).length === 0 ? (
          <div className="p-8 glass-card rounded-[2rem] text-center space-y-2">
            <p className="text-white/70 font-semibold text-sm">No supplements configured in your routine.</p>
            <p className="text-xs text-white/40">Go to Settings to customize the supplements you take daily!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {Object.entries(log.supplements).map(([name, done]) => {
              return (
                <div
                  key={name}
                  onClick={() => toggleSupplement(name)}
                  className={`p-4 sm:p-5 px-5 rounded-[1.8rem] border text-left transition-all duration-300 cursor-pointer relative group ${
                    done 
                      ? 'bg-gradient-to-r from-accent to-pink-300 border-transparent text-paper shadow-lg shadow-accent/20 scale-[1.01]' 
                      : 'glass-card-interactive border-white/10 text-white hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`capitalize font-bold tracking-tight text-base ${done ? 'text-paper font-extrabold' : 'text-white'}`}>
                        {name}
                      </span>
                      {done && <CheckCircle2 size={17} className="text-paper" />}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSupplement(name, e)}
                      title={`Remove "${name}"`}
                      className={`p-1.5 rounded-xl transition-all ${
                        done 
                          ? 'text-paper/50 hover:text-paper hover:bg-paper/20' 
                          : 'text-white/20 hover:text-rose-400 hover:bg-rose-500/15'
                      }`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p className={`text-xs font-semibold ${done ? 'text-paper/80' : 'text-white/40'}`}>
                    {done ? '✓ Completed today' : 'Tap to mark completed'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <h3 className="text-xl font-serif font-bold text-white tracking-tight">Daily Affirmation</h3>
        </div>

        <button
          onClick={toggleAffirmations}
          className={`w-full p-6 sm:p-7 rounded-[2.2rem] border text-left transition-all duration-300 relative overflow-hidden group ${
            log.affirmations 
              ? 'bg-gradient-to-r from-accent to-pink-300 border-transparent text-paper shadow-2xl shadow-accent/25' 
              : 'glass-card-interactive border-white/10 text-white hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${log.affirmations ? 'bg-paper/20' : 'bg-white/5 border border-white/10'}`}>
              <Sparkles size={28} className={log.affirmations ? 'text-paper' : 'text-accent'} />
            </div>
            <div className="flex-1">
              <p className={`font-serif font-extrabold text-lg sm:text-xl tracking-tight ${log.affirmations ? 'text-paper' : 'text-white'}`}>
                5 Nice Things
              </p>
              <p className={`text-xs sm:text-sm font-medium mt-0.5 ${log.affirmations ? 'text-paper/80 font-semibold' : 'text-white/40'}`}>
                Say them out loud in front of the mirror
              </p>
            </div>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${log.affirmations ? 'bg-paper text-accent shadow-md scale-105' : 'bg-white/10 text-white/30'}`}>
              {log.affirmations ? <CheckCircle2 size={22} className="text-accent" /> : <div className="w-2.5 h-2.5 rounded-full bg-white/40" />}
            </div>
          </div>
        </button>
      </section>
    </div>
  );
}
