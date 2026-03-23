import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Settings as SettingsIcon, Link as LinkIcon, Activity, UserPlus, Save, Users, Target } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Settings({ profile }: { profile: UserProfile }) {
  const [partnerEmail, setPartnerEmail] = useState('');
  const [goals, setGoals] = useState({
    stepGoal: profile.stepGoal || 10000,
    waterGoal: profile.waterGoal || 2000,
    calorieGoal: profile.calorieGoal || 2000,
  });
  const [saving, setSaving] = useState(false);

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

  const handleLinkPartner = async () => {
    if (!partnerEmail) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', partnerEmail));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert('Partner not found. Make sure they have signed up for HabitHub.');
        return;
      }
      const partnerData = snapshot.docs[0].data() as UserProfile;
      await updateDoc(doc(db, 'users', profile.uid), { partnerUid: partnerData.uid });
      await updateDoc(doc(db, 'users', partnerData.uid), { partnerUid: profile.uid });
      alert('Partner linked successfully!');
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
        updateDoc(doc(db, 'users', profile.uid), {
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
      <h2 className="text-3xl font-serif font-bold text-white tracking-tight">Settings</h2>

      <section className="space-y-6">
        <h3 className="text-xl font-serif font-bold text-white flex items-center gap-3">
          <Activity size={20} className="text-accent" />
          Daily Targets
        </h3>
        <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/30 uppercase tracking-widest ml-1">Step Goal</label>
            <input 
              type="number" 
              className="w-full p-4 bg-white/5 rounded-2xl border-none font-medium focus:ring-2 focus:ring-accent text-white placeholder:text-white/30"
              value={goals.stepGoal}
              onChange={e => setGoals({ ...goals, stepGoal: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/30 uppercase tracking-widest ml-1">Water Goal (ml)</label>
            <input 
              type="number" 
              className="w-full p-4 bg-white/5 rounded-2xl border-none font-medium focus:ring-2 focus:ring-accent text-white placeholder:text-white/30"
              value={goals.waterGoal}
              onChange={e => setGoals({ ...goals, waterGoal: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/30 uppercase tracking-widest ml-1">Calorie Goal</label>
            <input 
              type="number" 
              className="w-full p-4 bg-white/5 rounded-2xl border-none font-medium focus:ring-2 focus:ring-accent text-white placeholder:text-white/30"
              value={goals.calorieGoal}
              onChange={e => setGoals({ ...goals, calorieGoal: Number(e.target.value) })}
            />
          </div>
          <button 
            onClick={handleSaveGoals}
            disabled={saving}
            className="w-full py-5 bg-accent text-paper rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Goals'}
          </button>
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
    </div>
  );
}
