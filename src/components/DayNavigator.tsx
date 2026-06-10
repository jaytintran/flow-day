/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  Target,
  Flag,
  Repeat2,
  Check,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';
import { Task, Habit, HabitLog } from '../types';
import { formatDateLabel, isSameDay, toLocalDateString } from '../utils';
import ObjectivesSheet from './ObjectivesSheet';
import GoalsSheet from './GoalsSheet';
import HabitsSheet from './HabitsSheet';

interface DayNavigatorProps {
  activeDate: Date;
  setActiveDate: (date: Date) => void;
  viewMode: 'day' | 'timeline' | 'records';
  setViewMode: (mode: 'day' | 'timeline' | 'records') => void;
}

export default function DayNavigator({
  activeDate,
  setActiveDate,
  viewMode,
  setViewMode,
}: DayNavigatorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isObjectivesOpen, setIsObjectivesOpen] = useState(false);
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [isHabitsOpen, setIsHabitsOpen] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date(activeDate));
  const containerRef = useRef<HTMLDivElement>(null);

  // Load entries reactively
  const entries = useLiveQuery(() => db.entries.toArray()) || [];

  // Habits for quick-tick strip
  const activeHabits = (useLiveQuery(() => db.habits.where('status').equals('active').toArray()) ||
    []) as Habit[];
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
      const log: HabitLog = {
        id: crypto.randomUUID(),
        type: 'habit-log',
        habit_id: habit.id,
        title: habit.title,
        timestamp: new Date(),
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

  // Previous incomplete tasks count
  const previousIncompleteTasksCount = React.useMemo(() => {
    return entries.filter((e) => {
      if (e.type !== 'task' || e.status !== 'todo') return false;
      const taskDayStr = toLocalDateString(new Date(e.created_at));
      return taskDayStr < activeDayStr;
    }).length;
  }, [entries, activeDayStr]);

  const handleTransferTasks = async () => {
    const previousTasks = entries.filter((e) => {
      if (e.type !== 'task' || e.status !== 'todo') return false;
      const taskDayStr = toLocalDateString(new Date(e.created_at));
      return taskDayStr < activeDayStr;
    }) as Task[];

    if (previousTasks.length === 0) return;

    await db.transaction('rw', db.entries, async () => {
      for (const t of previousTasks) {
        const oldD = new Date(t.created_at);
        const newD = new Date(activeDate);
        newD.setHours(
          oldD.getHours(),
          oldD.getMinutes(),
          oldD.getSeconds(),
          oldD.getMilliseconds(),
        );
        await db.entries.update(t.id, { created_at: newD });
      }
    });
  };

  // Sync displayed month with active date when calendar is opened
  useEffect(() => {
    if (isCalendarOpen) {
      setDisplayedMonth(new Date(activeDate));
    }
  }, [isCalendarOpen, activeDate]);

  // Click outside listener to close calendar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
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

  return (
    <div className="w-full border-t border-stone-800 bg-[#121212] text-sm" ref={containerRef}>
      <div
        className="max-w-4xl mx-auto px-5 md:px-6 py-3 flex flex-col gap-3 w-full"
        id="day-navigator-container"
      >
        <div className="flex md:flex-row flex-col items-center justify-between gap-4 w-full">
          {/* 1. Day Navigator Controls / Records Catalog Title */}
          {viewMode === 'records' ? (
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center gap-4">
                <span className="py-1.5 text-stone-100 text-sm font-mono tracking-widest uppercase text-center font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                  Personal Catalog Index
                </span>
              </div>
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
                  className="text-stone-100 hover:text-amber-500 text-sm font-mono tracking-widest uppercase cursor-pointer transition-colors text-center font-bold"
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

              {/* 3. Carry Over Incomplete Tasks Button */}
              {previousIncompleteTasksCount > 0 && (
                <button
                  id="transfer-tasks-btn"
                  onClick={handleTransferTasks}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer max-w-xs truncate shrink-0"
                  title={`Carry over ${previousIncompleteTasksCount} incomplete tasks from previous days to this date`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 fill-current shrink-0" />
                  <span>Carry Over ({previousIncompleteTasksCount})</span>
                </button>
              )}

              {/* 2. Icon button group: Goals / Objectives / Habits / Calendar */}
              <div className="flex items-center gap-1 bg-[#0a0a0a] border border-stone-800 rounded-lg p-0.5 shrink-0">
                {/* Goals / Projects */}
                <button
                  id="toggle-goals-btn"
                  onClick={() => setIsGoalsOpen(true)}
                  className={`p-1.5 rounded active:scale-95 transition-all flex items-center justify-center cursor-pointer ${'text-stone-500 hover:text-sky-400 hover:bg-sky-950/20'}`}
                  title="Goals / Projects"
                >
                  <Flag className="w-4 h-4" />
                </button>

                {/* Objectives */}
                <button
                  id="toggle-objectives-btn"
                  onClick={() => setIsObjectivesOpen(true)}
                  className={`p-1.5 rounded active:scale-95 transition-all flex items-center justify-center cursor-pointer ${'text-stone-500 hover:text-rose-400 hover:bg-rose-950/20'}`}
                  title="Objectives"
                >
                  <Target className="w-4 h-4" />
                </button>

                {/* Habits */}
                <button
                  id="toggle-habits-btn"
                  onClick={() => setIsHabitsOpen(true)}
                  className="p-1.5 rounded active:scale-95 transition-all flex items-center justify-center cursor-pointer text-stone-500 hover:text-emerald-400 hover:bg-emerald-950/20"
                  title="Habits"
                >
                  <Repeat2 className="w-4 h-4" />
                </button>

                {/* Calendar */}
                <button
                  id="toggle-calendar-btn"
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className={`p-1.5 rounded active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
                    isCalendarOpen
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'
                  }`}
                  title="Choose specific date"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 3. View Mode Switcher pill style */}
          <div
            className="flex gap-1 bg-stone-900 border border-stone-800 rounded-full p-1 w-full md:w-auto"
            id="view-mode-switcher"
          >
            <button
              id="view-mode-day"
              onClick={() => setViewMode('day')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer ${
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
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer ${
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
              className={`flex-1 md:flex-none px-4 py-2 rounded-full transition-all text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer ${
                viewMode === 'records'
                  ? 'bg-amber-500 text-black'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Records
            </button>
          </div>
        </div>

        {/* Quick-tick Habit strip — only when active habits exist */}
        {activeHabits.length > 0 && (
          <div className="flex items-center gap-2 w-full overflow-x-auto pb-0.5 md:flex-wrap md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {activeHabits.map((habit) => {
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
                  : 'border-stone-700 text-stone-500 hover:border-emerald-500/40 hover:text-emerald-400',
                sky: isTicked
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'border-stone-700 text-stone-500 hover:border-sky-500/40 hover:text-sky-400',
                violet: isTicked
                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                  : 'border-stone-700 text-stone-500 hover:border-violet-500/40 hover:text-violet-400',
                rose: isTicked
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'border-stone-700 text-stone-500 hover:border-rose-500/40 hover:text-rose-400',
                amber: isTicked
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'border-stone-700 text-stone-500 hover:border-amber-500/40 hover:text-amber-400',
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
                        <div className="w-full flex flex-row justify-center gap-0.5 mb-0.5 text-[8px] select-none">
                          {(stats.completedTasks > 0 || stats.incompleteTasks > 0) && (
                            <div className="flex items-center gap-0.5 justify-center leading-none">
                              {stats.completedTasks > 0 && (
                                <span
                                  className={
                                    isCurrentDay
                                      ? 'text-stone-900 font-extrabold'
                                      : 'text-emerald-500 font-extrabold'
                                  }
                                  title={`${stats.completedTasks} tasks complete`}
                                >
                                  ✅ {stats.completedTasks}
                                </span>
                              )}
                              {stats.incompleteTasks > 0 && (
                                <span
                                  className={
                                    isCurrentDay
                                      ? 'text-stone-800 font-bold'
                                      : 'text-stone-500 font-bold'
                                  }
                                  title={`${stats.incompleteTasks} tasks incomplete`}
                                >
                                  ⬜ {stats.incompleteTasks}
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
                              📝 {stats.recordsCount}
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
      {/* GOALS / PROJECTS SHEET */}
      <GoalsSheet open={isGoalsOpen} onClose={() => setIsGoalsOpen(false)} />

      {/* OBJECTIVES SHEET */}
      <ObjectivesSheet open={isObjectivesOpen} onClose={() => setIsObjectivesOpen(false)} />

      {/* HABITS SHEET */}
      <HabitsSheet
        open={isHabitsOpen}
        onClose={() => setIsHabitsOpen(false)}
        activeDate={activeDate}
      />
    </div>
  );
}
