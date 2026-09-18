import { DailyLog, MonthlyGoal, UserProfile } from './types';

const key = (name: string) => `habithub_local_${name}`;

export const isGuestProfile = (profile: UserProfile) => profile.uid.startsWith('guest_');

function read<T>(storageKey: string, fallback: T): T {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(storageKey: string, value: T) {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

export function readGuestLog(profile: UserProfile, date: string): DailyLog {
  const fallback: DailyLog = {
    uid: profile.uid,
    date,
    steps: 0,
    water: 0,
    calories: 0,
    supplements: Object.fromEntries((profile.supplements || []).map((name) => [name, false])),
    affirmations: false,
    completedAll: false,
    customGoals: {},
  };
  const stored = read(key(`log_${profile.uid}_${date}`), fallback);
  const configuredSupplements = new Set(profile.supplements || []);
  const storedSupplements = Object.fromEntries(
    Object.entries(stored.supplements || {}).filter(([name]) => configuredSupplements.has(name)),
  );
  return {
    ...fallback,
    ...stored,
    supplements: { ...fallback.supplements, ...storedSupplements },
  };
}

export function writeGuestLog(log: DailyLog) {
  write(key(`log_${log.uid}_${log.date}`), log);
}

export type StoredGoal = MonthlyGoal & { id: string };

export function readGuestGoals(profile: UserProfile, month: string): StoredGoal[] {
  return read<StoredGoal[]>(key(`goals_${profile.uid}`), []).filter((goal) => goal.month === month);
}

export function writeGuestGoals(profile: UserProfile, goals: StoredGoal[]) {
  write(key(`goals_${profile.uid}`), goals);
}

export function updateGuestProfile(profile: UserProfile, changes: Partial<UserProfile>): UserProfile {
  const updated = { ...profile, ...changes };
  write('active_profile', updated);
  localStorage.setItem('habithub_active_profile', JSON.stringify(updated));
  return updated;
}
