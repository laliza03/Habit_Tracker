import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Settings as SettingsIcon, Link as LinkIcon, Activity, UserPlus, Save, Users, Target, Smartphone, Sparkles, Plus, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileInstallPrompt from './MobileInstallPrompt';

export default function Settings({ profile }: { profile: UserProfile }) {
  const [partnerEmail, setPartnerEmail] = useState('');
  const [goals, setGoals] = useState({
    stepGoal: profile.stepGoal || 10000,
    waterGoal: profile.waterGoal || 2000,
    calorieGoal: profile.calorieGoal || 2000,
  });
  const [saving, setSaving] = useState(false);
  const [savingSupplements, setSavingSupplements] = useState(false);
  const [supplementsList, setSupplementsList] = useState<string[]>(() => {
    return profile.supplements && profile.supplements.length > 0
      ? profile.supplements
      : ['creatine', 'biotin', 'omega', 'magnesium'];
  });
  const [newSupplementInput, setNewSupplementInput] = useState('');
  const [supplementSuccessMsg, setSupplementSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile.supplements && profile.supplements.length > 0) {
      setSupplementsList(profile.supplements);
    }
  }, [profile.supplements]);

  const handleSaveGoals = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), goals);
      alert('Goals updated!');
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSupplement = async () => {
    const trimmed = newSupplementInput.trim().toLowerCase();
    if (!trimmed) return;
    if (supplementsList.includes(trimmed)) {
      alert(`"${trimmed}" is already in your supplements list.`);
      return;
    }

    const updated = [...supplementsList, trimmed];
    setSupplementsList(updated);
    setNewSupplementInput('');

    setSavingSupplements(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { supplements: updated });
      setSupplementSuccessMsg(`Added ${trimmed}!`);
      setTimeout(() => setSupplementSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Error saving supplement:", err);
    } finally {
      setSavingSupplements(false);
    }
  };

  const handleDeleteSupplement = async (itemToDelete: string) => {
    const updated = supplementsList.filter(s => s !== itemToDelete);
    setSupplementsList(updated);

    setSavingSupplements(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { supplements: updated });
      setSupplementSuccessMsg(`Removed ${itemToDelete}`);
      setTimeout(() => setSupplementSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Error deleting supplement:", err);
    } finally {
      setSavingSupplements(false);
    }
  };

  const handleLinkPartner = async () => {
    if (!partnerEmail) return;
    try {
      const emailDoc = await getDoc(doc(db, 'email_to_uid', partnerEmail.toLowerCase()));
      if (!emailDoc.exists()) {
        alert('Partner not found. Make sure they have signed up for HabitHub.');
        return;
      }
      const partnerUid = emailDoc.data().uid;
      await updateDoc(doc(db, 'users', profile.uid), { partnerUid });
      alert('Partner link requested! Your partner must also enter your email to complete the link.');
    } catch (error) {
      console.error('Link error:', error);
    }
  };

  const connectFitbit = async () => {
    try {
      const response = await fetch('/api/auth/fitbit/url');
      const { url } = await response.json();
      window.open(url, 'fitbit_oauth', 'width=600,height=700');
    } catch (error) {
      console.error('Fitbit auth error:', error);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FITBIT_AUTH_SUCCESS') {
        const { access_token, refresh_token, user_id } = event.data.payload;
        updateDoc(doc(db, 'user_private', profile.uid), {
          fitbitAccessToken: access_token,
          fitbitRefreshToken: refresh_token,
          fitbitUserId: user_id
        }).then(() => alert('Fitbit connected!'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [profile.uid]);

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-accent uppercase tracking-widest block mb-1">Preferences</span>
          <h2 className="text-3xl sm:text-4xl font-serif font-extrabold text-white tracking-tight">Settings</h2>
        </div>
      </div>

      <section className="space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
            <Activity size={16} />
          </div>
          <h3 className="text-xl font-serif font-bold text-white tracking-tight">Daily Targets</h3>
        </div>
        <div className="glass-card p-7 sm:p-8 rounded-[2.2rem] space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">Step Goal</label>
            <input 
              type="number" 
              className="w-full p-4 bg-black/40 rounded-2xl border border-white/10 font-bold focus:border-accent text-white placeholder:text-white/30 focus:outline-none"
              value={goals.stepGoal}
              onChange={e => setGoals({ ...goals, stepGoal: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">Water Goal (ml)</label>
            <input 
              type="number" 
              className="w-full p-4 bg-black/40 rounded-2xl border border-white/10 font-bold focus:border-accent text-white placeholder:text-white/30 focus:outline-none"
              value={goals.waterGoal}
              onChange={e => setGoals({ ...goals, waterGoal: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">Calorie Goal</label>
            <input 
              type="number" 
              className="w-full p-4 bg-black/40 rounded-2xl border border-white/10 font-bold focus:border-accent text-white placeholder:text-white/30 focus:outline-none"
              value={goals.calorieGoal}
              onChange={e => setGoals({ ...goals, calorieGoal: Number(e.target.value) })}
            />
          </div>
          <button 
            onClick={handleSaveGoals}
            disabled={saving}
            className="w-full py-4 bg-accent text-paper rounded-2xl font-extrabold flex items-center justify-center gap-2.5 shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Goals'}
          </button>
        </div>
      </section>

      {/* Supplement Routine Management */}
      <section className="space-y-6" id="settings-supplements-section">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-serif font-bold text-white flex items-center gap-3">
            <Sparkles size={20} className="text-accent" />
            My Supplement List
          </h3>
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
            {supplementsList.length} Active
          </span>
        </div>

        <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm space-y-6">
          <p className="text-white/60 text-sm font-medium">
            Customize the list of supplements you want to take daily. Any item added or removed here is automatically updated on your Daily Dashboard.
          </p>

          {/* Add New Supplement Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Vitamin D3, Zinc, Ashwagandha..."
              value={newSupplementInput}
              onChange={(e) => setNewSupplementInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSupplement();
                }
              }}
              className="flex-1 p-4 bg-white/5 rounded-2xl border-none font-medium focus:ring-2 focus:ring-accent text-white placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={handleAddSupplement}
              disabled={!newSupplementInput.trim() || savingSupplements}
              className="px-6 py-4 bg-accent text-paper rounded-2xl font-bold flex items-center gap-2 hover:bg-accent/90 transition-all disabled:opacity-40 active:scale-95 shadow-md shadow-accent/20 shrink-0"
            >
              <Plus size={18} />
              <span>Add</span>
            </button>
          </div>

          {/* Toast message */}
          {supplementSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2"
            >
              <Check size={14} />
              <span>{supplementSuccessMsg}</span>
            </motion.div>
          )}

          {/* List of current supplements with delete buttons */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-white/30 uppercase tracking-widest ml-1 block">
              Current Supplements
            </label>
            {supplementsList.length === 0 ? (
              <p className="text-white/40 text-sm py-4 italic">No supplements configured. Add one above!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {supplementsList.map((supp) => (
                  <div
                    key={supp}
                    className="p-3.5 px-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:border-white/20 transition-all"
                  >
                    <span className="capitalize font-bold text-white text-sm">{supp}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSupplement(supp)}
                      disabled={savingSupplements}
                      title={`Remove ${supp}`}
                      className="p-2 text-white/30 hover:text-rose-400 hover:bg-rose-500/15 rounded-xl transition-all active:scale-95"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-serif font-bold text-white flex items-center gap-3">
          <LinkIcon size={20} className="text-accent" />
          Integrations
        </h3>
        <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-serif font-bold text-lg text-white">Fitbit</p>
              <p className="text-sm text-white/40">
                {profile.fitbitUserId ? 'Connected successfully' : 'Not connected yet'}
              </p>
            </div>
            <button 
              onClick={connectFitbit}
              className={`px-8 py-3 rounded-xl font-bold transition-all active:scale-95 ${
                profile.fitbitUserId 
                  ? 'bg-white/10 text-white/60' 
                  : 'bg-accent text-paper shadow-lg shadow-accent/20 hover:bg-accent/90'
              }`}
            >
              {profile.fitbitUserId ? 'Reconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-serif font-bold text-white flex items-center gap-3">
          <Users size={20} className="text-accent" />
          Partner Link
        </h3>
        <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm space-y-6">
          <p className="text-white/50 font-medium">Enter your partner's email to link your accounts and track progress together.</p>
          <input 
            type="email" 
            placeholder="Partner's Email" 
            className="w-full p-4 bg-white/5 rounded-2xl border-none font-medium focus:ring-2 focus:ring-accent text-white placeholder:text-white/30"
            value={partnerEmail}
            onChange={e => setPartnerEmail(e.target.value)}
          />
          <button 
            onClick={handleLinkPartner}
            className="w-full py-5 bg-accent text-paper rounded-2xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all active:scale-[0.98]"
          >
            Link Partner
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-serif font-bold text-white flex items-center gap-3">
          <Smartphone size={20} className="text-accent" />
          Mobile Application (iOS & Android)
        </h3>
        <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm space-y-4">
          <p className="text-white/60 text-sm font-medium">
            HabitHub is designed as a full mobile application for both iPhone (iOS) and Android devices. Install it directly to your device for full-screen immersive tracking and instantaneous updates.
          </p>
          <MobileInstallPrompt compact={true} />
        </div>
      </section>
    </div>
  );
}
