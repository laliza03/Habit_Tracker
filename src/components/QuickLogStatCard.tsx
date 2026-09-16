import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Check, X } from 'lucide-react';

interface QuickLogOptions {
  label: string;
  amount: number;
}

interface QuickLogStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  quickOptions: QuickLogOptions[];
  onAdd: (amount: number) => void;
  onSet: (exactValue: number) => void;
}

export default function QuickLogStatCard({
  icon,
  label,
  value,
  target,
  unit,
  color,
  quickOptions,
  onAdd,
  onSet,
}: QuickLogStatCardProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const [recentAdded, setRecentAdded] = useState<number | null>(null);

  const progress = Math.min((value / target) * 100, 100);

  const handleQuickAdd = (amount: number) => {
    onAdd(amount);
    setRecentAdded(amount);
    setTimeout(() => setRecentAdded(null), 1200);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(customVal);
    if (!isNaN(num) && num >= 0) {
      onSet(Math.round(num));
      setShowCustomInput(false);
      setCustomVal('');
    }
  };

  const isComplete = value >= target;

  return (
    <div className="glass-card-interactive p-6 sm:p-7 rounded-[2.2rem] relative overflow-hidden group">
      {/* Subtle ambient radial glow based on completion */}
      <div 
        className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-20 transition-opacity group-hover:opacity-35"
        style={{
          background: isComplete 
            ? 'radial-gradient(circle, rgba(52, 211, 153, 0.8) 0%, transparent 70%)' 
            : 'radial-gradient(circle, rgba(232, 155, 181, 0.6) 0%, transparent 70%)'
        }}
      />

      {/* Top Header & Values */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-sm group-hover:scale-105 transition-transform">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-lg text-white tracking-tight">{label}</span>
              <AnimatePresence>
                {recentAdded !== null && (
                  <motion.span
                    initial={{ opacity: 0, y: -4, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.8 }}
                    className="text-[11px] font-bold text-accent px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 shadow-sm"
                  >
                    +{recentAdded.toLocaleString()} {unit}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <p className="text-xs font-semibold text-white/45">
              Goal: {target.toLocaleString()} {unit}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-baseline gap-1 justify-end">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums font-sans">
              {value.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-white/45 uppercase tracking-wider">{unit}</span>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isComplete ? 'text-emerald-400' : 'text-white/40'}`}>
            {isComplete ? '✓ Goal reached' : `${Math.round(progress)}% done`}
          </span>
        </div>
      </div>

      {/* Progress Bar with modern gradient track */}
      <div className="h-2.5 bg-black/30 rounded-full overflow-hidden mb-5 p-0.5 border border-white/10 relative z-10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full ${color} rounded-full shadow-sm relative overflow-hidden`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-60 animate-pulse" />
        </motion.div>
      </div>

      {/* Direct Manual Quick-Log Tap Buttons */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Quick Add
          </span>
          <button
            type="button"
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="text-[11px] font-bold text-accent hover:text-white transition-colors flex items-center gap-1"
          >
            {showCustomInput ? 'Close' : 'Set Exact Value'}
          </button>
        </div>

        {showCustomInput ? (
          <form onSubmit={handleCustomSubmit} className="flex gap-2 pt-1">
            <input
              type="number"
              placeholder={`Enter exact ${unit}...`}
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-paper font-bold text-xs rounded-xl shadow-md hover:bg-accent/90 flex items-center gap-1 shrink-0 active:scale-95"
            >
              <Check size={14} />
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowCustomInput(false)}
              className="p-2 bg-white/10 text-white/60 hover:text-white rounded-xl shrink-0 active:scale-95"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {quickOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleQuickAdd(opt.amount)}
                className="py-2.5 px-2 bg-white/5 hover:bg-accent hover:text-paper active:scale-95 border border-white/10 hover:border-transparent rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 group/btn shadow-sm"
              >
                <div className="flex items-center text-accent group-hover/btn:text-paper font-extrabold text-xs transition-colors">
                  <Plus size={11} className="stroke-[3]" />
                  <span>{opt.label}</span>
                </div>
                <span className="text-[9px] text-white/40 group-hover/btn:text-paper/70 font-bold tracking-tight">
                  {unit}
                </span>
              </button>
            ))}

            {/* Decrement or Undo Option (-1 unit / step) */}
            <button
              type="button"
              onClick={() => onAdd(-quickOptions[0].amount)}
              disabled={value <= 0}
              title={`Subtract ${quickOptions[0].label}`}
              className="py-2.5 px-2 bg-white/5 hover:bg-rose-500/20 active:scale-95 disabled:opacity-20 border border-white/10 hover:border-rose-500/30 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 text-white/40 hover:text-rose-300"
            >
              <div className="flex items-center font-bold text-xs">
                <Minus size={11} className="stroke-[3]" />
                <span>{quickOptions[0].label}</span>
              </div>
              <span className="text-[9px] text-white/30 font-medium tracking-tight">undo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
