export type Priority = 'High' | 'Medium' | 'Low';
export type ScheduleHealth = 'ON_TRACK' | 'SLIPPING' | 'CRITICAL';
export type EnergyLevel = 'High' | 'Medium' | 'Low';

export interface Task {
  id: string;
  title: string;
  startTime: string; // HH:mm format
  duration: number; // in minutes
  actualDuration?: number; // Time Audit
  priority: Priority;
  completed: boolean;
  category: string;
  energyRequired?: EnergyLevel;
}

export interface UserStats {
  streak: number;
  lastCompletedDate: string;
  xp: number;
  level: number;
  unlockedBadges: string[];
}
