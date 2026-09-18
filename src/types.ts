export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  partnerUid?: string;
  calorieGoal?: number;
  stepGoal?: number;
  waterGoal?: number;
  supplements?: string[];
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
  customGoals?: { [goalId: string]: number };
}

export interface MonthlyGoal {
  uid: string;
  month: string; // YYYY-MM
  goalType: string;
  targetValue: number;
  currentValue: number;
}

export interface SharedGoal {
  id: string;
  title: string;
  category: 'steps' | 'calories' | 'workouts' | 'distance' | 'water' | 'active_minutes' | 'custom';
  targetValue: number;
  unit: string;
  partner1Uid: string;
  partner2Uid: string;
  members: string[];
  partner1Contribution: number;
  partner2Contribution: number;
  status: 'active' | 'completed';
  createdBy: string;
  createdAt: string;
  endDate?: string;
  notes?: string;
  lastCheer?: {
    senderUid: string;
    text: string;
    time: string;
  };
}
