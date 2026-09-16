import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDoc
} from 'firebase/firestore';
import { UserProfile, SharedGoal, DailyLog } from '../types';
import { format } from 'date-fns';
import { 
  Target, 
  Plus, 
  Trophy, 
  Footprints, 
  Flame, 
  Dumbbell, 
  Droplets, 
  Zap, 
  Sparkles, 
  Heart, 
  Calendar, 
  ChevronRight, 
  Check, 
  CheckCircle2, 
  X, 
  RefreshCw,
  Send,
  Award,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SharedGoalsProps {
  profile: UserProfile;
  partner: UserProfile;
}

const PRESET_GOALS = [
  {
    title: '100k Steps Expedition',
    category: 'steps' as const,
    targetValue: 100000,
    unit: 'steps',
    description: 'Conquer 100,000 steps together',
    icon: Footprints,
  },
  {
    title: '20 Shared Workouts',
    category: 'workouts' as const,
    targetValue: 20,
    unit: 'workouts',
    description: 'Hit 20 exercise sessions as a duo',
    icon: Dumbbell,
  },
  {
    title: '15,000 Calorie Burn',
    category: 'calories' as const,
    targetValue: 15000,
    unit: 'kcal',
    description: 'Burn 15k active calories together',
    icon: Flame,
  },
  {
    title: '40L Hydration Quest',
    category: 'water' as const,
    targetValue: 40000,
    unit: 'ml',
    description: 'Drink 40 liters of water together',
    icon: Droplets,
  },
];

const CHEER_MESSAGES = [
  "🔥 Crushing it!",
  "💪 We've got this!",
  "🙌 High five partner!",
  "🏃 Keep up the pace!",
  "⭐ Unstoppable duo!",
  "🏆 Proud of you!"
];

export default function SharedGoals({ profile, partner }: SharedGoalsProps) {
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [activeFilter, setActiveFilter] = useState<'active' | 'completed'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<SharedGoal | null>(null);
  const [contributionAmount, setContributionAmount] = useState<number | ''>('');
  const [syncingToday, setSyncingToday] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  
  // Custom goal form state
  const [goalForm, setGoalForm] = useState({
    title: '',
    category: 'steps' as SharedGoal['category'],
    targetValue: 100000,
    unit: 'steps',
    endDate: '',
    notes: '',
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  // Load today's log for quick syncing
  useEffect(() => {
    const unsubLog = onSnapshot(doc(db, 'logs', `${profile.uid}_${today}`), (snap) => {
      if (snap.exists()) {
        setTodayLog(snap.data() as DailyLog);
      }
    }, (error) => {
      // Non-critical, ignore if permissions pending
      console.warn("Log snapshot note:", error.message);
    });

    return () => unsubLog();
  }, [profile.uid, today]);

  // Real-time listener for shared goals
  useEffect(() => {
    if (!profile.uid || !partner.uid) return;

    const q = query(
      collection(db, 'shared_goals'),
      where('members', 'array-contains', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SharedGoal));
      
      // Filter to only goals shared between THIS pair of partners
      const pairGoals = list.filter(g => 
        (g.partner1Uid === profile.uid && g.partner2Uid === partner.uid) ||
        (g.partner2Uid === profile.uid && g.partner1Uid === partner.uid)
      );
      setGoals(pairGoals);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shared_goals');
    });

    return () => unsubscribe();
  }, [profile.uid, partner.uid]);

  const handleCreateGoal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!goalForm.title.trim() || !goalForm.targetValue || goalForm.targetValue <= 0) return;

    try {
      const newGoalData = {
        title: goalForm.title.trim(),
        category: goalForm.category,
        targetValue: Number(goalForm.targetValue),
        unit: goalForm.unit.trim() || 'units',
        partner1Uid: profile.uid,
        partner2Uid: partner.uid,
        members: [profile.uid, partner.uid],
        partner1Contribution: 0,
        partner2Contribution: 0,
        status: 'active' as const,
        createdBy: profile.uid,
        createdAt: new Date().toISOString(),
        ...(goalForm.endDate ? { endDate: goalForm.endDate } : {}),
        ...(goalForm.notes ? { notes: goalForm.notes.trim() } : {}),
      };

      await addDoc(collection(db, 'shared_goals'), newGoalData);
      setShowAddModal(false);
      setGoalForm({
        title: '',
        category: 'steps',
        targetValue: 100000,
        unit: 'steps',
        endDate: '',
        notes: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shared_goals');
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_GOALS[0]) => {
    setGoalForm({
      title: preset.title,
      category: preset.category,
      targetValue: preset.targetValue,
      unit: preset.unit,
      endDate: '',
      notes: preset.description,
    });
  };

  const handleContribute = async (goal: SharedGoal, amount: number) => {
    if (amount <= 0) return;

    const isPartner1 = goal.partner1Uid === profile.uid;
    const currentP1 = goal.partner1Contribution || 0;
    const currentP2 = goal.partner2Contribution || 0;

    const newP1 = isPartner1 ? currentP1 + amount : currentP1;
    const newP2 = !isPartner1 ? currentP2 + amount : currentP2;
    const newTotal = newP1 + newP2;
    const isNowCompleted = newTotal >= goal.targetValue;

    try {
      await updateDoc(doc(db, 'shared_goals', goal.id), {
        partner1Contribution: newP1,
        partner2Contribution: newP2,
        status: isNowCompleted ? 'completed' : goal.status
      });

      setContributeGoal(null);
      setContributionAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shared_goals/${goal.id}`);
    }
  };

  const handleSendCheer = async (goal: SharedGoal, cheerText: string) => {
    try {
      await updateDoc(doc(db, 'shared_goals', goal.id), {
        lastCheer: {
          senderUid: profile.uid,
          text: cheerText,
          time: new Date().toISOString(),
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shared_goals/${goal.id}`);
    }
  };

  const handleSyncToday = async (goal: SharedGoal) => {
    if (!todayLog) {
      setSyncSuccessMsg("No log recorded yet for today.");
      setTimeout(() => setSyncSuccessMsg(null), 3000);
      return;
    }

    let valueToSync = 0;
    if (goal.category === 'steps') valueToSync = todayLog.steps || 0;
    else if (goal.category === 'calories') valueToSync = todayLog.calories || 0;
    else if (goal.category === 'water') valueToSync = todayLog.water || 0;
    else if (goal.category === 'workouts') valueToSync = 1;

    if (valueToSync <= 0) {
      setSyncSuccessMsg(`No ${goal.unit} logged for today yet.`);
      setTimeout(() => setSyncSuccessMsg(null), 3000);
      return;
    }

    setSyncingToday(true);
    await handleContribute(goal, valueToSync);
    setSyncingToday(false);
    setSyncSuccessMsg(`Added +${valueToSync.toLocaleString()} ${goal.unit} from today!`);
    setTimeout(() => setSyncSuccessMsg(null), 3500);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm("Remove this shared goal?")) return;
    try {
      await deleteDoc(doc(db, 'shared_goals', goalId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shared_goals/${goalId}`);
    }
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const displayedGoals = activeFilter === 'active' ? activeGoals : completedGoals;

  const getCategoryIcon = (category: SharedGoal['category']) => {
    switch (category) {
      case 'steps': return Footprints;
      case 'workouts': return Dumbbell;
      case 'calories': return Flame;
      case 'water': return Droplets;
      case 'distance': return Zap;
      default: return Target;
    }
  };

  return (
    <div className="space-y-8" id="shared-fitness-goals-section">
      {/* Header & Filter Bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-serif font-bold text-white tracking-tight">Shared Goals</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-bold">
              {activeGoals.length} Active
            </span>
          </div>
          <p className="text-white/40 text-sm font-medium">Communal fitness quests with {partner.displayName || 'Partner'}</p>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          id="btn-add-shared-goal"
          className="flex items-center gap-2 bg-accent text-paper px-4 py-2.5 rounded-2xl font-bold text-sm hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-95"
        >
          <Plus size={18} />
          <span>New Goal</span>
        </button>
      </div>

      {/* Segmented Filter */}
      <div className="flex p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
        <button
          onClick={() => setActiveFilter('active')}
          id="tab-active-goals"
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeFilter === 'active' 
              ? 'bg-accent text-paper shadow-md' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          Active Quests ({activeGoals.length})
        </button>
        <button
          onClick={() => setActiveFilter('completed')}
          id="tab-completed-goals"
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeFilter === 'completed' 
              ? 'bg-accent text-paper shadow-md' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          Completed Trophies ({completedGoals.length})
        </button>
      </div>

      {/* Sync Toast Feedback */}
      {syncSuccessMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2"
        >
          <Sparkles size={16} />
          <span>{syncSuccessMsg}</span>
        </motion.div>
      )}

      {/* Goals List */}
      <div className="space-y-6">
        {displayedGoals.map((goal) => {
          const isPartner1 = goal.partner1Uid === profile.uid;
          const userContrib = isPartner1 ? (goal.partner1Contribution || 0) : (goal.partner2Contribution || 0);
          const partnerContrib = isPartner1 ? (goal.partner2Contribution || 0) : (goal.partner1Contribution || 0);
          const totalContrib = userContrib + partnerContrib;
          const target = goal.targetValue;
          const totalProgress = Math.min((totalContrib / target) * 100, 100);
          const userPercent = target > 0 ? Math.round((userContrib / target) * 100) : 0;
          const partnerPercent = target > 0 ? Math.round((partnerContrib / target) * 100) : 0;
          const CategoryIcon = getCategoryIcon(goal.category);
          const isCompleted = goal.status === 'completed' || totalContrib >= target;

          const partnerName = partner.displayName || 'Partner';
          const hasCheerFromPartner = goal.lastCheer && goal.lastCheer.senderUid === partner.uid;

          return (
            <div 
              key={goal.id} 
              id={`shared-goal-${goal.id}`}
              className="bg-white/5 backdrop-blur-md p-7 rounded-[2.5rem] border border-white/10 shadow-xl space-y-6 relative overflow-hidden"
            >
              {/* Partner cheer notification badge */}
              {hasCheerFromPartner && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-accent/15 border border-accent/30 rounded-2xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 text-accent font-bold">
                    <Heart size={15} className="fill-accent" />
                    <span>{partnerName} cheered: "{goal.lastCheer?.text}"</span>
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">
                    {goal.lastCheer?.time ? format(new Date(goal.lastCheer.time), 'HH:mm') : ''}
                  </span>
                </motion.div>
              )}

              {/* Goal Title & Status Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-accent/15 text-accent rounded-2xl flex items-center justify-center border border-accent/20">
                    <CategoryIcon size={24} />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-lg text-white tracking-tight">{goal.title}</h4>
                    <p className="text-white/40 text-xs font-semibold capitalize flex items-center gap-1.5">
                      <span>{goal.category}</span>
                      {goal.endDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-white/50">
                            <Calendar size={12} /> Target: {goal.endDate}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {isCompleted ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    <Trophy size={14} />
                    <span>Achieved!</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="text-lg font-bold text-white block">{totalProgress.toFixed(0)}%</span>
                    <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Together</span>
                  </div>
                )}
              </div>

              {/* Dual Combined Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-white/70">
                  <span>{totalContrib.toLocaleString()} / {target.toLocaleString()} {goal.unit}</span>
                  <span className="text-white/40">{Math.max(0, target - totalContrib).toLocaleString()} {goal.unit} remaining</span>
                </div>
                
                <div className="h-3.5 bg-white/10 rounded-full overflow-hidden flex p-0.5 gap-0.5">
                  {/* User portion */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((userContrib / target) * 100, 100)}%` }}
                    className="h-full bg-accent rounded-full shadow-sm"
                    title={`You: ${userContrib.toLocaleString()} ${goal.unit}`}
                  />
                  {/* Partner portion */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((partnerContrib / target) * 100, 100 - (userContrib / target) * 100)}%` }}
                    className="h-full bg-teal-400 rounded-full shadow-sm"
                    title={`${partnerName}: ${partnerContrib.toLocaleString()} ${goal.unit}`}
                  />
                </div>

                {/* Legend / Breakdown */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                      <span className="text-white/70 font-medium">You</span>
                    </div>
                    <span className="font-bold text-white">
                      {userContrib.toLocaleString()} <span className="text-[10px] text-accent font-semibold">({userPercent}%)</span>
                    </span>
                  </div>

                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                      <span className="text-white/70 font-medium truncate max-w-[70px]">{partnerName}</span>
                    </div>
                    <span className="font-bold text-white">
                      {partnerContrib.toLocaleString()} <span className="text-[10px] text-teal-300 font-semibold">({partnerPercent}%)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
                {!isCompleted && (
                  <>
                    <button
                      onClick={() => {
                        setContributeGoal(goal);
                        setContributionAmount('');
                      }}
                      id={`btn-contribute-${goal.id}`}
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 px-4 bg-accent text-paper font-bold text-xs rounded-xl hover:bg-accent/90 transition-all active:scale-95 shadow-md shadow-accent/20"
                    >
                      <Plus size={16} />
                      <span>Log Progress</span>
                    </button>

                    <button
                      onClick={() => handleSyncToday(goal)}
                      disabled={syncingToday}
                      id={`btn-sync-${goal.id}`}
                      className="flex items-center justify-center gap-1.5 py-3 px-3.5 bg-white/10 text-white hover:bg-white/15 font-bold text-xs rounded-xl transition-all active:scale-95"
                      title="Add your activity logged today"
                    >
                      <RefreshCw size={15} className={syncingToday ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">Sync Today</span>
                    </button>
                  </>
                )}

                {/* Cheer Partner dropdown / quick button */}
                <div className="relative group">
                  <button 
                    id={`btn-cheer-${goal.id}`}
                    className="flex items-center gap-1.5 py-3 px-3.5 bg-white/5 hover:bg-white/10 text-accent font-bold text-xs rounded-xl border border-white/10 transition-all"
                  >
                    <Sparkles size={15} />
                    <span>Cheer</span>
                  </button>
                  {/* Cheer Dropdown Menu */}
                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col bg-paper/95 backdrop-blur-xl border border-white/15 p-2 rounded-2xl shadow-2xl z-30 w-48 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-white/40 px-2 py-1">Send to {partnerName}</p>
                    {CHEER_MESSAGES.map((msg, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendCheer(goal, msg)}
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 rounded-xl transition-colors font-medium flex items-center gap-1.5"
                      >
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="p-2.5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all ml-auto"
                  title="Delete shared goal"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Goal Achieved Celebration Banner */}
              {isCompleted && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-accent/20 to-emerald-500/20 border border-accent/30 rounded-2xl p-4 flex items-center gap-3 text-white"
                >
                  <Award size={28} className="text-accent shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Goal Conquered Together! 🎉</p>
                    <p className="text-white/60 text-xs">You and {partnerName} reached {target.toLocaleString()} {goal.unit}.</p>
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {displayedGoals.length === 0 && (
          <div className="text-center py-16 px-6 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 space-y-6">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Trophy size={32} />
            </div>
            <div className="max-w-xs mx-auto space-y-2">
              <h4 className="font-serif font-bold text-xl text-white">
                {activeFilter === 'active' ? 'No Active Shared Goals' : 'No Completed Goals Yet'}
              </h4>
              <p className="text-white/40 text-sm font-medium">
                {activeFilter === 'active' 
                  ? `Set a communal fitness challenge with ${partner.displayName || 'your partner'} to start building momentum!`
                  : 'Complete a shared fitness quest together to unlock your first trophy!'}
              </p>
            </div>

            {activeFilter === 'active' && (
              <div className="pt-2">
                <p className="text-xs uppercase font-bold text-white/40 tracking-wider mb-4">Quick Start Challenges</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto text-left">
                  {PRESET_GOALS.slice(0, 2).map((preset, idx) => {
                    const Icon = preset.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          handleSelectPreset(preset);
                          setShowAddModal(true);
                        }}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 active:scale-98"
                      >
                        <div className="p-2.5 bg-accent/20 text-accent rounded-xl">
                          <Icon size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-white">{preset.title}</p>
                          <p className="text-[11px] text-white/40">{preset.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Log Contribution */}
      <AnimatePresence>
        {contributeGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0B2B26] border border-white/15 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-bold text-xl text-white">Log Your Contribution</h4>
                  <p className="text-white/40 text-xs font-medium">{contributeGoal.title}</p>
                </div>
                <button 
                  onClick={() => setContributeGoal(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Increment Chips */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase font-bold text-white/40 tracking-wider">Quick Add</span>
                <div className="flex flex-wrap gap-2">
                  {contributeGoal.category === 'steps' && [1000, 2500, 5000, 10000].map(val => (
                    <button
                      key={val}
                      onClick={() => setContributionAmount(val)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-accent hover:text-paper text-white font-bold text-xs border border-white/10 transition-colors"
                    >
                      +{val.toLocaleString()}
                    </button>
                  ))}
                  {contributeGoal.category === 'calories' && [100, 250, 500, 800].map(val => (
                    <button
                      key={val}
                      onClick={() => setContributionAmount(val)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-accent hover:text-paper text-white font-bold text-xs border border-white/10 transition-colors"
                    >
                      +{val} kcal
                    </button>
                  ))}
                  {contributeGoal.category === 'workouts' && [1, 2].map(val => (
                    <button
                      key={val}
                      onClick={() => setContributionAmount(val)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-accent hover:text-paper text-white font-bold text-xs border border-white/10 transition-colors"
                    >
                      +{val} workout
                    </button>
                  ))}
                  {contributeGoal.category === 'water' && [250, 500, 1000].map(val => (
                    <button
                      key={val}
                      onClick={() => setContributionAmount(val)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-accent hover:text-paper text-white font-bold text-xs border border-white/10 transition-colors"
                    >
                      +{val} ml
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/60">Amount ({contributeGoal.unit})</label>
                <input
                  type="number"
                  placeholder={`e.g. 5000`}
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-bold text-white focus:outline-none focus:border-accent text-lg"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setContributeGoal(null)}
                  className="flex-1 py-3.5 bg-white/5 text-white/60 hover:text-white font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!contributionAmount || Number(contributionAmount) <= 0}
                  onClick={() => handleContribute(contributeGoal, Number(contributionAmount))}
                  className="flex-1 py-3.5 bg-accent text-paper font-bold text-xs rounded-xl hover:bg-accent/90 disabled:opacity-40 shadow-lg shadow-accent/20"
                >
                  Add to Goal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Create New Shared Goal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0B2B26] border border-white/15 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl space-y-6 my-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-bold text-2xl text-white">New Shared Goal</h4>
                  <p className="text-white/40 text-xs font-medium">Challenge with {partner.displayName || 'Partner'}</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Pre-fill Preset Buttons */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase font-bold text-white/40 tracking-wider">Quick Presets</span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_GOALS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3 rounded-xl text-left border text-xs font-bold transition-all ${
                        goalForm.title === preset.title
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form fields */}
              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/60">Goal Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100,000 Steps Together"
                    value={goalForm.title}
                    onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                    className="w-full p-3.5 bg-white/5 rounded-xl border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/60">Category</label>
                    <select
                      value={goalForm.category}
                      onChange={(e) => {
                        const cat = e.target.value as SharedGoal['category'];
                        let defUnit = 'units';
                        if (cat === 'steps') defUnit = 'steps';
                        else if (cat === 'workouts') defUnit = 'workouts';
                        else if (cat === 'calories') defUnit = 'kcal';
                        else if (cat === 'water') defUnit = 'ml';
                        else if (cat === 'distance') defUnit = 'km';
                        setGoalForm({ ...goalForm, category: cat, unit: defUnit });
                      }}
                      className="w-full p-3.5 bg-white/5 rounded-xl border border-white/10 text-white text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="steps" className="bg-[#0B2B26] text-white">Steps</option>
                      <option value="workouts" className="bg-[#0B2B26] text-white">Workouts</option>
                      <option value="calories" className="bg-[#0B2B26] text-white">Calories</option>
                      <option value="water" className="bg-[#0B2B26] text-white">Water</option>
                      <option value="distance" className="bg-[#0B2B26] text-white">Distance</option>
                      <option value="custom" className="bg-[#0B2B26] text-white">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/60">Unit</label>
                    <input
                      type="text"
                      required
                      placeholder="steps, kcal, km"
                      value={goalForm.unit}
                      onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                      className="w-full p-3.5 bg-white/5 rounded-xl border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/60">Target Value</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="100000"
                      value={goalForm.targetValue || ''}
                      onChange={(e) => setGoalForm({ ...goalForm, targetValue: Number(e.target.value) })}
                      className="w-full p-3.5 bg-white/5 rounded-xl border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/60">Target Date (Optional)</label>
                    <input
                      type="date"
                      value={goalForm.endDate}
                      onChange={(e) => setGoalForm({ ...goalForm, endDate: e.target.value })}
                      className="w-full p-3.5 bg-white/5 rounded-xl border border-white/10 text-white text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/60">Partner Motivation Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Let's finish this before Sunday dinner!"
                    value={goalForm.notes}
                    onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
                    className="w-full p-3.5 bg-white/5 rounded-xl border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3.5 bg-white/5 text-white/60 hover:text-white font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-accent text-paper font-bold text-xs rounded-xl hover:bg-accent/90 shadow-lg shadow-accent/20"
                  >
                    Create Quest
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
