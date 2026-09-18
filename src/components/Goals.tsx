import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { UserProfile, MonthlyGoal } from '../types';
import { format } from 'date-fns';
import { Target, Plus, TrendingUp, Users, Heart, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import SharedGoals from './SharedGoals';
import { isGuestProfile, readGuestGoals, writeGuestGoals } from '../localData';

export default function Goals({ profile }: { profile: UserProfile }) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [goalsTab, setGoalsTab] = useState<'personal' | 'shared'>('personal');
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ type: '', target: 0 });
  const [partner, setPartner] = useState<UserProfile | null>(null);

  // Listen to partner profile if linked
  useEffect(() => {
    if (isGuestProfile(profile)) {
      setPartner(null);
      return;
    }
    if (profile.partnerUid) {
      const unsub = onSnapshot(doc(db, 'users', profile.partnerUid), (snapshot) => {
        if (snapshot.exists()) {
          setPartner(snapshot.data() as UserProfile);
        }
      }, (err) => {
        console.warn("Partner snapshot error in Goals:", err.message);
      });
      return () => unsub();
    } else {
      setPartner(null);
    }
  }, [profile.partnerUid]);

  useEffect(() => {
    if (isGuestProfile(profile)) {
      setGoals(readGuestGoals(profile, currentMonth));
      return;
    }
    const q = query(
      collection(db, 'goals'),
      where('uid', '==', profile.uid),
      where('month', '==', currentMonth)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyGoal & { id: string })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goals');
    });

    return () => unsubscribe();
  }, [profile.uid, currentMonth]);

  const handleAddGoal = async () => {
    if (!newGoal.type || newGoal.target <= 0) return;
    if (isGuestProfile(profile)) {
      const newStoredGoal: MonthlyGoal & { id: string } = {
        id: crypto.randomUUID(),
        uid: profile.uid,
        month: currentMonth,
        goalType: newGoal.type.trim(),
        targetValue: newGoal.target,
        currentValue: 0,
      };
      const updatedGoals = [...goals, newStoredGoal];
      setGoals(updatedGoals);
      writeGuestGoals(profile, updatedGoals);
      setShowAdd(false);
      setNewGoal({ type: '', target: 0 });
      return;
    }
    try {
      await addDoc(collection(db, 'goals'), {
        uid: profile.uid,
        month: currentMonth,
        goalType: newGoal.type,
        targetValue: newGoal.target,
        currentValue: 0,
      });
      setShowAdd(false);
      setNewGoal({ type: '', target: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'goals');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-white tracking-tight">Fitness Goals</h2>
          <p className="text-white/60 font-medium">{format(new Date(), 'MMMM yyyy')}</p>
        </div>
        {goalsTab === 'personal' && (
          <button 
            onClick={() => setShowAdd(true)}
            id="btn-add-monthly-goal"
            className="w-12 h-12 flex items-center justify-center bg-accent text-paper rounded-2xl shadow-lg shadow-accent/20 hover:scale-105 transition-transform active:scale-95"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      {/* Segmented Switch: Personal vs Shared Partner Goals */}
      <div className="flex p-1.5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
        <button
          onClick={() => setGoalsTab('personal')}
          id="tab-personal-goals"
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            goalsTab === 'personal'
              ? 'bg-accent text-paper shadow-lg shadow-accent/20'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Target size={16} />
          <span>My Monthly Goals</span>
        </button>
        <button
          onClick={() => setGoalsTab('shared')}
          id="tab-shared-goals"
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            goalsTab === 'shared'
              ? 'bg-accent text-paper shadow-lg shadow-accent/20'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Users size={16} />
          <span>Shared with Partner</span>
        </button>
      </div>

      {goalsTab === 'shared' ? (
        partner ? (
          <SharedGoals profile={profile} partner={partner} />
        ) : (
          <div className="text-center py-20 px-6 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 space-y-4">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Heart size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-xl text-white">Connect with Your Partner</h4>
              <p className="text-sm text-white/40 max-w-xs mx-auto">
                Link accounts with your partner in Settings to set communal shared fitness quests and conquer milestones together.
              </p>
            </div>
            <p className="text-xs text-accent font-bold uppercase tracking-widest pt-2">Available in Settings</p>
          </div>
        )
      ) : (
        <>
          <AnimatePresence>
            {showAdd && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-xl space-y-6"
              >
                <h3 className="font-serif font-bold text-2xl text-white">New Goal</h3>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Goal Type (e.g. Weight Loss)" 
                    className="w-full p-4 bg-white/5 rounded-2xl border-none font-medium focus:ring-2 focus:ring-accent text-white placeholder:text-white/30"
                    value={newGoal.type}
                    onChange={e => setNewGoal({ ...newGoal, type: e.target.value })}
                  />
                  <input 
                    type="number" 
                    placeholder="Target Value" 
                    className="w-full p-4 bg-white/5 rounded-2xl border-none font-medium focus:ring-2 focus:ring-accent text-white placeholder:text-white/30"
                    value={newGoal.target || ''}
                    onChange={e => setNewGoal({ ...newGoal, target: Number(e.target.value) })}
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-4 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddGoal}
                    className="flex-1 py-4 bg-accent text-paper rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
                  >
                    Add Goal
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-8">
            {goals.map((goal) => (
              <GoalCard 
                key={goal.id} 
                goal={goal} 
                onUpdate={async (delta: number) => {
                  if (isGuestProfile(profile)) {
                    const updatedGoals = goals.map((item) => item.id === goal.id
                      ? { ...item, currentValue: Math.max(0, (item.currentValue || 0) + delta) }
                      : item);
                    setGoals(updatedGoals);
                    writeGuestGoals(profile, updatedGoals);
                    return;
                  }
                  try {
                    await updateDoc(doc(db, 'goals', goal.id), {
                      currentValue: Math.max(0, (goal.currentValue || 0) + delta)
                    });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.UPDATE, `goals/${goal.id}`);
                  }
                }}
                onDelete={async () => {
                  if (confirm(`Delete goal "${goal.goalType}"?`)) {
                    if (isGuestProfile(profile)) {
                      const updatedGoals = goals.filter((item) => item.id !== goal.id);
                      setGoals(updatedGoals);
                      writeGuestGoals(profile, updatedGoals);
                      return;
                    }
                    try {
                      await deleteDoc(doc(db, 'goals', goal.id));
                    } catch (err) {
                      handleFirestoreError(err, OperationType.DELETE, `goals/${goal.id}`);
                    }
                  }
                }}
              />
            ))}
            {goals.length === 0 && !showAdd && (
              <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
                  <Target size={32} />
                </div>
                <p className="text-white/40 font-medium">No goals set for this month yet.</p>
                <p className="text-xs text-accent mt-2 font-bold">Goals you create here will also be tracked on your Daily Dashboard!</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface GoalCardProps {
  key?: React.Key;
  goal: MonthlyGoal & { id: string };
  onUpdate: (delta: number) => void;
  onDelete: () => void;
}

function GoalCard({ goal, onUpdate, onDelete }: GoalCardProps) {
  const progress = Math.min(((goal.currentValue || 0) / goal.targetValue) * 100, 100);
  const isDone = (goal.currentValue || 0) >= goal.targetValue;

  return (
    <div className="glass-card-interactive p-7 sm:p-8 rounded-[2.2rem] space-y-6 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-accent shadow-sm group-hover:scale-105 transition-transform">
            <TrendingUp size={22} />
          </div>
          <div>
            <h4 className="font-serif font-extrabold text-xl text-white capitalize tracking-tight">{goal.goalType}</h4>
            <span className="text-white/40 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <span>Monthly Goal</span>
              <span className="text-accent">• Shows on Daily Board</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-2xl font-extrabold text-white tracking-tight tabular-nums font-sans">
              {(goal.currentValue || 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Target: {goal.targetValue.toLocaleString()}</span>
          </div>
          <button
            type="button"
            onClick={onDelete}
            title="Delete goal"
            className="p-2 text-white/25 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-95"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="h-2.5 bg-black/30 rounded-full overflow-hidden p-0.5 border border-white/10">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-gradient-to-r from-accent to-pink-300 rounded-full shadow-sm"
        />
      </div>

      {/* Progress summary & quick logging controls */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-semibold text-white/60">
          {isDone ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <CheckCircle2 size={16} /> Goal Completed!
            </span>
          ) : (
            `${Math.round(progress)}% of monthly target completed`
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate(1)}
            className="py-1.5 px-3.5 bg-white/10 hover:bg-accent hover:text-paper text-white text-xs font-extrabold rounded-xl transition-all flex items-center gap-1 active:scale-95 shadow-sm"
          >
            <Plus size={13} /> +1
          </button>
          <button
            type="button"
            onClick={() => onUpdate(5)}
            className="py-1.5 px-3.5 bg-white/10 hover:bg-accent hover:text-paper text-white text-xs font-extrabold rounded-xl transition-all flex items-center gap-1 active:scale-95 shadow-sm"
          >
            <Plus size={13} /> +5
          </button>
        </div>
      </div>

      <div className="h-24 w-full opacity-40 hover:opacity-75 transition-opacity">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[{ day: 1, val: 0 }, { day: 15, val: (goal.currentValue || 0) / 2 }, { day: 30, val: goal.currentValue || 0 }]}>
            <Line type="monotone" dataKey="val" stroke="var(--color-accent)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
