import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Plus, Trash2, Settings, User, Camera, 
  Sparkles, Clock, Calendar, Flame, Award, ShieldAlert, 
  BookOpen, Heart, Briefcase, Home, Globe, UserCheck, 
  Play, Pause, RotateCcw, FileText, ChevronRight, AlertCircle, Volume2
} from 'lucide-react';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  category: 'دراسة' | 'صحة' | 'شخصي' | 'منزلي' | 'عمل' | 'عام';
  difficulty: 'سهل' | 'متوسط' | 'صعب';
  deadline: string; // ISO string or datetime-local
  failed?: boolean;
}

interface Post {
  id: string;
  author: string;
  avatar: string;
  content: string;
  image?: string;
  timestamp: string;
  likes: number;
}
export default function App() {
  // Service Worker for PWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Language & Settings
  const [lang, setLang] = useState<'ar' | 'en'>(() => localStorage.getItem('tempo_lang') || 'ar' as any);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'notes'>('home');

  // User Profile
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('tempo_user_name') || 'عبدالله مههر');
  const [userAvatar, setUserAvatar] = useState<string>(() => localStorage.getItem('tempo_user_avatar') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop');
  
  // Gamification (Streak, XP, Level)
  const [streak, setStreak] = useState<number>(() => Number(localStorage.getItem('tempo_streak')) || 1);
  const [xp, setXp] = useState<number>(() => Number(localStorage.getItem('tempo_xp')) || 120);
  const level = Math.floor(xp / 500) + 1;
  const [lastActiveDate, setLastActiveDate] = useState<string>(() => localStorage.getItem('tempo_last_active') || new Date().toDateString());

  // Check 24h Streak Reset
  useEffect(() => {
    const today = new Date().toDateString();
    if (lastActiveDate !== today) {
      const lastDateObj = new Date(lastActiveDate);
      const diffHours = Math.abs(new Date().getTime() - lastDateObj.getTime()) / 36e5;
      if (diffHours > 48) {
        setStreak(0); // تصفير لو عدى اليومين بدون تفاعل
      }
            setLastActiveDate(today);
      localStorage.setItem('tempo_last_active', today);
    }
  }, []);

  // Tasks State
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tempo_tasks');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Failed / Missed Tasks (Permanent Archive)
  const [failedTasks, setFailedTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tempo_failed_tasks');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Notes State
  const [notes, setNotes] = useState<string>(() => localStorage.getItem('tempo_notes') || '');

  // New Task Form States
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<Task['category']>('دراسة');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState<Task['difficulty']>('متوسط');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // Focus Mode Timer State
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusTimeLeft, setFocusTimeLeft] = useState(25 * 60);
  const [isFocusRunning, setIsFocusRunning] = useState(false);

  // Save to LocalStorage
  useEffect(() => { localStorage.setItem('tempo_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('tempo_failed_tasks', JSON.stringify(failedTasks)); }, [failedTasks]);
  useEffect(() => { localStorage.setItem('tempo_notes', notes); }, [notes]);
  useEffect(() => { localStorage.setItem('tempo_streak', streak.toString()); }, [streak]);
  useEffect(() => { localStorage.setItem('tempo_xp', xp.toString()); }, [xp]);
  useEffect(() => { localStorage.setItem('tempo_lang', lang); }, [lang]);

  // Focus Timer Hook
  useEffect(() => {
    let timer: any;
    if (isFocusMode && isFocusRunning && focusTimeLeft > 0) {
      timer = setInterval(() => setFocusTimeLeft(prev => prev - 1), 1000);
    } else if (focusTimeLeft === 0 && isFocusRunning) {
      setIsFocusRunning(false);
      alert(lang === 'ar' ? 'انتهت جلسة التركيز بنجاح! بطل 🚀' : 'Focus session completed!');
      setXp(p => p + 50);
    }
    return () => clearInterval(timer);
  }, [isFocusMode, isFocusRunning, focusTimeLeft]);

  // Check Deadlines & Missed Tasks automatically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let updatedTasks = [...tasks];
      let newlyFailed: Task[] = [];

      updatedTasks = updatedTasks.filter(t => {
        if (!t.completed && t.deadline) {
          const deadlineDate = new Date(t.deadline);
          if (now > deadlineDate) {
            newlyFailed.push({ ...t, failed: true });
            return false; // إزالة من الرئيسية وإضافتها للملفات التي فاتتك
          }
        }
        return true;
      });
if (newlyFailed.length > 0) {
        setTasks(updatedTasks);
        setFailedTasks(prev => [...prev, ...newlyFailed]);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [tasks]);

  // Day Time Counter (Elapsed vs Remaining)
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
    return `${h}س ${m}د`;
  };

  // Add Task Handler with Smart Difficulty Sorting Weight
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText,
      completed: false,
      category: newTaskCategory,
      difficulty: newTaskDifficulty,
      deadline: newTaskDeadline || new Date(Date.now() + 86400000).toISOString()
    };
    const handleCompleteTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        setXp(x => x + (t.difficulty === 'صعب' ? 40 : t.difficulty === 'متوسط' ? 25 : 10));
        setStreak(s => s + 1);
        return { ...t, completed: true };
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const categoryIcons = {
    'دراسة': <BookOpen className="w-4 h-4 text-cyan-400" />,
    'صحة': <Heart className="w-4 h-4 text-rose-400" />,
    'شخصي': <User className="w-4 h-4 text-amber-400" />,
    'منزلي': <Home className="w-4 h-4 text-emerald-400" />,
    'عمل': <Briefcase className="w-4 h-4 text-indigo-400" />,
    'عام': <Globe className="w-4 h-4 text-purple-400" />
  };

  return (
    <div className={`min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      
      {/* Focus Mode Fullscreen Overlay */}
      {isFocusMode && (
        <div className="fixed inset-0 z-50 bg-[#020617]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="absolute top-6 right-6">
            <button 
              onClick={() => { setIsFocusMode(false); setIsFocusRunning(false); }}
              className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-700 font-medium text-sm"
            >
              {lang === 'ar' ? 'خروج من وضع التركيز' : 'Exit Focus Mode'}
            </button>
          </div>
          <div className="w-24 h-24 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20">
            <Clock className="w-12 h-12 text-indigo-400 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white mb-2">
            {lang === 'ar' ? 'وضع التركيز العميق (ممتنع عن الإزعاج)' : 'Deep Focus Active'}
          </h2>
          <p className="text-slate-400 text-sm mb-8 max-w-sm">
            {lang === 'ar' ? 'هاتفك الآن مجرد عداد وقت نقي. تنفس واغرق في إنجازك.' : 'Your phone is a pure time counter. Breathe and execute.'}
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
              {isFocusRunning ? (lang === 'ar' ? 'إيقاف مؤقت' : 'Pause') : (lang === 'ar' ? 'بدء التركيز' : 'Start Focus')}
            </button>
            <button 
              onClick={() => { setFocusTimeLeft(25 * 60); setIsFocusRunning(false); }}
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
              <p className="text-[11px] text-slate-400">{lang === 'ar' ? 'مرحباً بك،' : 'Welcome,'} {userName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFocusMode(true)}
              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'وضع التركيز' : 'Focus'}</span>
            </button>
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-400">
              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
              <span>{streak} {lang === 'ar' ? 'يوم' : 'd'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">

        {/* Day Progress & Time Banner */}
        <section className="bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {lang === 'ar' ? 'عداد اليوم الحي' : 'Live Day Counter'}
              </span>
              <h2 className="text-xl font-bold text-white mt-1.5">
                {nowTime.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </h2>
            </div>
            <div className="text-right flex items-center gap-3">
              <div>
                <p className="text-[11px] text-slate-400">{lang === 'ar' ? 'المتبقي من اليوم' : 'Remaining'}</p>
                <p className="text-sm font-bold text-cyan-400">{formatHoursMins(remainingSecondsInDay)}</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-800"></div>
              <div>
                <p className="text-[11px] text-slate-400">{lang === 'ar' ? 'المستوى' : 'Level'} {level}</p>
                <p className="text-sm font-bold text-pink-400">{xp} XP</p>
              </div>
            </div>
          </div>

          {/* Long Slim Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>{lang === 'ar' ? 'انقضي من اليوم' : 'Elapsed'} {elapsedDayPercent}%</span>
              <span>{lang === 'ar' ? 'المهام المعلقة:' : 'Pending:'} {tasks.filter(t => !t.completed).length}</span>
            </div>
            <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div 
                className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 h-full rounded-full transition-all duration-1000 shadow-lg shadow-indigo-500/30"
                style={{ width: `${elapsedDayPercent}%` }}
              ></div>
            </div>
          </div>
        </section>

        {/* Task Creator & Quick Add */}
        <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>{lang === 'ar' ? 'إضافة مهمة جديدة بذكاء' : 'Smart Add Task'}</span>
          </h3>
          <form onSubmit={handleAddTask} className="space-y-3">
            <input 
              type="text"
              placeholder={lang === 'ar' ? 'ما الذي تريد إنجازه اليوم؟ (مثل: مراجعة الكابستول)' : 'What to achieve today?'}
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Category */}
              <select 
                value={newTaskCategory}
                onChange={e => setNewTaskCategory(e.target.value as any)}
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="دراسة">📚 دراسة</option>
                <option value="صحة">❤️ صحة</option>
                <option value="شخصي">⚡ شخصي</option>
                <option value="منزلي">🏠 منزلي</option>
                <option value="عمل">💼 عمل</option>
                <option value="عام">🌐 عام</option>
              </select>

              {/* Difficulty */}
              <select 
                value={newTaskDifficulty}
                onChange={e => setNewTaskDifficulty(e.target.value as any)}
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="سهل">🟢 سهل</option>
                <option value="متوسط">🟡 متوسط</option>
                <option value="صعب">🔴 صعب (أولوية قصوى)</option>
              </select>

              {/* Deadline */}
              <input 
                type="datetime-local"
                value={newTaskDeadline}
                onChange={e => setNewTaskDeadline(e.target.value)}
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3 rounded-2xl text-sm shadow-lg shadow-indigo-600/20 transition-all"
            >
              {lang === 'ar' ? '+ إضافة وترتيب تلقائي' : '+ Add & Auto-Prioritize'}
            </button>
          </form>
        </section>

        {/* Main Active Tasks List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'ar' ? 'مهام اليوم (مرتبة بالصعوبة والأولوية)' : 'Today Tasks'}</span>
            </h3>
            <button 
              onClick={() => setActiveTab('tasks')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'المزيد (عرض الكل)' : 'View All'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
<div className="space-y-2.5">
            {tasks.filter(t => !t.completed).length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 text-center text-slate-400">
                <p className="text-sm">{lang === 'ar' ? 'لا توجد مهام معلقة حالياً. أضف مهمتك الأولى ونظم يومك!' : 'No pending tasks. Add one now!'}</p>
              </div>
            ) : (
              tasks.filter(t => !t.completed).map(task => (
                <div 
                  key={task.id}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 p-4 rounded-2xl flex items-center justify-between gap-3 transition-all shadow-md group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      onClick={() => handleCompleteTask(task.id)}
                      className="w-6 h-6 rounded-lg border-2 border-slate-600 hover:border-indigo-500 flex items-center justify-center transition-all bg-slate-950 flex-shrink-0"
                    ></button>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{task.text}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">{categoryIcons[task.category]} {task.category}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold ${
                          task.difficulty === 'صعب' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          task.difficulty === 'متوسط' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {task.difficulty}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-500" /> {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      {/* Sidebar Navigation (3 Dash Menu) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-start animate-fade-in">
          <div className="w-80 bg-[#0c101d] border-r border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <img src={userAvatar} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/50" />
                  <div>
                    <h3 className="text-sm font-bold text-white">{userName}</h3>
                    <p className="text-xs text-indigo-400">{lang === 'ar' ? 'طالب ومُنظم ذكي' : 'Smart Student'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Menu Links */}
              <div className="space-y-2">
                <button 
                  onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }}
                  className="w-full text-start px-4 py-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-all flex items-center gap-3"
                >
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>{lang === 'ar' ? 'الرئيسية والعدادات' : 'Home & Counters'}</span>
                </button>

                <button 
                  onClick={() => { setActiveTab('tasks'); setIsSidebarOpen(false); }}
                  className="w-full text-start px-4 py-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-all flex items-center gap-3"
                >
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  <span>{lang === 'ar' ? 'أرشيف وجميع المهام (اللي فاتك والمنجز)' : 'All Tasks & Missed Archive'}</span>
                </button>

                <button 
                  onClick={() => { setActiveTab('notes'); setIsSidebarOpen(false); }}
                  className="w-full text-start px-4 py-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-all flex items-center gap-3"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'ar' ? 'كشكش النوتس اليومية' : 'Notebook Journal'}</span>
                </button>
              </div>

              {/* Settings & Language */}
              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{lang === 'ar' ? 'الإعدادات واللغة' : 'Settings & Language'}</h4>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setLang('ar')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${lang === 'ar' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    العربية
                  </button>
                  <button 
                    onClick={() => setLang('en')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${lang === 'en' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    English
                  </button>
                </div>

                <button 
                  onClick={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>{lang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}</span>
                </button>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-500 pt-4 border-t border-slate-800">
              Tempo OS v3.0 • Private & Secure
            </div>
          </div>
        </div>
      )}
{/* Full Task View Tab Modal / Page */}
      {activeTab === 'tasks' && (
        <div className="fixed inset-0 z-40 bg-[#090d16] overflow-y-auto p-4 md:p-8 animate-fade-in">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{lang === 'ar' ? 'سجل المهام والذاكرة الشاملة' : 'Comprehensive Tasks Archive'}</h2>
                <p className="text-xs text-slate-400">{lang === 'ar' ? 'كل ما أنجزته، وكل ما فاتك (مستحيل حذفه)' : 'Everything completed and missed'}</p>
              </div>
              <button 
                onClick={() => setActiveTab('home')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold border border-slate-700"
              >
                {lang === 'ar' ? '← عودة للرئيسية' : '← Back Home'}
              </button>
            </div>

            {/* Permanent Missed Tasks Box (Never disappears, cannot be deleted) */}
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-rose-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{lang === 'ar' ? 'المهام التي فاتتك (محفوظة دائماً ولا يمكن حذفها)' : 'Missed Tasks Archive (Permanent)'}</span>
              </h3>
              {failedTasks.length === 0 ? (
                <p className="text-xs text-slate-400">{lang === 'ar' ? 'سجل المهام الفائتة نظيف تماماً! ممتاز.' : 'No missed tasks. Excellent!'}</p>
              ) : (
                <div className="space-y-2">
                  {failedTasks.map(ft => (
                    <div key={ft.id} className="bg-slate-900/80 border border-rose-500/20 p-3 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium line-through">{ft.text}</span>
                      <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-bold">{lang === 'ar' ? 'فائتة' : 'Missed'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed Tasks Box */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{lang === 'ar' ? 'المهام المنجزة' : 'Completed Tasks'}</span>
              </h3>
              <div className="space-y-2">
                {tasks.filter(t => t.completed).length === 0 ? (
                  <p className="text-xs text-slate-400">{lang === 'ar' ? 'لم تنجز أي مهمة بعد اليوم.' : 'No completed tasks yet.'}</p>
                ) : (
                  tasks.filter(t => t.completed).map(t => (
                    <div key={t.id} className="bg-slate-950/60 p-3 rounded-xl flex justify-between items-center text-xs border border-slate-800">
                      <span className="text-slate-200 font-medium">{t.text}</span>
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">{lang === 'ar' ? 'مُنجز ✓' : 'Done ✓'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes / Notebook Journal Tab Modal / Page */}
      {activeTab === 'notes' && (
        <div className="fixed inset-0 z-40 bg-[#090d16] overflow-y-auto p-4 md:p-8 animate-fade-in">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{lang === 'ar' ? 'كشكش النوتس اليومية' : 'Notebook Journal'}</h2>
                <p className="text-xs text-slate-400">{lang === 'ar' ? 'اكتب يومياتك بستايل كراسة ورقية حقيقية' : 'Write your journal in a vintage notebook style'}</p>
              </div>
              <button 
                onClick={() => setActiveTab('home')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold border border-slate-700"
              >
                {lang === 'ar' ? '← عودة للرئيسية' : '← Back Home'}
              </button>
            </div>

            {/* Notebook Paper Box: Beige/Brown with black lines */}
            <div className="bg-[#f5ebd6] text-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-[#e2d2b5] relative overflow-hidden min-h-[500px]">
              <div className="absolute top-0 left-0 bottom-0 w-8 bg-rose-400/20 border-r border-rose-400/40 pointer-events-none"></div>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب يومياتك وأفكارك هنا... (الكشكش يحفظ تلقائياً)' : 'Write your daily thoughts here...'}
                className="w-full h-[450px] bg-transparent resize-none focus:outline-none text-slate-900 text-base leading-[2.5rem] font-medium pl-6"
                style={{
                  backgroundImage: 'linear-gradient(#00000015 1px, transparent 1px)',
                  backgroundSize: '100% 2.5rem'
                }}
              ></textarea>
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{lang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{lang === 'ar' ? 'اسمك الكريم' : 'Your Name'}</label>
                <input 
                  type="text" 
                  value={userName} 
                  onChange={e => setUserName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">{lang === 'ar' ? 'صورة الغلاف/البروفيل (من الجهاز)' : 'Avatar URL / File'}</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setUserAvatar(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white"
                />
              </div>
            </div>

            <button 
              onClick={() => {
                localStorage.setItem('tempo_user_name', userName);
                localStorage.setItem('tempo_user_avatar', userAvatar);
                setIsProfileModalOpen(false);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all"
            >
              {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
            }
