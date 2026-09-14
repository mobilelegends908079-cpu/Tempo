import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2, Plus, Trash2, Settings, User, Camera,
  Sparkles, Clock, Calendar, Flame, Award, ShieldAlert,
  BookOpen, Heart, Briefcase, Home, Globe, UserCheck,
  Play, Pause, RotateCcw, FileText, ChevronRight, ChevronLeft, AlertCircle, Volume2, History,
  Trophy, Lock, Target, BarChart3, ListChecks, Search, Download, Upload,
  Repeat, Tag, ChevronDown, ChevronUp, Bell, Droplet, Dumbbell, Sun, Moon, Zap
} from 'lucide-react';

/* =========================================================================
   TYPES
   ========================================================================= */

type Category = 'دراسة' | 'صحة' | 'شخصي' | 'منزلي' | 'عمل' | 'عام';
type Difficulty = 'سهل' | 'متوسط' | 'صعب';
type Priority = 'منخفض' | 'متوسط' | 'عالي' | 'عاجل';
type PlanTier = 'must' | 'should' | 'if' | null;
type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

interface Task {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
  category: Category;
  difficulty: Difficulty;
  priority: Priority;
  deadline: string;
  failed?: boolean;
  tags: string[];
  subtasks: Subtask[];
  estimatedMinutes?: number;
  actualMinutes?: number;
  recurrence: RecurrenceType;
  createdAt: string;
  completedAt?: string;
  planTier: PlanTier;
}

interface Habit {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  completedDates: string[]; // yyyy-mm-dd
}

interface FocusSession {
  id: string;
  taskId?: string;
  taskText?: string;
  minutes: number;
  date: string; // ISO
}

interface JournalPage {
  id: string;
  date: string;
  content: string;
  pageNumber: number;
  mood?: string;
  energy?: number; // 1-5
  sleep?: number; // hours
  win?: string;
  problem?: string;
  tomorrowGoal?: string;
}

interface Achievement {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: React.ReactNode;
  check: (s: Stats) => boolean;
}

interface Stats {
  totalCompleted: number;
  streak: number;
  bestStreak: number;
  focusSessionsCount: number;
  totalFocusMinutes: number;
  perfectDays: number;
  journalPages: number;
  habitsMaxStreak: number;
}

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const DIFFICULTY_XP: Record<Difficulty, number> = { 'سهل': 10, 'متوسط': 25, 'صعب': 40 };
const PRIORITY_WEIGHT: Record<Priority, number> = { 'منخفض': 1, 'متوسط': 2, 'عالي': 3, 'عاجل': 4 };
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { 'سهل': 1, 'متوسط': 2, 'صعب': 3 };

const FOCUS_PRESETS = [
  { label: '25 / 5', work: 25, brk: 5 },
  { label: '50 / 10', work: 50, brk: 10 },
  { label: '90 / 20', work: 90, brk: 20 },
];

const DEFAULT_HABIT_ICONS: Record<string, React.ReactNode> = {
  water: <Droplet className="w-4 h-4" />,
  study: <BookOpen className="w-4 h-4" />,
  exercise: <Dumbbell className="w-4 h-4" />,
  sleep: <Moon className="w-4 h-4" />,
  sun: <Sun className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
};

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function xpForLevel(level: number) {
  // XP required to go from `level` to `level+1`
  return 100 + (level - 1) * 40;
}

function levelFromTotalXp(totalXp: number) {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, currentLevelXp: remaining, neededForNext: xpForLevel(level) };
}

function priorityScore(t: Task) {
  const now = new Date().getTime();
  const deadline = new Date(t.deadline).getTime();
  const hoursLeft = (deadline - now) / 36e5;
  let urgency = 0;
  if (hoursLeft <= 0) urgency = 10;
  else if (hoursLeft < 3) urgency = 8;
  else if (hoursLeft < 12) urgency = 6;
  else if (hoursLeft < 24) urgency = 4;
  else if (hoursLeft < 72) urgency = 2;
  return urgency + PRIORITY_WEIGHT[t.priority] * 2 + DIFFICULTY_WEIGHT[t.difficulty];
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step', titleAr: 'الخطوة الأولى', titleEn: 'First Step',
    descAr: 'أنجز أول مهمة لك', descEn: 'Complete your first task',
    icon: <Trophy className="w-5 h-5" />, check: s => s.totalCompleted >= 1,
  },
  {
    id: 'on_fire', titleAr: 'مشتعل', titleEn: 'On Fire',
    descAr: 'سلسلة 7 أيام متتالية', descEn: '7-day streak',
    icon: <Flame className="w-5 h-5" />, check: s => s.bestStreak >= 7,
  },
  {
    id: 'disciplined', titleAr: 'منضبط', titleEn: 'Disciplined',
    descAr: 'سلسلة 30 يوم متتالية', descEn: '30-day streak',
    icon: <Award className="w-5 h-5" />, check: s => s.bestStreak >= 30,
  },
  {
    id: 'deep_worker', titleAr: 'عامل عميق', titleEn: 'Deep Worker',
    descAr: '10 جلسات تركيز', descEn: '10 Focus sessions',
    icon: <Clock className="w-5 h-5" />, check: s => s.focusSessionsCount >= 10,
  },
  {
    id: 'scholar', titleAr: 'باحث', titleEn: 'Scholar',
    descAr: 'أنجز 50 مهمة', descEn: 'Complete 50 tasks',
    icon: <BookOpen className="w-5 h-5" />, check: s => s.totalCompleted >= 50,
  },
  {
    id: 'perfect_day', titleAr: 'يوم مثالي', titleEn: 'Perfect Day',
    descAr: 'أنجز كل مهامك في يوم واحد', descEn: 'Complete every planned task in a day',
    icon: <Target className="w-5 h-5" />, check: s => s.perfectDays >= 1,
  },
  {
    id: 'writer', titleAr: 'كاتب', titleEn: 'Writer',
    descAr: 'اكتب 10 صفحات يوميات', descEn: 'Write 10 journal pages',
    icon: <FileText className="w-5 h-5" />, check: s => s.journalPages >= 10,
  },
  {
    id: 'habit_master', titleAr: 'سيد العادات', titleEn: 'Habit Master',
    descAr: 'حافظ على عادة لمدة 14 يوم', descEn: 'Keep a habit streak for 14 days',
    icon: <Repeat className="w-5 h-5" />, check: s => s.habitsMaxStreak >= 14,
  },
];

/* =========================================================================
   MAIN APP
   ========================================================================= */

