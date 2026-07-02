/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Sparkles,
  Target,
  Flag,
  Repeat2,
  Check,
  ListTodo,
  Trophy,
  Star,
  Plus,
  Trash,
  Search,
  Edit3,
  X,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';
import { Task, Habit, HabitLog, TaskAchievement } from '../types';
import { formatDateLabel, isSameDay, toLocalDateString } from '../utils';

interface DayNavigatorProps {
  activeDate: Date;
  setActiveDate: (date: Date) => void;
  viewMode: 'tasks' | 'day' | 'timeline' | 'records' | 'hub';
  setViewMode: (mode: 'day' | 'timeline' | 'records' | 'tasks' | 'hub') => void;
  activeHubTab?: 'goals' | 'objectives' | 'habits' | 'focus';
  setActiveHubTab?: (tab: 'goals' | 'objectives' | 'habits' | 'focus') => void;
}

export default function DayNavigator({
  activeDate,
  setActiveDate,
  viewMode,
  setViewMode,
  activeHubTab,
  setActiveHubTab,
}: DayNavigatorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTrophyOpen, setIsTrophyOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [newAchievementText, setNewAchievementText] = useState<Record<string, string>>({});
  const [logWinText, setLogWinText] = useState('');
  const [editingAchievementId, setEditingAchievementId] = useState<string | null>(null);
  const [editingAchievementText, setEditingAchievementText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingDateTaskId, setEditingDateTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date(activeDate));
  const containerRef = useRef<HTMLDivElement>(null);

  // Load entries reactively
  const entries = useLiveQuery(() => db.entries.toArray()) || [];

  // Load achievements / starred tasks reactively
  const starredTasks = (useLiveQuery(() => 
    db.entries.where('type').equals('task').toArray()
  ) || []) as Task[];

  const availableYears = React.useMemo(() => {
    const yearsSet = new Set<string>();
    starredTasks.forEach((t) => {
      if (t.status === 'done' && (t.starred || (t.achievements && t.achievements.length > 0))) {
        const d = t.completed_at ? new Date(t.completed_at) : new Date(t.created_at);
        yearsSet.add(d.getFullYear().toString());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [starredTasks]);

  const availableMonths = React.useMemo(() => {
    const monthsSet = new Set<number>();
    starredTasks.forEach((t) => {
      if (t.status === 'done' && (t.starred || (t.achievements && t.achievements.length > 0))) {
        const d = t.completed_at ? new Date(t.completed_at) : new Date(t.created_at);
        if (filterYear === 'All' || d.getFullYear().toString() === filterYear) {
          monthsSet.add(d.getMonth());
        }
      }
    });
    return Array.from(monthsSet).sort((a, b) => a - b);
  }, [starredTasks, filterYear]);

  const totalStats = React.useMemo(() => {
    const completedStarred = starredTasks.filter(
      (t) => t.status === 'done' && (t.starred || (t.achievements && t.achievements.length > 0))
    );
    const totalWins = completedStarred.length;
    
    const now = new Date();
    const currentMonthWins = completedStarred.filter((t) => {
      const d = t.completed_at ? new Date(t.completed_at) : new Date(t.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    const totalSubAchievements = completedStarred.reduce(
      (sum, t) => sum + (t.achievements?.length ?? 0),
      0
    );

    let badge = 'Novice';
    let badgeColor = 'text-stone-400 border-stone-850 bg-stone-900/40';
    if (totalWins >= 30) {
      badge = 'Grandmaster';
      badgeColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    } else if (totalWins >= 15) {
      badge = 'Champion';
      badgeColor = 'text-yellow-500 border-yellow-550/20 bg-yellow-550/5';
    } else if (totalWins >= 5) {
      badge = 'Rising Star';
      badgeColor = 'text-orange-400 border-orange-550/20 bg-orange-550/5';
    }

    return { totalWins, currentMonthWins, totalSubAchievements, badge, badgeColor };
  }, [starredTasks]);

  const groupedAchievementsList = React.useMemo(() => {
    const completedStarred = starredTasks
      .filter((t) => t.status === 'done' && (t.starred || (t.achievements && t.achievements.length > 0)))
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesAchievements = t.achievements?.some((a) =>
          a.text.toLowerCase().includes(query)
        ) ?? false;
        return matchesTitle || matchesAchievements;
      })
      .filter((t) => {
        if (filterYear === 'All') return true;
        const d = t.completed_at ? new Date(t.completed_at) : new Date(t.created_at);
        return d.getFullYear().toString() === filterYear;
      })
      .filter((t) => {
        if (filterMonth === 'All') return true;
        const d = t.completed_at ? new Date(t.completed_at) : new Date(t.created_at);
        return d.getMonth().toString() === filterMonth;
      })
      .sort((a, b) => {
        const dateA = a.completed_at ? new Date(a.completed_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.completed_at ? new Date(b.completed_at).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA;
      });

    const groupsMap: { [key: string]: { label: string; year: number; month: number; tasks: Task[] } } = {};
    completedStarred.forEach((task) => {
      const date = task.completed_at ? new Date(task.completed_at) : new Date(task.created_at);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthName = date.toLocaleString('en-US', { month: 'long' });
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          label: `${monthName} ${year}`,
          year,
          month,
          tasks: [],
        };
      }
      groupsMap[key].tasks.push(task);
    });

    return Object.keys(groupsMap)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => groupsMap[key]);
  }, [starredTasks, searchQuery, filterYear, filterMonth]);

  // Habits for quick-tick strip (sorted by sort_order)
  const activeHabits = (useLiveQuery(() => db.habits.where('status').equals('active').toArray()) ||
    []) as Habit[];
  const sortedActiveHabits = React.useMemo(
    () =>
      [...activeHabits].sort(
        (a, b) =>
          (a.sort_order ?? Date.parse(a.created_at.toString())) -
          (b.sort_order ?? Date.parse(b.created_at.toString())),
      ),
    [activeHabits],
  );
  const habitLogs = (useLiveQuery(
    () => db.entries.where('type').equals('habit-log').toArray() as Promise<HabitLog[]>,
  ) || []) as HabitLog[];

  const activeDateStr = toLocalDateString(activeDate);

  const handleQuickTick = async (habit: Habit) => {
    const todayLogs = habitLogs.filter(
      (l) => l.habit_id === habit.id && toLocalDateString(new Date(l.timestamp)) === activeDateStr,
    );
    if (todayLogs.length > 0) {
      await db.entries.delete(todayLogs[todayLogs.length - 1].id);
    } else {
      const logTimestamp = new Date(activeDate);
      const now = new Date();
      logTimestamp.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      );

      const log: HabitLog = {
        id: crypto.randomUUID(),
        type: 'habit-log',
        habit_id: habit.id,
        title: habit.title,
        timestamp: logTimestamp,
        created_at: new Date(),
      };
      await db.entries.add(log as any);
    }
  };

  const dayStatsMap = React.useMemo(() => {
    const map: {
      [dayStr: string]: {
        completedTasks: number;
        incompleteTasks: number;
        recordsCount: number;
      };
    } = {};

    entries.forEach((e) => {
      const d =
        e.type === 'time-block'
          ? e.start_at
          : e.type === 'event' || e.type === 'note'
            ? e.timestamp
            : e.created_at;
      const dayStr = toLocalDateString(new Date(d));

      if (!map[dayStr]) {
        map[dayStr] = {
          completedTasks: 0,
          incompleteTasks: 0,
          recordsCount: 0,
        };
      }

      if (e.type === 'task') {
        if (e.status === 'done') {
          map[dayStr].completedTasks++;
        } else {
          map[dayStr].incompleteTasks++;
        }
      } else if (e.type === 'event' || e.type === 'note') {
        map[dayStr].recordsCount++;
      }
    });

    return map;
  }, [entries]);

  const activeDayStr = toLocalDateString(activeDate);

  // Sync displayed month with active date when calendar is opened
  useEffect(() => {
    if (isCalendarOpen) {
      setDisplayedMonth(new Date(activeDate));
    }
  }, [isCalendarOpen, activeDate]);

  // Click outside listener to close calendar & trophy drawers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
        setIsTrophyOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Shifting active day
  const handlePrevDay = () => {
    const prev = new Date(activeDate);
    prev.setDate(prev.getDate() - 1);
    setActiveDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(activeDate);
    next.setDate(next.getDate() + 1);
    setActiveDate(next);
  };

  const handleJumpToToday = () => {
    setActiveDate(new Date());
  };

  // Month grid computations
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth(); // 0-11
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0(Sun) - 6(Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setDisplayedMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setDisplayedMonth(new Date(year, month + 1, 1));
  };

  // Weekdays header
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Grid list construction
  const dayCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    dayCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    dayCells.push(d);
  }

  const handleSelectCalendarDay = (day: number) => {
    const selected = new Date(year, month, day);
    setActiveDate(selected);
    setIsCalendarOpen(false);
  };

  const monthLabel = displayedMonth.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const iconButtonGroup = (
    <div className="flex items-center gap-0.5 bg-[#0a0a0a] border border-stone-800 rounded-lg p-0.5 shrink-0">
      <button
        id="toggle-calendar-btn"
        onClick={() => {
          setIsCalendarOpen(!isCalendarOpen);
          setIsTrophyOpen(false);
        }}
        className={`p-1.5 rounded-lg active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
          isCalendarOpen
            ? 'bg-amber-500/10 text-amber-500'
            : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'
        }`}
        title="Choose specific date"
      >
        <Calendar className="w-[18px] h-[18px]" />
      </button>
      <button
        id="toggle-trophy-btn"
        onClick={() => {
          setIsTrophyOpen(!isTrophyOpen);
          setIsCalendarOpen(false);
        }}
        className={`p-1.5 rounded-lg active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
          isTrophyOpen
            ? 'bg-amber-500/10 text-amber-500'
            : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'
        }`}
        title="Achievements & Highlighted wins"
      >
        <Trophy className="w-[18px] h-[18px]" />
      </button>
    </div>
  );

  return (
    <div className="w-full border-t border-stone-800 bg-[#121212] text-sm" ref={containerRef}>
      <div
        className={`${viewMode === 'hub' ? 'md:max-w-9xl' : 'max-w-4xl'} mx-auto px-5 md:px-6 py-3 flex flex-col gap-3 w-full"
        id="day-navigator-container`}
      >
        <div className="flex md:flex-row flex-col items-center justify-between gap-4 w-full">
          {/* 1. Day Navigator Controls / Records Catalog Title */}
          {viewMode === 'records' || viewMode === 'tasks' || viewMode === 'hub' ? (
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center gap-4">
                <span className="py-1.5 text-stone-100 text-sm font-mono tracking-widest uppercase text-center font-bold flex items-center gap-2">
                  {viewMode === 'records' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                      Personal Catalog Index
                    </>
                  ) : viewMode === 'tasks' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                      All Active Tasks
                    </>
                  ) : viewMode === 'hub' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                      System Hub
                    </>
                  ) : viewMode === 'focus' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                      Focus
                    </>
                  ) : null}
                </span>
              </div>

              {/* 2. Icon button group: Calendar only */}
              {iconButtonGroup}
            </div>
          ) : (
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center gap-4">
                <button
                  id="prev-day-btn"
                  onClick={handlePrevDay}
                  className="text-stone-500 hover:text-stone-300 active:scale-95 transition-all cursor-pointer p-1"
                  title="Yesterday"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  id="jump-today-btn"
                  onClick={handleJumpToToday}
                  className="text-stone-100 hover:text-amber-500 text-sm font-mono tracking-widest uppercase cursor-pointer transition-colors text-center font-bold flex items-center gap-2"
                  title="Back to Today"
                >
                  {formatDateLabel(activeDate)}
                </button>

                <button
                  id="next-day-btn"
                  onClick={handleNextDay}
                  className="text-stone-500 hover:text-stone-300 active:scale-95 transition-all cursor-pointer p-1"
                  title="Tomorrow"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 2. Icon button group: Calendar only */}
              {iconButtonGroup}
            </div>
          )}

          {/* 3. View Mode Switcher pill style */}
          <div
            className="flex gap-1 bg-stone-900 border border-stone-800 rounded-full p-1 w-full md:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            id="view-mode-switcher"
          >
            <button
              id="view-mode-tasks"
              onClick={() => setViewMode('tasks')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all duration-200 text-[11px] uppercase font-bold tracking-widest font-mono cursor-pointer whitespace-nowrap ${
                viewMode === 'tasks'
                  ? 'bg-emerald-500 text-black'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Tasks
            </button>
            <button
              id="view-mode-day"
              onClick={() => setViewMode('day')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all duration-200 text-[11px] uppercase font-bold tracking-widest font-mono cursor-pointer whitespace-nowrap ${
                viewMode === 'day'
                  ? 'bg-amber-500 text-black'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Day
            </button>

            <button
              id="view-mode-timeline"
              onClick={() => setViewMode('timeline')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all duration-200 text-[11px] uppercase font-bold tracking-widest font-mono cursor-pointer whitespace-nowrap ${
                viewMode === 'timeline'
                  ? 'bg-amber-500 text-black'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Timeline
            </button>
            <button
              id="view-mode-records"
              onClick={() => setViewMode('records')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all duration-200 text-[11px] uppercase font-bold tracking-widest font-mono cursor-pointer whitespace-nowrap ${
                viewMode === 'records'
                  ? 'bg-amber-500 text-black'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Records
            </button>
            <button
              id="view-mode-hub"
              onClick={() => setViewMode('hub')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all duration-200 text-[11px] uppercase font-bold tracking-widest font-mono cursor-pointer whitespace-nowrap ${
                viewMode === 'hub'
                  ? 'bg-amber-500 text-black'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Hub
            </button>
          </div>
        </div>

        {/* Quick-tick Habit strip — only when active habits exist */}
        {sortedActiveHabits.length > 0 && (
          <div className="flex items-center gap-2 w-full overflow-x-auto pb-0.5 md:flex-wrap md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {sortedActiveHabits.map((habit) => {
              const logsToday = habitLogs.filter(
                (l) =>
                  l.habit_id === habit.id &&
                  toLocalDateString(new Date(l.timestamp)) === activeDateStr,
              );
              const count = logsToday.length;
              const isTicked = count > 0;
              const colorMap: Record<string, string> = {
                emerald: isTicked
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'border-emerald-500/40 text-emerald-400',
                sky: isTicked
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'border-sky-500/40 text-sky-400',
                violet: isTicked
                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                  : 'border-violet-500/40 text-violet-400',
                rose: isTicked
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'border-rose-500/40 text-rose-400',
                amber: isTicked
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'border-amber-500/40 text-amber-400',
              };
              const cls = colorMap[habit.color ?? 'emerald'] ?? colorMap.emerald;
              return (
                <button
                  key={habit.id}
                  onClick={() => handleQuickTick(habit)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wide transition-all active:scale-95 cursor-pointer shrink-0 ${cls}`}
                  title={isTicked ? `Uncheck "${habit.title}"` : `Check "${habit.title}"`}
                >
                  {isTicked && <Check className="w-3 h-3 stroke-[3]" />}
                  {habit.title}
                  {count > 1 && <span className="ml-0.5 opacity-70">×{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile sub-tab switcher for Hub */}
        {viewMode === 'hub' && (
          <div className="md:hidden flex gap-1 bg-[#0a0a0a] border border-stone-800 rounded-lg p-0.5 w-full">
            <button
              id="view-mode-hub"
              onClick={() => setActiveHubTab?.('focus')}
              className={`flex-1 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer transition-all ${
                activeHubTab === 'focus'
                  ? 'bg-indigo-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-stone-500 border border-transparent hover:text-stone-400'
              }`}
            >
              Focus
            </button>
            <button
              onClick={() => setActiveHubTab?.('goals')}
              className={`flex-1 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer transition-all ${
                activeHubTab === 'goals'
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-stone-500 border border-transparent hover:text-stone-400'
              }`}
            >
              Goals
            </button>
            <button
              onClick={() => setActiveHubTab?.('objectives')}
              className={`flex-1 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer transition-all ${
                activeHubTab === 'objectives'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'text-stone-500 border border-transparent hover:text-stone-400'
              }`}
            >
              Objectives
            </button>
            <button
              onClick={() => setActiveHubTab?.('habits')}
              className={`flex-1 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer transition-all ${
                activeHubTab === 'habits'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-stone-500 border border-transparent hover:text-stone-400'
              }`}
            >
              Habits
            </button>
          </div>
        )}
      </div>

      {/* FULL-WIDTH CALENDAR DRAWER */}
      <AnimatePresence initial={false}>
        {isCalendarOpen && (
          <motion.div
            id="calendar-drawer"
            key="calendar-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
            className="border-t border-stone-800/60 bg-[#0e0e0e]"
          >
            <div className="max-w-4xl mx-auto px-5 md:px-6 py-4">
              {/* Month header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  id="calendar-prev-month"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs text-stone-300 uppercase tracking-widest font-bold">
                  {monthLabel}
                </span>
                <button
                  id="calendar-next-month"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 text-center text-xs gap-1.5">
                {/* Weekday labels */}
                {weekdays.map((wd) => (
                  <span
                    key={wd}
                    className="text-stone-600 font-mono font-semibold py-1 text-[10px] uppercase tracking-widest"
                  >
                    {wd}
                  </span>
                ))}

                {/* Day cells */}
                {dayCells.map((day, dIdx) => {
                  if (day === null) {
                    return <span key={`blank-${dIdx}`} />;
                  }

                  const cellDate = new Date(year, month, day);
                  const cellDayStr = toLocalDateString(cellDate);
                  const isCurrentDay = isSameDay(cellDate, activeDate);
                  const isToday = isSameDay(cellDate, new Date());
                  const stats = dayStatsMap[cellDayStr];
                  const hasStats =
                    stats &&
                    (stats.completedTasks > 0 ||
                      stats.incompleteTasks > 0 ||
                      stats.recordsCount > 0);

                  return (
                    <button
                      key={`day-${day}`}
                      id={`calendar-day-btn-${day}`}
                      onClick={() => handleSelectCalendarDay(day)}
                      className={`py-1.5 min-h-[52px] flex flex-col justify-between items-center text-xs font-mono rounded-lg border transition-all cursor-pointer active:scale-95 ${
                        isCurrentDay
                          ? 'bg-amber-500 border-amber-400 text-stone-950 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                          : isToday
                            ? 'border-amber-500/30 bg-stone-900/40 text-amber-400 font-semibold'
                            : 'border-stone-800/50 text-stone-400 hover:bg-stone-800/60 hover:text-stone-200 hover:border-stone-700'
                      }`}
                    >
                      <span className="text-xs mt-1">{day}</span>

                      {hasStats ? (
                        <div className="w-full flex flex-row justify-center gap-1 mb-0.5 text-[9px] select-none leading-none">
                          {(stats.completedTasks > 0 || stats.incompleteTasks > 0) && (
                            <div className="flex items-center gap-0.5 justify-center">
                              {stats.completedTasks > 0 && (
                                <span
                                  className={
                                    isCurrentDay
                                      ? 'text-stone-900 font-extrabold'
                                      : 'text-emerald-500 font-bold'
                                  }
                                  title={`${stats.completedTasks} tasks complete`}
                                >
                                  <span className="mr-0.5">●</span>
                                  {stats.completedTasks}
                                </span>
                              )}
                              {stats.incompleteTasks > 0 && (
                                <span
                                  className={
                                    isCurrentDay
                                      ? 'text-stone-700 font-bold'
                                      : 'text-stone-500 font-bold'
                                  }
                                  title={`${stats.incompleteTasks} tasks incomplete`}
                                >
                                  <span className="mr-0.5">○</span>
                                  {stats.incompleteTasks}
                                </span>
                              )}
                            </div>
                          )}
                          {stats.recordsCount > 0 && (
                            <span
                              className={
                                isCurrentDay
                                  ? 'text-indigo-950 font-extrabold'
                                  : 'text-indigo-400 font-bold'
                              }
                              title={`${stats.recordsCount} events/notes`}
                            >
                              <span className="mr-0.5">◆</span>
                              {stats.recordsCount}
                            </span>
                          )}
                        </div>
                      ) : isToday && !isCurrentDay ? (
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mb-1" />
                      ) : (
                        <div className="h-1.5 w-1 mb-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TROPHY MODAL OVERLAY */}
      <AnimatePresence>
        {isTrophyOpen && (
          <motion.div
            id="trophy-modal"
            key="trophy-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setIsTrophyOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-[#0c0c0c] border border-stone-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.05)] flex flex-col overflow-hidden text-stone-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-850 bg-gradient-to-r from-amber-500/5 to-transparent">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Trophy className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-stone-100 font-mono">
                      Wall of Achievements
                    </h2>
                    <p className="text-[10px] text-stone-500 font-mono">
                      A visual catalog of your highlights and milestones
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsTrophyOpen(false)}
                  className="p-1.5 rounded-lg border border-stone-800 bg-stone-900/50 text-stone-500 hover:text-stone-300 hover:bg-stone-850 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-stone-950/60 border-b border-stone-850/80">
                <div className="flex flex-col p-3 rounded-xl border border-stone-850 bg-[#0e0e0e]/50">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono font-bold">Total Wins</span>
                  <span className="text-xl font-extrabold text-amber-500 font-mono mt-0.5">{totalStats.totalWins}</span>
                </div>
                <div className="flex flex-col p-3 rounded-xl border border-stone-850 bg-[#0e0e0e]/50">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono font-bold">This Month</span>
                  <span className="text-xl font-extrabold text-stone-100 font-mono mt-0.5">{totalStats.currentMonthWins}</span>
                </div>
                <div className="flex flex-col p-3 rounded-xl border border-stone-850 bg-[#0e0e0e]/50">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono font-bold">Sub-Wins</span>
                  <span className="text-xl font-extrabold text-stone-300 font-mono mt-0.5">{totalStats.totalSubAchievements}</span>
                </div>
                <div className={`flex flex-col p-3 rounded-xl border ${totalStats.badgeColor} justify-center`}>
                  <span className="text-[9px] uppercase tracking-widest text-amber-500/80 font-mono font-extrabold">Trophy Rank</span>
                  <span className="text-xs font-bold font-mono mt-0.5 uppercase tracking-wide truncate">{totalStats.badge}</span>
                </div>
              </div>

              {/* Quick Actions & Filters */}
              <div className="flex flex-col md:flex-row items-center gap-3 p-4 bg-[#0e0e0e]/30 border-b border-stone-850">
                {/* Log a Win */}
                <div className="flex items-center gap-2 w-full md:flex-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={logWinText}
                      onChange={(e) => setLogWinText(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && logWinText.trim()) {
                          const now = new Date();
                          const newTask = {
                            id: crypto.randomUUID(),
                            type: 'task' as const,
                            title: logWinText.trim(),
                            status: 'done' as const,
                            time_spent: 0,
                            created_at: now,
                            completed_at: now,
                            starred: true,
                          };
                          await db.entries.add(newTask as any);
                          setLogWinText('');
                        }
                      }}
                      placeholder="Add a new win directly to your wall..."
                      className="w-full bg-stone-950 border border-stone-850 hover:border-stone-800 rounded-xl pl-3 pr-8 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 transition-all font-mono"
                    />
                    <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500/40 pointer-events-none" />
                  </div>
                  <button
                    onClick={async () => {
                      if (!logWinText.trim()) return;
                      const now = new Date();
                      const newTask = {
                        id: crypto.randomUUID(),
                        type: 'task' as const,
                        title: logWinText.trim(),
                        status: 'done' as const,
                        time_spent: 0,
                        created_at: now,
                        completed_at: now,
                        starred: true,
                      };
                      await db.entries.add(newTask as any);
                      setLogWinText('');
                    }}
                    className="px-3 py-2 rounded-xl border border-stone-800 bg-[#0a0a0a] text-stone-400 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0 text-xs font-semibold"
                    title="Log a win"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log Win</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search achievements..."
                    className="w-full bg-stone-950 border border-stone-850 hover:border-stone-800 rounded-xl pl-8 pr-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 transition-all font-mono"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Year & Month filter strip */}
              <div className="flex items-center gap-3 px-6 py-2.5 bg-stone-950 border-b border-stone-850/80">
                {/* Year Dropdown Selector */}
                <div className="flex items-center gap-1.5 shrink-0 border-r border-stone-850 pr-3">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500 font-bold">Year:</span>
                  <select
                    value={filterYear}
                    onChange={(e) => {
                      setFilterYear(e.target.value);
                      setFilterMonth('All'); // Reset month selection when year changes
                    }}
                    className="bg-[#0e0e0e] border border-stone-800 rounded px-2 py-1 text-xs text-stone-300 font-mono focus:outline-none focus:border-amber-500/30"
                  >
                    <option value="All">All Years</option>
                    {availableYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Month Ribbon */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 flex-1">
                  <button
                    onClick={() => setFilterMonth('All')}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                      filterMonth === 'All'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5'
                        : 'border border-stone-850 text-stone-500 hover:text-stone-300 hover:border-stone-800'
                    }`}
                  >
                    All Months
                  </button>
                  {availableMonths.map((mIndex) => {
                    const label = new Date(2000, mIndex, 1).toLocaleString('en-US', { month: 'short' });
                    const isSelected = filterMonth === mIndex.toString();
                    return (
                      <button
                        key={mIndex}
                        onClick={() => setFilterMonth(mIndex.toString())}
                        className={`px-3 py-1 rounded-full text-xs font-mono transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5'
                            : 'border border-stone-850 text-stone-500 hover:text-stone-300 hover:border-stone-800'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid content */}
              <div className="flex-1 overflow-y-auto p-6 min-h-[30vh]">
                {groupedAchievementsList.length === 0 ? (
                  <div className="text-center py-16 text-stone-500 font-mono text-xs border border-dashed border-stone-800/80 rounded-2xl bg-stone-900/10">
                    <p className="mb-2 text-stone-300 font-bold text-sm">No accomplishments found</p>
                    {searchQuery ? (
                      <p className="text-stone-600">Try adjusting your search criteria.</p>
                    ) : (
                      <p className="text-[10px] text-stone-600">Complete tasks and mark them with a ⭐ to build momentum!</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 select-none">
                    {groupedAchievementsList.map((group) => (
                      <div key={group.label} className="flex flex-col gap-3">
                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500 border-b border-stone-850/60 pb-2 flex items-center justify-between">
                          <span>{group.label}</span>
                          <span className="text-[9px] text-stone-600 font-semibold">{group.tasks.length} {group.tasks.length === 1 ? 'win' : 'wins'}</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {group.tasks.map((task) => {
                            const dateObj = task.completed_at ? new Date(task.completed_at) : new Date(task.created_at);
                            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const isEditingDate = editingDateTaskId === task.id;
                            // Format for datetime-local input value: YYYY-MM-DDTHH:MM
                            const toDatetimeLocal = (d: Date) => {
                              const pad = (n: number) => String(n).padStart(2, '0');
                              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            };
                            const isExpanded = expandedCards[task.id] ?? false;
                            const inputText = newAchievementText[task.id] ?? '';
                            const isEditingTask = editingTaskId === task.id;

                            const handleAddAchievement = async () => {
                              const text = inputText.trim();
                              if (!text) return;
                              const entry: TaskAchievement = {
                                id: crypto.randomUUID(),
                                text,
                                created_at: new Date(),
                              };
                              const updated = [...(task.achievements ?? []), entry];
                              await db.entries.update(task.id, { achievements: updated } as any);
                              setNewAchievementText((prev) => ({ ...prev, [task.id]: '' }));
                            };

                            const handleSaveTaskTitle = async () => {
                              const newTitle = editingTaskTitle.trim();
                              if (newTitle) {
                                await db.entries.update(task.id, { title: newTitle } as any);
                              }
                              setEditingTaskId(null);
                            };

                            const handleDeleteTask = async () => {
                              if (confirm('Delete this win and all of its sub-achievements?')) {
                                await db.entries.delete(task.id);
                              }
                            };

                            return (
                              <div
                                key={task.id}
                                onClick={() => {
                                  if (!isEditingTask) {
                                    setExpandedCards((prev) => ({ ...prev, [task.id]: !prev[task.id] }));
                                  }
                                }}
                                className={`group/item flex flex-col p-4 rounded-xl border transition-all cursor-pointer shadow-md relative overflow-hidden ${
                                  isExpanded
                                    ? 'border-amber-500/25 bg-stone-900/60 shadow-[0_0_15px_rgba(245,158,11,0.03)]'
                                    : 'border-stone-850/70 bg-[#111111]/90 hover:bg-stone-900/80 hover:border-amber-500/25 hover:shadow-[0_0_10px_rgba(245,158,11,0.02)]'
                                }`}
                              >
                                {/* Backdrop glow on hover */}
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/[0.01] to-amber-500/0 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none" />

                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="relative shrink-0 mr-0.5">
                                      <Star className="w-4 h-4 text-amber-400 fill-amber-400/80 animate-pulse" />
                                      {task.achievements && task.achievements.length > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-[#0c0c0c] text-[8px] font-sans font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[#0c0c0c] leading-none">
                                          {task.achievements.length}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {isEditingTask ? (
                                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={editingTaskTitle}
                                          onChange={(e) => setEditingTaskTitle(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveTaskTitle();
                                            if (e.key === 'Escape') setEditingTaskId(null);
                                          }}
                                          autoFocus
                                          className="bg-[#0c0c0c] border border-stone-800 rounded px-2 py-1 text-xs text-amber-300 w-full focus:outline-none focus:border-amber-500/30"
                                        />
                                        <button
                                          onClick={handleSaveTaskTitle}
                                          className="p-1 text-emerald-400 hover:text-emerald-300"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setEditingTaskId(null)}
                                          className="p-1 text-red-400 hover:text-red-300"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className={`text-xs font-semibold transition-colors break-all ${isExpanded ? 'text-amber-300' : 'text-stone-200 group-hover/item:text-amber-300'} ${isExpanded ? '' : 'line-clamp-1'}`}>
                                        {task.title}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {!isEditingTask && (
                                      <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity gap-0.5">
                                        <button
                                          onClick={() => {
                                            setEditingTaskId(task.id);
                                            setEditingTaskTitle(task.title);
                                          }}
                                          className="p-1 rounded text-stone-500 hover:text-amber-400 hover:bg-stone-850/50 transition-colors"
                                          title="Edit Win Title"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={handleDeleteTask}
                                          className="p-1 rounded text-stone-500 hover:text-red-400 hover:bg-stone-850/50 transition-colors"
                                          title="Delete Win"
                                        >
                                          <Trash className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                    {isEditingDate ? (
                                       <input
                                         type="datetime-local"
                                         defaultValue={toDatetimeLocal(dateObj)}
                                         autoFocus
                                         onClick={(e) => e.stopPropagation()}
                                         onBlur={async (e) => {
                                           const val = e.target.value;
                                           if (val) {
                                             await db.entries.update(task.id, { completed_at: new Date(val) } as any);
                                           }
                                           setEditingDateTaskId(null);
                                         }}
                                         onKeyDown={async (e) => {
                                           if (e.key === 'Escape') setEditingDateTaskId(null);
                                           if (e.key === 'Enter') {
                                             const val = (e.target as HTMLInputElement).value;
                                             if (val) await db.entries.update(task.id, { completed_at: new Date(val) } as any);
                                             setEditingDateTaskId(null);
                                           }
                                         }}
                                         className="bg-[#0c0c0c] border border-amber-500/30 rounded px-1.5 py-0.5 text-[9px] font-mono text-amber-300 focus:outline-none w-[145px]"
                                       />
                                     ) : (
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setEditingDateTaskId(task.id);
                                         }}
                                         className="group/date text-[9px] font-mono text-stone-500 bg-stone-950 hover:bg-stone-900 px-2 py-0.5 rounded border border-stone-850 hover:text-amber-400 hover:border-amber-500/20 transition-colors cursor-pointer flex items-center gap-1"
                                         title="Edit date & time"
                                       >
                                         {dateStr}
                                       </button>
                                     )}
                                    <ChevronDown className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                  </div>
                                </div>

                                {/* Collapsible section */}
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                      style={{ overflow: 'hidden' }}
                                      className="mt-2.5"
                                    >
                                      {/* Sub-achievements list */}
                                      {task.achievements && task.achievements.length > 0 && (
                                        <div className="flex flex-col gap-1.5 pl-6 pb-2.5">
                                          {task.achievements.map((ach) => {
                                            const isEditingThis = editingAchievementId === ach.id;
                                            
                                            const commitEdit = async () => {
                                              const val = editingAchievementText.trim();
                                              let updated: TaskAchievement[];
                                              if (!val) {
                                                updated = (task.achievements ?? []).filter((x) => x.id !== ach.id);
                                              } else {
                                                updated = (task.achievements ?? []).map((x) =>
                                                  x.id === ach.id ? { ...x, text: val } : x
                                                );
                                              }
                                              await db.entries.update(task.id, { achievements: updated } as any);
                                              setEditingAchievementId(null);
                                            };

                                            const deleteAch = async () => {
                                              const updated = (task.achievements ?? []).filter((x) => x.id !== ach.id);
                                              await db.entries.update(task.id, { achievements: updated } as any);
                                            };

                                            return (
                                              <div
                                                key={ach.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (!isEditingThis) {
                                                    setEditingAchievementId(ach.id);
                                                    setEditingAchievementText(ach.text);
                                                  }
                                                }}
                                                className="group/ach flex items-center justify-between gap-2 p-2 rounded-lg border border-stone-850/80 bg-stone-950/40 hover:bg-stone-950 hover:border-amber-500/10 transition-all text-[11px] text-stone-300 font-mono"
                                              >
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                  <span className="text-amber-500/70 select-none shrink-0">🏆</span>
                                                  {isEditingThis ? (
                                                    <input
                                                      type="text"
                                                      value={editingAchievementText}
                                                      onChange={(e) => setEditingAchievementText(e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') commitEdit();
                                                        if (e.key === 'Escape') setEditingAchievementId(null);
                                                      }}
                                                      onBlur={commitEdit}
                                                      autoFocus
                                                      className="flex-1 bg-transparent text-amber-300 border-none outline-none p-0 m-0 w-full focus:ring-0"
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                  ) : (
                                                    <span className="break-all flex-1">{ach.text}</span>
                                                  )}
                                                </div>
                                                {!isEditingThis && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      deleteAch();
                                                    }}
                                                    className="opacity-0 group-hover/ach:opacity-100 p-0.5 text-stone-500 hover:text-red-400 transition-all cursor-pointer shrink-0"
                                                    title="Delete sub-achievement"
                                                  >
                                                    <Trash className="w-3 h-3" />
                                                  </button>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* Inline add achievement input */}
                                      <div
                                        className="flex items-center gap-1.5 pl-6 pt-2 border-t border-stone-850/40"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="text"
                                          value={inputText}
                                          onChange={(e) =>
                                            setNewAchievementText((prev) => ({ ...prev, [task.id]: e.target.value }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddAchievement();
                                          }}
                                          placeholder="Add sub-achievement..."
                                          className="flex-1 bg-stone-950 border border-stone-850 hover:border-stone-800 rounded-lg px-2.5 py-1.5 text-[11px] text-stone-200 placeholder-stone-700 focus:outline-none focus:border-amber-500/25 transition-colors font-mono"
                                        />
                                        <button
                                          onClick={handleAddAchievement}
                                          className="p-1.5 rounded-lg border border-stone-850 bg-stone-950 text-stone-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors cursor-pointer active:scale-95"
                                          title="Add sub-achievement"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
