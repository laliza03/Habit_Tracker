export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  partnerUid?: string;
  fitbitAccessToken?: string;
  fitbitRefreshToken?: string;
  fitbitUserId?: string;
  calorieGoal?: number;
  stepGoal?: number;
  waterGoal?: number;
}

export interface Habit {
  id: string;
  name: string;
  type: 'numeric' | 'boolean';
  unit?: string;
  target: number;
  ownerUid: string;
}

export interface DailyLog {
  uid: string;
  date: string; // YYYY-MM-DD
  steps: number;
  water: number;
  calories: number;
  supplements: { [key: string]: boolean };
  affirmations: boolean;
  completedAll: boolean;
}

export interface MonthlyGoal {
  uid: string;
  month: string; // YYYY-MM
  goalType: string;
  targetValue: number;
  currentValue: number;
}
