import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { UserProfile, MonthlyGoal } from '../types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Target, Plus, TrendingUp, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Goals({ profile }: { profile: UserProfile }) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ type: '', target: 0 });

  useEffect(() => {
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
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-white tracking-tight">Monthly Goals</h2>
          <p className="text-white/60 font-medium">{format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="w-12 h-12 flex items-center justify-center bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:scale-105 transition-transform active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

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
                className="flex-1 py-4 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
              >
                Add Goal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-8">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
        {goals.length === 0 && !showAdd && (
          <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
              <Target size={32} />
            </div>
            <p className="text-white/40 font-medium">No goals set for this month yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GoalCard(props: any) {
  const { goal } = props;
  const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100);

  return (
    <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white">
            <TrendingUp size={24} />
          </div>
          <div>
            <h4 className="font-serif font-bold text-lg text-white capitalize">{goal.goalType}</h4>
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest">Progress</p>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-xl font-bold text-white">{goal.currentValue.toLocaleString()}</span>
          <span className="text-xs font-bold text-white/30 uppercase tracking-wider">Target: {goal.targetValue.toLocaleString()}</span>
        </div>
      </div>

      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-accent rounded-full"
        />
      </div>

      <div className="h-32 w-full opacity-50">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[{ day: 1, val: 0 }, { day: 15, val: goal.currentValue / 2 }, { day: 30, val: goal.currentValue }]}>
            <Line type="monotone" dataKey="val" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