export default function App() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const [lang, setLang] = useState<'ar' | 'en'>(() => (localStorage.getItem('tempo_lang') as any) || 'ar');
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'notes' | 'habits' | 'stats' | 'achievements' | 'planner'>('home');

  const [userName, setUserName] = useState<string>(() => localStorage.getItem('tempo_user_name') || 'User');
  const [userAvatar, setUserAvatar] = useState<string>(() => localStorage.getItem('tempo_user_avatar') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop');
  const [draftName, setDraftName] = useState(userName);
  const [draftAvatar, setDraftAvatar] = useState(userAvatar);

  /* ---------- Gamification ---------- */
  const [streak, setStreak] = useState<number>(() => Number(localStorage.getItem('tempo_streak')) || 0);
  const [bestStreak, setBestStreak] = useState<number>(() => Number(localStorage.getItem('tempo_best_streak')) || 0);
  const [totalXp, setTotalXp] = useState<number>(() => Number(localStorage.getItem('tempo_total_xp')) || 0);
  const [lastStreakDay, setLastStreakDay] = useState<string>(() => localStorage.getItem('tempo_last_streak_day') || '');
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tempo_achievements') || '[]'); } catch { return []; }
  });
  const [newAchievementToast, setNewAchievementToast] = useState<Achievement | null>(null);

  /* ---------- Tasks ---------- */
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { return JSON.parse(localStorage.getItem('tempo_tasks') || '[]'); } catch { return []; }
  });
  const [failedTasks, setFailedTasks] = useState<Task[]>(() => {
    try { return JSON.parse(localStorage.getItem('tempo_failed_tasks') || '[]'); } catch { return []; }
  });
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  /* ---------- Habits ---------- */
  const [habits, setHabits] = useState<Habit[]>(() => {
    try { return JSON.parse(localStorage.getItem('tempo_habits') || '[]'); } catch { return []; }
  });
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState<string>('study');

  /* ---------- Focus ---------- */
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>(() => {
    try { return JSON.parse(localStorage.getItem('tempo_focus_sessions') || '[]'); } catch { return []; }
  });
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusPreset, setFocusPreset] = useState(FOCUS_PRESETS[0]);
  const [customWorkMin, setCustomWorkMin] = useState(25);
  const [focusTimeLeft, setFocusTimeLeft] = useState(25 * 60);
  const [isFocusRunning, setIsFocusRunning] = useState(false);
  const [focusLinkedTaskId, setFocusLinkedTaskId] = useState<string>('');
  const focusStartedWithMinutes = useRef(25);

  /* ---------- Journal ---------- */
  const [notes, setNotes] = useState<string>(() => localStorage.getItem('tempo_notes_draft') || '');
  const [journalHistory, setJournalHistory] = useState<JournalPage[]>(() => {
    try { return JSON.parse(localStorage.getItem('tempo_journal_history') || '[]'); } catch { return []; }
  });
  const [journalMood, setJournalMood] = useState('🙂');
  const [journalEnergy, setJournalEnergy] = useState(3);
  const [journalSleep, setJournalSleep] = useState(7);
  const [journalWin, setJournalWin] = useState('');
  const [journalProblem, setJournalProblem] = useState('');
  const [journalTomorrow, setJournalTomorrow] = useState('');
  const [journalSearch, setJournalSearch] = useState('');

  /* ---------- New Task Form ---------- */
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<Category>('دراسة');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState<Difficulty>('متوسط');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('متوسط');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskTags, setNewTaskTags] = useState('');
  const [newTaskEstimate, setNewTaskEstimate] = useState<number | ''>('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<RecurrenceType>('none');
  const [newTaskSubtasks, setNewTaskSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [showAdvancedTaskForm, setShowAdvancedTaskForm] = useState(false);

  /* ---------- Daily planner ---------- */
  const [availableHours, setAvailableHours] = useState<number>(() => Number(localStorage.getItem('tempo_available_hours')) || 8);

  /* ---------- Notifications ---------- */
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const notifiedTaskIds = useRef<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------------
     PERSISTENCE
     --------------------------------------------------------------------- */
  useEffect(() => { localStorage.setItem('tempo_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('tempo_failed_tasks', JSON.stringify(failedTasks)); }, [failedTasks]);
  useEffect(() => { localStorage.setItem('tempo_notes_draft', notes); }, [notes]);
  useEffect(() => { localStorage.setItem('tempo_journal_history', JSON.stringify(journalHistory)); }, [journalHistory]);
  useEffect(() => { localStorage.setItem('tempo_streak', streak.toString()); }, [streak]);
  useEffect(() => { localStorage.setItem('tempo_best_streak', bestStreak.toString()); }, [bestStreak]);
  useEffect(() => { localStorage.setItem('tempo_total_xp', totalXp.toString()); }, [totalXp]);
  useEffect(() => { localStorage.setItem('tempo_last_streak_day', lastStreakDay); }, [lastStreakDay]);
  useEffect(() => { localStorage.setItem('tempo_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('tempo_habits', JSON.stringify(habits)); }, [habits]);
  useEffect(() => { localStorage.setItem('tempo_focus_sessions', JSON.stringify(focusSessions)); }, [focusSessions]);
  useEffect(() => { localStorage.setItem('tempo_achievements', JSON.stringify(unlockedAchievements)); }, [unlockedAchievements]);
  useEffect(() => { localStorage.setItem('tempo_available_hours', availableHours.toString()); }, [availableHours]);
  useEffect(() => { localStorage.setItem('tempo_user_name', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('tempo_user_avatar', userAvatar); }, [userAvatar]);

  /* ---------------------------------------------------------------------
     STREAK: increments once per calendar day when there's activity,
     resets to 0 if a full day was skipped without any completion.
     --------------------------------------------------------------------- */
  const registerDailyActivity = () => {
    const today = todayKey();
    if (lastStreakDay === today) return; // already counted today
    const yesterday = todayKey(new Date(Date.now() - 86400000));
    setStreak(prev => {
      const next = lastStreakDay === yesterday || lastStreakDay === '' ? prev + 1 : 1;
      setBestStreak(b => Math.max(b, next));
      return next;
    });
    setLastStreakDay(today);
  };

  // Passive check: if the user opens the app after skipping a day entirely, reset streak.
  useEffect(() => {
    const today = todayKey();
    const yesterday = todayKey(new Date(Date.now() - 86400000));
    if (lastStreakDay && lastStreakDay !== today && lastStreakDay !== yesterday) {
      setStreak(0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------------------------------------------------
     Deadline watcher: auto-fail overdue tasks, notify approaching ones,
     spin off recurring tasks into a fresh instance once completed/expired.
     --------------------------------------------------------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTasks(prev => {
        const stillActive: Task[] = [];
        const newlyFailed: Task[] = [];
        prev.forEach(task => {
          if (!task.completed && task.deadline) {
            const deadlineDate = new Date(task.deadline);
            const minutesLeft = (deadlineDate.getTime() - now.getTime()) / 60000;

            if (now > deadlineDate) {
              newlyFailed.push({ ...task, failed: true });
              return;
            }
            if (minutesLeft > 0 && minutesLeft <= 30 && !notifiedTaskIds.current.has(task.id)) {
              notifiedTaskIds.current.add(task.id);
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(lang === 'ar' ? '⚠️ اقترب الموعد النهائي' : '⚠️ Deadline approaching', {
                  body: `${task.text} — ${Math.round(minutesLeft)} ${lang === 'ar' ? 'دقيقة متبقية' : 'min left'}`,
                });
              }
            }
          }
          stillActive.push(task);
        });
        if (newlyFailed.length > 0) {
          setFailedTasks(f => [...f, ...newlyFailed]);
          return stillActive.filter(x => !newlyFailed.find(n => n.id === x.id));
        }
        return prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [lang]);

  /* ---------------------------------------------------------------------
     Focus timer
     --------------------------------------------------------------------- */
  useEffect(() => {
    let timer: any;
    if (isFocusMode && isFocusRunning && focusTimeLeft > 0) {
      timer = setInterval(() => setFocusTimeLeft(prev => prev - 1), 1000);
    } else if (focusTimeLeft === 0 && isFocusRunning) {
      setIsFocusRunning(false);
      const linkedTask = tasks.find(tt => tt.id === focusLinkedTaskId);
      setFocusSessions(prev => [...prev, {
        id: Date.now().toString(),
        taskId: linkedTask?.id,
        taskText: linkedTask?.text,
        minutes: focusStartedWithMinutes.current,
        date: new Date().toISOString(),
      }]);
      if (linkedTask) {
        setTasks(prev => prev.map(tt => tt.id === linkedTask.id
          ? { ...tt, actualMinutes: (tt.actualMinutes || 0) + focusStartedWithMinutes.current }
          : tt));
      }
      setTotalXp(x => x + 50);
      alert(lang === 'ar' ? 'انتهت جلسة التركيز بنجاح! 🚀' : 'Focus session completed!');
    }
    return () => clearInterval(timer);
  }, [isFocusMode, isFocusRunning, focusTimeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const startFocus = () => {
    focusStartedWithMinutes.current = focusPreset.label === 'custom' ? customWorkMin : focusPreset.work;
    setFocusTimeLeft(focusStartedWithMinutes.current * 60);
    setIsFocusMode(true);
    setIsFocusRunning(true);
  };

  /* ---------------------------------------------------------------------
     Clock for the day-progress banner
     --------------------------------------------------------------------- */
  const [nowTime, setNowTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const totalSecondsInDay = 24 * 60 * 60;
  const currentSecondsInDay = nowTime.getHours() * 3600 + nowTime.getMinutes() * 60 + nowTime.getSeconds();
  const remainingSecondsInDay = totalSecondsInDay - currentSecondsInDay;
  const elapsedDayPercent = Math.round((currentSecondsInDay / totalSecondsInDay) * 100);
  const formatHoursMins = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return t(`${h}س ${m}د`, `${h}h ${m}m`);
  };

  /* ---------------------------------------------------------------------
     Derived stats
     --------------------------------------------------------------------- */
  const { level, currentLevelXp, neededForNext } = levelFromTotalXp(totalXp);

  const stats: Stats = useMemo(() => {
    const totalCompleted = tasks.filter(x => x.completed).length + journalHistory.length * 0; // completed tasks only
    const perfectDaysSet = new Set<string>();
    const byDay: Record<string, { total: number; done: number }> = {};
    [...tasks, ...failedTasks].forEach(tk => {
      const day = todayKey(new Date(tk.createdAt || tk.deadline));
      byDay[day] = byDay[day] || { total: 0, done: 0 };
      byDay[day].total++;
      if (tk.completed) byDay[day].done++;
    });
    Object.entries(byDay).forEach(([day, v]) => { if (v.total > 0 && v.total === v.done) perfectDaysSet.add(day); });

    const habitsMaxStreak = habits.reduce((max, h) => Math.max(max, computeHabitStreak(h)), 0);

    return {
      totalCompleted: tasks.filter(x => x.completed).length,
      streak,
      bestStreak,
      focusSessionsCount: focusSessions.length,
      totalFocusMinutes: focusSessions.reduce((s, f) => s + f.minutes, 0),
      perfectDays: perfectDaysSet.size,
      journalPages: journalHistory.length,
      habitsMaxStreak,
    };
  }, [tasks, failedTasks, streak, bestStreak, focusSessions, journalHistory, habits]);

  // Achievement unlock check
  useEffect(() => {
    ACHIEVEMENTS.forEach(ach => {
      if (!unlockedAchievements.includes(ach.id) && ach.check(stats)) {
        setUnlockedAchievements(prev => [...prev, ach.id]);
        setNewAchievementToast(ach);
        setTimeout(() => setNewAchievementToast(null), 4000);
      }
    });
  }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps

  const productivityScore = useMemo(() => {
    const activeToday = tasks.filter(tk => todayKey(new Date(tk.createdAt)) === todayKey());
    const doneToday = activeToday.filter(tk => tk.completed).length;
    const completionRate = activeToday.length ? (doneToday / activeToday.length) * 100 : 100;
    const focusToday = focusSessions.filter(f => todayKey(new Date(f.date)) === todayKey()).reduce((s, f) => s + f.minutes, 0);
    const focusScore = Math.min(100, (focusToday / 120) * 100);
    const habitScore = habits.length
      ? (habits.filter(h => h.completedDates.includes(todayKey())).length / habits.length) * 100
      : 100;
    return Math.round(completionRate * 0.5 + focusScore * 0.25 + habitScore * 0.25);
  }, [tasks, focusSessions, habits]);

  /* ---------------------------------------------------------------------
     Task handlers
     --------------------------------------------------------------------- */
  const resetTaskForm = () => {
    setNewTaskText(''); setNewTaskDescription(''); setNewTaskDeadline('');
    setNewTaskTags(''); setNewTaskEstimate(''); setNewTaskRecurrence('none');
    setNewTaskSubtasks([]); setSubtaskDraft(''); setNewTaskPriority('متوسط');
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText,
      description: newTaskDescription || undefined,
      completed: false,
      category: newTaskCategory,
      difficulty: newTaskDifficulty,
      priority: newTaskPriority,
      deadline: newTaskDeadline || new Date(Date.now() + 86400000).toISOString(),
      tags: newTaskTags.split(',').map(s => s.trim()).filter(Boolean),
      subtasks: newTaskSubtasks.map((s, i) => ({ id: `${Date.now()}_${i}`, text: s, completed: false })),
      estimatedMinutes: newTaskEstimate === '' ? undefined : Number(newTaskEstimate),
      recurrence: newTaskRecurrence,
      createdAt: new Date().toISOString(),
      planTier: null,
    };
    setTasks(prev => [...prev, newTask].sort((a, b) => priorityScore(b) - priorityScore(a)));
    resetTaskForm();
  };

  const spawnRecurringInstance = (base: Task) => {
    const next = new Date(base.deadline);
    if (base.recurrence === 'daily') next.setDate(next.getDate() + 1);
    if (base.recurrence === 'weekly') next.setDate(next.getDate() + 7);
    if (base.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
    const clone: Task = {
      ...base,
      id: Date.now().toString() + '_r',
      completed: false,
      failed: false,
      deadline: next.toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: undefined,
      subtasks: base.subtasks.map(s => ({ ...s, completed: false })),
      planTier: null,
    };
    setTasks(prev => [...prev, clone]);
  };

  const handleCompleteTask = (id: string) => {
    const task = tasks.find(x => x.id === id);
    if (!task) return;
    setTasks(prev => prev.map(x => x.id === id ? { ...x, completed: true, completedAt: new Date().toISOString() } : x));
    setTotalXp(x => x + DIFFICULTY_XP[task.difficulty]);
    registerDailyActivity();
    if (task.recurrence !== 'none') spawnRecurringInstance(task);
  };

  const handleToggleSubtask = (taskId: string, subId: string) => {
    setTasks(prev => prev.map(tk => tk.id !== taskId ? tk : {
      ...tk,
      subtasks: tk.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s),
    }));
  };

  const handleDeleteTask = (id: string) => setTasks(prev => prev.filter(x => x.id !== id));

  const setTaskPlanTier = (id: string, tier: PlanTier) => {
    setTasks(prev => prev.map(x => x.id === id ? { ...x, planTier: x.planTier === tier ? null : tier } : x));
  };

  /* ---------------------------------------------------------------------
     Journal handlers
     --------------------------------------------------------------------- */
  const saveJournalPage = () => {
    if (!notes.trim()) return;
    const newPage: JournalPage = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content: notes.trim(),
      pageNumber: journalHistory.length + 1,
      mood: journalMood,
      energy: journalEnergy,
      sleep: journalSleep,
      win: journalWin || undefined,
      problem: journalProblem || undefined,
      tomorrowGoal: journalTomorrow || undefined,
    };
    setJournalHistory(prev => [...prev, newPage]);
    setNotes(''); setJournalWin(''); setJournalProblem(''); setJournalTomorrow('');
    setJournalMood('🙂'); setJournalEnergy(3); setJournalSleep(7);
  };

  const deleteJournalPage = (id: string) => {
    setJournalHistory(prev => prev.filter(p => p.id !== id).map((p, i) => ({ ...p, pageNumber: i + 1 })));
  };

  const filteredJournal = useMemo(() => {
    if (!journalSearch.trim()) return journalHistory;
    const q = journalSearch.toLowerCase();
    return journalHistory.filter(p =>
      p.content.toLowerCase().includes(q) ||
      p.win?.toLowerCase().includes(q) ||
      p.problem?.toLowerCase().includes(q)
    );
  }, [journalHistory, journalSearch]);

  /* ---------------------------------------------------------------------
     Habit handlers
     --------------------------------------------------------------------- */
  function computeHabitStreak(h: Habit) {
    let streakCount = 0;
    let cursor = new Date();
    while (h.completedDates.includes(todayKey(cursor))) {
      streakCount++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streakCount;
  }

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    setHabits(prev => [...prev, {
      id: Date.now().toString(), name: newHabitName, icon: newHabitIcon,
      createdAt: new Date().toISOString(), completedDates: [],
    }]);
    setNewHabitName('');
  };

  const toggleHabitToday = (id: string) => {
    const today = todayKey();
    setHabits(prev => prev.map(h => h.id !== id ? h : {
      ...h,
      completedDates: h.completedDates.includes(today)
        ? h.completedDates.filter(d => d !== today)
        : [...h.completedDates, today],
    }));
    registerDailyActivity();
  };

  const deleteHabit = (id: string) => setHabits(prev => prev.filter(h => h.id !== id));

  /* ---------------------------------------------------------------------
     Backup / Restore
     --------------------------------------------------------------------- */
  const exportBackup = () => {
    const payload = {
      version: 4, exportedAt: new Date().toISOString(),
      tasks, failedTasks, habits, focusSessions, journalHistory,
      streak, bestStreak, totalXp, lastStreakDay, unlockedAchievements,
      userName, userAvatar, lang,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tempo-backup-${todayKey()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.tasks) setTasks(data.tasks);
        if (data.failedTasks) setFailedTasks(data.failedTasks);
        if (data.habits) setHabits(data.habits);
        if (data.focusSessions) setFocusSessions(data.focusSessions);
        if (data.journalHistory) setJournalHistory(data.journalHistory);
        if (typeof data.streak === 'number') setStreak(data.streak);
        if (typeof data.bestStreak === 'number') setBestStreak(data.bestStreak);
        if (typeof data.totalXp === 'number') setTotalXp(data.totalXp);
        if (data.lastStreakDay) setLastStreakDay(data.lastStreakDay);
        if (data.unlockedAchievements) setUnlockedAchievements(data.unlockedAchievements);
        if (data.userName) setUserName(data.userName);
        if (data.userAvatar) setUserAvatar(data.userAvatar);
        alert(t('تم استرجاع النسخة الاحتياطية بنجاح', 'Backup restored successfully'));
      } catch {
        alert(t('ملف غير صالح', 'Invalid backup file'));
      }
    };
    reader.readAsText(file);
  };

  /* ---------------------------------------------------------------------
     Weekly stats for Analytics tab
     --------------------------------------------------------------------- */
  const weeklyData = useMemo(() => {
    const days: { label: string; done: number; missed: number; focus: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = todayKey(d);
      const done = tasks.filter(tk => tk.completedAt && todayKey(new Date(tk.completedAt)) === key).length;
      const missed = failedTasks.filter(tk => todayKey(new Date(tk.deadline)) === key).length;
      const focus = focusSessions.filter(f => todayKey(new Date(f.date)) === key).reduce((s, f) => s + f.minutes, 0);
      days.push({ label: d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }), done, missed, focus });
    }
    return days;
  }, [tasks, failedTasks, focusSessions, lang]);

  const completionRate = useMemo(() => {
    const total = tasks.filter(x => x.completed).length + failedTasks.length;
    return total === 0 ? 100 : Math.round((tasks.filter(x => x.completed).length / total) * 100);
  }, [tasks, failedTasks]);

  const maxWeekly = Math.max(1, ...weeklyData.map(d => Math.max(d.done, d.missed)));

  /* ---------------------------------------------------------------------
     Daily planner workload
     --------------------------------------------------------------------- */
  const plannerTasks = tasks.filter(x => !x.completed);
  const plannerWorkloadMinutes = plannerTasks
    .filter(x => x.planTier)
    .reduce((s, x) => s + (x.estimatedMinutes || 30), 0);
  const isOverloaded = plannerWorkloadMinutes > availableHours * 60;

  const categoryIcons: Record<Category, React.ReactNode> = {
    'دراسة': <BookOpen className="w-4 h-4 text-cyan-400" />,
    'صحة': <Heart className="w-4 h-4 text-rose-400" />,
    'شخصي': <User className="w-4 h-4 text-amber-400" />,
    'منزلي': <Home className="w-4 h-4 text-emerald-400" />,
    'عمل': <Briefcase className="w-4 h-4 text-indigo-400" />,
    'عام': <Globe className="w-4 h-4 text-purple-400" />,
  };

  const priorityColor: Record<Priority, string> = {
    'منخفض': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'متوسط': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'عالي': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'عاجل': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const sortedActiveTasks = [...tasks.filter(x => !x.completed)].sort((a, b) => priorityScore(b) - priorityScore(a));

  const NAV_ITEMS: { id: typeof activeTab; icon: React.ReactNode; ar: string; en: string }[] = [
    { id: 'home', icon: <Sparkles className="w-4 h-4 text-indigo-400" />, ar: 'الرئيسية', en: 'Home' },
    { id: 'tasks', icon: <ShieldAlert className="w-4 h-4 text-cyan-400" />, ar: 'المهام والأرشيف', en: 'Tasks & Archive' },
    { id: 'planner', icon: <ListChecks className="w-4 h-4 text-emerald-400" />, ar: 'خطة اليوم', en: "Today's Plan" },
    { id: 'habits', icon: <Repeat className="w-4 h-4 text-pink-400" />, ar: 'العادات', en: 'Habits' },
    { id: 'notes', icon: <FileText className="w-4 h-4 text-amber-400" />, ar: 'المذكرات', en: 'Journal' },
    { id: 'stats', icon: <BarChart3 className="w-4 h-4 text-violet-400" />, ar: 'الإحصائيات', en: 'Analytics' },
    { id: 'achievements', icon: <Trophy className="w-4 h-4 text-yellow-400" />, ar: 'الإنجازات', en: 'Achievements' },
  ];

  return (
    <div className={`min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white ${lang === 'ar' ? 'rtl' : 'ltr'}`}>

      {/* Achievement toast */}
      {newAchievementToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in font-bold text-sm">
          <Trophy className="w-5 h-5" />
          <div>
            <p>{t('إنجاز جديد!', 'New Achievement!')}</p>
            <p className="text-xs font-semibold opacity-80">{lang === 'ar' ? newAchievementToast.titleAr : newAchievementToast.titleEn}</p>
          </div>
        </div>
      )}

      {/* Focus Mode Fullscreen Overlay */}
      {isFocusMode && (
        <div className="fixed inset-0 z-50 bg-[#020617]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="absolute top-6 right-6">
            <button
              onClick={() => { setIsFocusMode(false); setIsFocusRunning(false); }}
              className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-700 font-medium text-sm"
            >
              {t('خروج من وضع التركيز', 'Exit Focus Mode')}
            </button>
          </div>
          <div className="w-24 h-24 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20">
            <Clock className="w-12 h-12 text-indigo-400 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white mb-2">
            {t('وضع التركيز العميق', 'Deep Focus Active')}
          </h2>
          {focusLinkedTaskId && (
            <p className="text-indigo-300 text-sm mb-2 font-semibold">
              {tasks.find(x => x.id === focusLinkedTaskId)?.text}
            </p>
          )}
          <p className="text-slate-400 text-sm mb-8 max-w-sm">
            {t('هاتفك الآن مجرد عداد وقت نقي. تنفس واغرق في إنجازك.', 'Your phone is a pure time counter. Breathe and execute.')}
          </p>
          <div className="text-6xl md:text-8xl font-black font-mono tracking-wider bg-gradient-to-r from-cyan-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent mb-8">
            {Math.floor(focusTimeLeft / 60).toString().padStart(2, '0')}:{(focusTimeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setIsFocusRunning(!isFocusRunning)}
              className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              {isFocusRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {isFocusRunning ? t('إيقاف مؤقت', 'Pause') : t('استكمال', 'Resume')}
            </button>
            <button
              onClick={() => { setFocusTimeLeft(focusStartedWithMinutes.current * 60); setIsFocusRunning(false); }}
              className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#090d16]/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/55 transition-all text-slate-300 flex flex-col gap-1 w-10 h-10 items-center justify-center"
            >
              <div className="w-5 h-0.5 bg-slate-200 rounded-full"></div>
              <div className="w-3.5 h-0.5 bg-slate-200 rounded-full"></div>
              <div className="w-5 h-0.5 bg-slate-200 rounded-full"></div>
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
                Tempo OS
              </h1>
              <p className="text-[11px] text-slate-400">{t('مرحباً بك،', 'Welcome,')} {userName} · {t('مستوى', 'Lvl')} {level}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFocusMode(true)}
              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('تركيز', 'Focus')}</span>
            </button>
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-400">
              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
              <span>{streak} {t('يوم', 'd')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">

        {activeTab === 'home' && (
          <>
            {/* Dashboard summary card */}
            <section className="bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400">{t('نتيجة الإنتاجية اليوم', "Today's productivity score")}</p>
                  <h2 className="text-3xl font-black text-white mt-1">{productivityScore}<span className="text-slate-500 text-lg">/100</span></h2>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">{t('المتبقي من اليوم', 'Remaining Today')}</p>
                  <p className="text-sm font-bold text-cyan-400">{formatHoursMins(remainingSecondsInDay)}</p>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>{t('انقضى من اليوم', 'Elapsed')} {elapsedDayPercent}%</span>
                  <span>{t('المهام المعلقة:', 'Pending:')} {tasks.filter(x => !x.completed).length}</span>
                </div>
                <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <div className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 h-full rounded-full transition-all duration-1000 shadow-lg shadow-indigo-500/30"
                    style={{ width: `${elapsedDayPercent}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800">
                  <p className="text-lg font-black text-amber-400">{streak}</p>
                  <p className="text-[10px] text-slate-500">{t('سلسلة الأيام', 'Streak')}</p>
                </div>
                <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800">
                  <p className="text-lg font-black text-indigo-400">{level}</p>
                  <p className="text-[10px] text-slate-500">{t('المستوى', 'Level')}</p>
                </div>
                <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800">
                  <p className="text-lg font-black text-emerald-400">{tasks.filter(x => x.completed).length}</p>
                  <p className="text-[10px] text-slate-500">{t('منجزة إجمالاً', 'Total Done')}</p>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{t('XP للمستوى القادم', 'XP to next level')}</span>
                  <span>{currentLevelXp} / {neededForNext}</span>
                </div>
                <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (currentLevelXp / neededForNext) * 100)}%` }} />
                </div>
              </div>
            </section>

            {/* Task Creator */}
            <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>{t('إضافة مهمة جديدة بذكاء', 'Smart Add Task')}</span>
              </h3>
              <form onSubmit={handleAddTask} className="space-y-3">
                <input
                  type="text"
                  placeholder={t('ما الذي تريد إنجازه اليوم؟', 'What to achieve today?')}
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <select value={newTaskCategory} onChange={e => setNewTaskCategory(e.target.value as Category)}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500">
                    <option value="دراسة">📚 دراسة</option>
                    <option value="صحة">❤️ صحة</option>
                    <option value="شخصي">⚡ شخصي</option>
                    <option value="منزلي">🏠 منزلي</option>
                    <option value="عمل">💼 عمل</option>
                    <option value="عام">🌐 عام</option>
                  </select>

                  <select value={newTaskDifficulty} onChange={e => setNewTaskDifficulty(e.target.value as Difficulty)}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500">
                    <option value="سهل">🟢 سهل</option>
                    <option value="متوسط">🟡 متوسط</option>
                    <option value="صعب">🔴 صعب</option>
                  </select>

                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as Priority)}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500">
                    <option value="منخفض">⭐ منخفض</option>
                    <option value="متوسط">⭐⭐ متوسط</option>
                    <option value="عالي">⭐⭐⭐ عالي</option>
                    <option value="عاجل">🚨 عاجل</option>
                  </select>

                  <input type="datetime-local" value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500" />
                </div>

                <button type="button" onClick={() => setShowAdvancedTaskForm(v => !v)}
                  className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
                  {showAdvancedTaskForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {t('خيارات متقدمة (وصف، تكرار، وسوم، مهام فرعية)', 'Advanced options (description, recurrence, tags, subtasks)')}
                </button>

                {showAdvancedTaskForm && (
                  <div className="space-y-2.5 bg-slate-950/50 border border-slate-800 rounded-2xl p-3">
                    <textarea placeholder={t('وصف المهمة (اختياري)', 'Task description (optional)')}
                      value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 resize-none h-16" />

                    <div className="grid grid-cols-2 gap-2.5">
                      <select value={newTaskRecurrence} onChange={e => setNewTaskRecurrence(e.target.value as RecurrenceType)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300">
                        <option value="none">{t('بدون تكرار', 'No recurrence')}</option>
                        <option value="daily">{t('🔁 يوميًا', '🔁 Daily')}</option>
                        <option value="weekly">{t('🔁 أسبوعيًا', '🔁 Weekly')}</option>
                        <option value="monthly">{t('🔁 شهريًا', '🔁 Monthly')}</option>
                      </select>
                      <input type="number" min={5} placeholder={t('الوقت المتوقع (دقيقة)', 'Estimated (min)')}
                        value={newTaskEstimate} onChange={e => setNewTaskEstimate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300" />
                    </div>

                    <input type="text" placeholder={t('وسوم (افصل بفاصلة)', 'Tags (comma separated)')}
                      value={newTaskTags} onChange={e => setNewTaskTags(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300" />

                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input type="text" placeholder={t('أضف مهمة فرعية', 'Add subtask')}
                          value={subtaskDraft} onChange={e => setSubtaskDraft(e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300" />
                        <button type="button" onClick={() => { if (subtaskDraft.trim()) { setNewTaskSubtasks(p => [...p, subtaskDraft.trim()]); setSubtaskDraft(''); } }}
                          className="px-3 py-2 bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-bold">+</button>
                      </div>
                      {newTaskSubtasks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {newTaskSubtasks.map((s, i) => (
                            <span key={i} className="text-[11px] bg-slate-800 px-2 py-1 rounded-lg text-slate-300 flex items-center gap-1">
                              {s}
                              <button type="button" onClick={() => setNewTaskSubtasks(p => p.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-rose-400">✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3 rounded-2xl text-sm shadow-lg shadow-indigo-600/20 transition-all">
                  {t('+ إضافة وترتيب تلقائي', '+ Add & Auto-Prioritize')}
                </button>
              </form>
            </section>

            {/* Today's active tasks (top 5 by smart priority) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  <span>{t('مهام اليوم (مرتبة بالأولوية الذكية)', "Today's Tasks (smart priority)")}</span>
                </h3>
                <button onClick={() => setActiveTab('tasks')} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                  <span>{t('عرض الكل', 'View All')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <TaskList
                tasks={sortedActiveTasks.slice(0, 5)}
                lang={lang} t={t} categoryIcons={categoryIcons} priorityColor={priorityColor}
                expandedTaskId={expandedTaskId} setExpandedTaskId={setExpandedTaskId}
                onComplete={handleCompleteTask} onDelete={handleDeleteTask} onToggleSubtask={handleToggleSubtask}
                emptyText={t('لا توجد مهام معلقة. أضف مهمتك الأولى!', 'No pending tasks. Add one now!')}
              />
            </section>
          </>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{t('سجل المهام والذاكرة الشاملة', 'Comprehensive Tasks Archive')}</h2>
                <p className="text-xs text-slate-400">{t('كل ما أنجزته، وكل ما فاتك', 'Everything completed and missed')}</p>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-bold text-slate-200">{t('كل المهام النشطة', 'All Active Tasks')}</h3>
              <TaskList
                tasks={sortedActiveTasks}
                lang={lang} t={t} categoryIcons={categoryIcons} priorityColor={priorityColor}
                expandedTaskId={expandedTaskId} setExpandedTaskId={setExpandedTaskId}
                onComplete={handleCompleteTask} onDelete={handleDeleteTask} onToggleSubtask={handleToggleSubtask}
                emptyText={t('لا توجد مهام معلقة حالياً.', 'No pending tasks.')}
              />
            </section>

            <div className="bg-rose-950/20 border border-rose-500/30 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-rose-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{t('المهام الفائتة (أرشيف دائم)', 'Missed Tasks Archive (Permanent)')}</span>
              </h3>
              {failedTasks.length === 0 ? (
                <p className="text-xs text-slate-400">{t('سجل المهام الفائتة نظيف تماماً!', 'No missed tasks. Excellent!')}</p>
              ) : (
                <div className="space-y-2">
                  {failedTasks.map(ft => (
                    <div key={ft.id} className="bg-slate-900/80 border border-rose-500/20 p-3 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium line-through">{ft.text}</span>
                      <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-bold">{t('فائتة', 'Missed')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('المهام المنجزة', 'Completed Tasks')}</span>
              </h3>
              <div className="space-y-2">
                {tasks.filter(x => x.completed).length === 0 ? (
                  <p className="text-xs text-slate-400">{t('لم تنجز أي مهمة بعد.', 'No completed tasks yet.')}</p>
                ) : (
                  tasks.filter(x => x.completed).slice().reverse().map(x => (
                    <div key={x.id} className="bg-slate-950/60 p-3 rounded-xl flex justify-between items-center text-xs border border-slate-800">
                      <div>
                        <p className="text-slate-200 font-medium">{x.text}</p>
                        {x.completedAt && x.createdAt && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {t('مدة الإنجاز:', 'Duration:')} {Math.max(0, Math.round((new Date(x.completedAt).getTime() - new Date(x.createdAt).getTime()) / 60000))} {t('دقيقة', 'min')}
                          </p>
                        )}
                      </div>
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold shrink-0">{t('مُنجز ✓', 'Done ✓')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">{t('خطط يومك', 'Plan Your Day')}</h2>
              <p className="text-xs text-slate-400">{t('ماذا تريد أن تنجز اليوم؟', 'What do you want to accomplish today?')}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">{t('الوقت المتاح اليوم (ساعات)', 'Available time today (hours)')}</label>
                <input type="number" min={1} max={24} value={availableHours} onChange={e => setAvailableHours(Number(e.target.value))}
                  className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-center text-slate-200" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{t('عبء العمل المخطط:', 'Planned workload:')} <b className="text-slate-200">{Math.round(plannerWorkloadMinutes / 60 * 10) / 10}{t('س', 'h')}</b></span>
                {isOverloaded ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {t('يومك محمّل زيادة', 'Your plan is overloaded')}</span>
                ) : (
                  <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t('يوم واقعي', 'Realistic day')}</span>
                )}
              </div>
              <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isOverloaded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (plannerWorkloadMinutes / (availableHours * 60)) * 100)}%` }} />
              </div>
            </div>

            {(['must', 'should', 'if'] as PlanTier[]).map(tier => (
              <section key={tier} className="space-y-2.5">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  {tier === 'must' && <><span className="text-rose-400">🔥</span> <span>{t('لازم تعمله', 'Must Do')}</span></>}
                  {tier === 'should' && <><span className="text-amber-400">⭐</span> <span>{t('يفضل تعمله', 'Should Do')}</span></>}
                  {tier === 'if' && <><span className="text-slate-400">○</span> <span>{t('لو فيه وقت', 'If I have time')}</span></>}
                </h3>
                <div className="space-y-1.5">
                  {plannerTasks.filter(x => x.planTier === tier).map(x => (
                    <div key={x.id} className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-slate-200">{x.text}</span>
                      <button onClick={() => setTaskPlanTier(x.id, tier)} className="text-slate-500 hover:text-rose-400">✕</button>
                    </div>
                  ))}
                  {plannerTasks.filter(x => x.planTier === tier).length === 0 && (
                    <p className="text-[11px] text-slate-500 italic">{t('لا توجد مهام هنا بعد.', 'No tasks here yet.')}</p>
                  )}
                </div>
              </section>
            ))}

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-slate-300">{t('اختر من مهامك النشطة', 'Pick from your active tasks')}</h3>
              <div className="space-y-1.5">
                {plannerTasks.filter(x => !x.planTier).map(x => (
                  <div key={x.id} className="bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{x.text}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setTaskPlanTier(x.id, 'must')} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">{t('لازم', 'Must')}</button>
                      <button onClick={() => setTaskPlanTier(x.id, 'should')} className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">{t('يفضل', 'Should')}</button>
                      <button onClick={() => setTaskPlanTier(x.id, 'if')} className="px-2 py-1 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-bold">{t('لو وقت', 'If time')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'habits' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">{t('متتبع العادات', 'Habit Tracker')}</h2>
              <p className="text-xs text-slate-400">{t('عادات يومية تكررها بشكل مستمر — مختلفة عن المهام', 'Recurring daily habits — different from tasks')}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 flex gap-2">
              <select value={newHabitIcon} onChange={e => setNewHabitIcon(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2 text-slate-300">
                {Object.keys(DEFAULT_HABIT_ICONS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input type="text" placeholder={t('اسم العادة (مثل: شرب الماء)', 'Habit name (e.g. Drink water)')}
                value={newHabitName} onChange={e => setNewHabitName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200" />
              <button onClick={addHabit} className="px-4 py-2 bg-indigo-600 rounded-xl text-white text-sm font-bold">{t('إضافة', 'Add')}</button>
            </div>

            <div className="space-y-3">
              {habits.length === 0 && <p className="text-xs text-slate-500 text-center py-6">{t('لا توجد عادات بعد.', 'No habits yet.')}</p>}
              {habits.map(h => {
                const st = computeHabitStreak(h);
                const doneToday = h.completedDates.includes(todayKey());
                const last14 = Array.from({ length: 14 }, (_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (13 - i));
                  return h.completedDates.includes(todayKey(d));
                });
                return (
                  <div key={h.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-pink-400">{DEFAULT_HABIT_ICONS[h.icon]}</span>
                        <span className="text-sm font-semibold text-slate-200">{h.name}</span>
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5"><Flame className="w-3 h-3" />{st}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleHabitToday(h.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${doneToday ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {doneToday ? t('تم اليوم ✓', 'Done today ✓') : t('اضغط للإنجاز', 'Mark done')}
                        </button>
                        <button onClick={() => deleteHabit(h.id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {last14.map((done, i) => (
                        <div key={i} className={`w-4 h-4 rounded-sm ${done ? 'bg-pink-500' : 'bg-slate-800'}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{t('المذكرات اليومية', 'Daily Notes')}</h2>
                <p className="text-xs text-slate-400">{t('يوميات حقيقية بمزاج وطاقة وأهداف', 'A real journal with mood, energy, and goals')}</p>
              </div>
            </div>

            <div className="bg-[#f5ebd6] text-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-[#e2d2b5] relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-8 bg-rose-400/20 border-r border-rose-400/40 pointer-events-none"></div>
              <div className="relative z-10 pl-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500">{t(`الصفحة ${journalHistory.length + 1}`, `Page ${journalHistory.length + 1}`)}</p>
                  <button onClick={saveJournalPage} disabled={!notes.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all">
                    {t('حفظ الصفحة', 'Save Page')}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('المزاج', 'Mood')}</label>
                    <select value={journalMood} onChange={e => setJournalMood(e.target.value)} className="w-full bg-white/60 border border-slate-400/40 rounded-lg px-2 py-1 text-sm">
                      <option>😄</option><option>🙂</option><option>😐</option><option>😔</option><option>😫</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('الطاقة (1-5)', 'Energy (1-5)')}</label>
                    <input type="number" min={1} max={5} value={journalEnergy} onChange={e => setJournalEnergy(Number(e.target.value))}
                      className="w-full bg-white/60 border border-slate-400/40 rounded-lg px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('النوم (ساعات)', 'Sleep (hrs)')}</label>
                    <input type="number" min={0} max={14} value={journalSleep} onChange={e => setJournalSleep(Number(e.target.value))}
                      className="w-full bg-white/60 border border-slate-400/40 rounded-lg px-2 py-1 text-sm" />
                  </div>
                </div>

                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t('اكتب ملاحظاتك وأفكارك هنا...', 'Write your notes and thoughts here...')}
                  className="w-full h-40 bg-transparent resize-none focus:outline-none text-slate-900 text-base leading-8 font-medium border-b border-slate-400/30" />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="text" placeholder={t('أهم إنجاز اليوم', "Today's win")} value={journalWin} onChange={e => setJournalWin(e.target.value)}
                    className="bg-white/60 border border-slate-400/40 rounded-lg px-2 py-1.5 text-xs" />
                  <input type="text" placeholder={t('أكبر مشكلة', 'Biggest problem')} value={journalProblem} onChange={e => setJournalProblem(e.target.value)}
                    className="bg-white/60 border border-slate-400/40 rounded-lg px-2 py-1.5 text-xs" />
                  <input type="text" placeholder={t('هدف الغد', "Tomorrow's goal")} value={journalTomorrow} onChange={e => setJournalTomorrow(e.target.value)}
                    className="bg-white/60 border border-slate-400/40 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              </div>
            </div>

            <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{t('سجل المذكرات', 'Notes History')}</h3>
                  <p className="text-xs text-slate-400 mt-1">{t(`عدد الصفحات: ${journalHistory.length}`, `Pages: ${journalHistory.length}`)}</p>
                </div>
                <div className="relative flex-1 max-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 left-2.5" />
                  <input type="text" placeholder={t('بحث في اليوميات...', 'Search journal...')} value={journalSearch} onChange={e => setJournalSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2 py-1.5 text-xs text-slate-300" />
                </div>
              </div>
              {filteredJournal.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">{t('لا توجد نتائج.', 'No results.')}</p>
              ) : (
                <div className="space-y-3">
                  {[...filteredJournal].reverse().map(page => (
                    <div key={page.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-xs font-bold text-amber-400 flex items-center gap-2">
                          <span>{t(`صفحة ${page.pageNumber}`, `Page ${page.pageNumber}`)}</span>
                          {page.mood && <span>{page.mood}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-500">{new Date(page.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
                          <button onClick={() => deleteJournalPage(page.id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-6 mb-2">{page.content}</p>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        {page.win && <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg">🏆 {page.win}</span>}
                        {page.problem && <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-lg">⚠️ {page.problem}</span>}
                        {page.tomorrowGoal && <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-lg">🎯 {page.tomorrowGoal}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">{t('الإحصائيات', 'Analytics')}</h2>
              <p className="text-xs text-slate-400">{t('أداؤك خلال آخر 7 أيام', 'Your performance over the last 7 days')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('نسبة الإنجاز', 'Completion rate')} value={`${completionRate}%`} color="text-emerald-400" />
              <StatCard label={t('إجمالي التركيز', 'Total focus')} value={`${Math.round(stats.totalFocusMinutes / 60 * 10) / 10}${t('س', 'h')}`} color="text-indigo-400" />
              <StatCard label={t('أفضل سلسلة', 'Best streak')} value={`${bestStreak}${t('ي', 'd')}`} color="text-amber-400" />
              <StatCard label={t('أيام مثالية', 'Perfect days')} value={`${stats.perfectDays}`} color="text-violet-400" />
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-4">{t('المهام المنجزة مقابل الفائتة', 'Completed vs Missed')}</h3>
              <div className="flex items-end justify-between gap-2 h-40">
                {weeklyData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex flex-col justify-end items-center gap-0.5 h-32">
                      <div className="w-full bg-emerald-500/70 rounded-t-md" style={{ height: `${(d.done / maxWeekly) * 100}%`, minHeight: d.done ? 4 : 0 }} />
                      <div className="w-full bg-rose-500/60 rounded-t-md" style={{ height: `${(d.missed / maxWeekly) * 100}%`, minHeight: d.missed ? 4 : 0 }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 justify-center mt-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> {t('منجزة', 'Done')}</span>
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500/60" /> {t('فائتة', 'Missed')}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-4">{t('دقائق التركيز اليومية', 'Daily focus minutes')}</h3>
              <div className="flex items-end justify-between gap-2 h-28">
                {weeklyData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-end h-24">
                      <div className="w-full bg-indigo-500/70 rounded-t-md" style={{ height: `${Math.min(100, (d.focus / 120) * 100)}%`, minHeight: d.focus ? 4 : 0 }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">{t('الإنجازات', 'Achievements')}</h2>
              <p className="text-xs text-slate-400">{t(`فتحت ${unlockedAchievements.length} من ${ACHIEVEMENTS.length}`, `Unlocked ${unlockedAchievements.length} of ${ACHIEVEMENTS.length}`)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACHIEVEMENTS.map(a => {
                const unlocked = unlockedAchievements.includes(a.id);
                return (
                  <div key={a.id} className={`rounded-2xl p-4 border flex items-center gap-3 ${unlocked ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${unlocked ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                      {unlocked ? a.icon : <Lock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-100">{lang === 'ar' ? a.titleAr : a.titleEn}</p>
                      <p className="text-[11px] text-slate-400">{lang === 'ar' ? a.descAr : a.descEn}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom-ish quick nav (mobile friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0c101d]/95 backdrop-blur-xl border-t border-slate-800 px-2 py-2">
        <div className="max-w-4xl mx-auto grid grid-cols-4 sm:grid-cols-7 gap-1">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${activeTab === item.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-500'}`}>
              {item.icon}
              <span className="truncate w-full text-center">{lang === 'ar' ? item.ar : item.en}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-start animate-fade-in">
          <div className="w-80 bg-[#0c101d] border-r border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <img src={userAvatar} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/50" />
                  <div>
                    <h3 className="text-sm font-bold text-white">{userName}</h3>
                    <p className="text-[10px] text-slate-500">{t('مستوى', 'Level')} {level}</p>
                  </div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
              </div>

              <div className="space-y-2">
                {NAV_ITEMS.map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                    className="w-full text-start px-4 py-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-all flex items-center gap-3">
                    {item.icon}
                    <span>{lang === 'ar' ? item.ar : item.en}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold text-slate-400">{t('البيانات', 'Data')}</h4>
                <button onClick={exportBackup} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" /> {t('تصدير نسخة احتياطية', 'Export backup')}
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" /> {t('استيراد نسخة احتياطية', 'Import backup')}
                </button>
                <input ref={fileInputRef} type="file" accept="application/json" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); }} />

                {notifPermission !== 'unsupported' && notifPermission !== 'granted' && (
                  <button onClick={() => Notification.requestPermission().then(setNotifPermission)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2">
                    <Bell className="w-4 h-4" /> {t('تفعيل تنبيهات المواعيد', 'Enable deadline notifications')}
                  </button>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('الإعدادات واللغة', 'Settings & Language')}</h4>
                <div className="flex gap-2">
                  <button onClick={() => setLang('ar')} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${lang === 'ar' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>العربية</button>
                  <button onClick={() => setLang('en')} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${lang === 'en' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>English</button>
                </div>
                <button onClick={() => { setDraftName(userName); setDraftAvatar(userAvatar); setIsProfileModalOpen(true); setIsSidebarOpen(false); }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> <span>{t('تعديل الملف الشخصي', 'Edit Profile')}</span>
                </button>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-500 pt-4 border-t border-slate-800">
              Tempo OS v4.0 • Private & Secure
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{t('تعديل الملف الشخصي', 'Edit Profile')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('اسمك الكريم', 'Your Name')}</label>
                <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('صورة الملف الشخصي', 'Avatar')}</label>
                <input type="file" accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setDraftAvatar(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsProfileModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl text-sm transition-all">
                {t('إلغاء', 'Cancel')}
              </button>
              <button onClick={() => { setUserName(draftName); setUserAvatar(draftAvatar); setIsProfileModalOpen(false); }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all">
                {t('حفظ التغييرات', 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================================================================
   Sub-components
   ========================================================================= */

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center">
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function TaskList({
  tasks, lang, t, categoryIcons, priorityColor, expandedTaskId, setExpandedTaskId,
  onComplete, onDelete, onToggleSubtask, emptyText,
}: {
  tasks: Task[];
  lang: 'ar' | 'en';
  t: (ar: string, en: string) => string;
  categoryIcons: Record<Category, React.ReactNode>;
  priorityColor: Record<Priority, string>;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (taskId: string, subId: string) => void;
  emptyText: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 text-center text-slate-400">
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {tasks.map(task => {
        const isExpanded = expandedTaskId === task.id;
        const doneSubtasks = task.subtasks.filter(s => s.completed).length;
        return (
          <div key={task.id} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 rounded-2xl transition-all shadow-md group">
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button onClick={() => onComplete(task.id)}
                  className="w-6 h-6 rounded-lg border-2 border-slate-600 hover:border-indigo-500 flex items-center justify-center transition-all bg-slate-950 flex-shrink-0" />
                <div className="min-w-0 flex-1" onClick={() => (task.subtasks.length > 0 || task.description) && setExpandedTaskId(isExpanded ? null : task.id)}>
                  <p className="text-sm font-semibold text-slate-200 truncate">{task.text}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">{categoryIcons[task.category]} {task.category}</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-md font-bold border ${priorityColor[task.priority]}`}>{task.priority}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-500" /> {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {task.recurrence !== 'none' && <span className="flex items-center gap-1 text-cyan-400"><Repeat className="w-3 h-3" /></span>}
                    {task.subtasks.length > 0 && <span className="text-slate-500">{doneSubtasks}/{task.subtasks.length}</span>}
                    {task.tags.length > 0 && task.tags.map(tag => (
                      <span key={tag} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 flex items-center gap-0.5"><Tag className="w-2.5 h-2.5" />{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-400 transition-all shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-slate-800/60 pt-3">
                {task.description && <p className="text-xs text-slate-400">{task.description}</p>}
                {task.subtasks.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={s.completed} onChange={() => onToggleSubtask(task.id, s.id)} className="accent-indigo-500" />
                    <span className={s.completed ? 'line-through text-slate-500' : ''}>{s.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
