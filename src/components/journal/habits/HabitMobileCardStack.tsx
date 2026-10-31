/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Check, Flame, Settings2, Calendar } from 'lucide-react';
import { Habit, HabitLog } from '../../../types';
import { getHabitTheme, calculateStreak, isHabitScheduledForDate } from '../../../lib/habitUtils';
import { soundService } from '../../../services/audio';
import { toLocalDateString } from '../../../utils';
import { db } from '../../../db';
import { triggerConfetti } from '../../../lib/confetti';

interface HabitMobileCardStackProps {
  habits: Habit[];
  allLogs: HabitLog[];
  activeDate: Date;
  daysRange: number; // 7, 14, or 30
  onEditHabit: (habit: Habit) => void;
  onOpenCalendar: (habit: Habit) => void;
}

interface HabitCardProps {
  habit: Habit;
  allLogs: HabitLog[];
  activeDate: Date;
  daysRange: number;
  onEditHabit: (habit: Habit) => void;
  onOpenCalendar: (habit: Habit) => void;
}

function HabitCard({
  habit,
  allLogs,
  activeDate,
  daysRange,
  onEditHabit,
  onOpenCalendar,
}: HabitCardProps) {
  const theme = getHabitTheme(habit);
  const todayStr = toLocalDateString(new Date());

  // All logs for this habit
  const habitLogs = useMemo(
    () => allLogs.filter((l) => l.habit_id === habit.id),
    [allLogs, habit.id],
  );

  const logMap = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of habitLogs) {
      const dStr = toLocalDateString(new Date(log.timestamp));
      map.set(dStr, log);
    }
    return map;
  }, [habitLogs]);

  const todayLog = logMap.get(todayStr);
  const isCompletedToday = Boolean(todayLog);

  // Streak & 30d stats
  const streakInfo = useMemo(
    () => calculateStreak(habit, habitLogs, activeDate),
    [habit, habitLogs, activeDate],
  );

  // Generate date columns based on daysRange ending on activeDate
  const dateColumns = useMemo(() => {
    const cols = [];
    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date(activeDate);
      d.setDate(activeDate.getDate() - i);
      const dStr = toLocalDateString(d);
      cols.push({
        date: d,
        dateStr: dStr,
        weekday: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        dayNum: d.getDate(),
        isToday: dStr === todayStr,
        isDone: logMap.has(dStr),
        isScheduled: isHabitScheduledForDate(habit, d),
      });
    }
    return cols;
  }, [activeDate, daysRange, logMap, todayStr, habit]);

  // Toggle a specific day's log
  const handleToggleDate = async (date: Date, dateStr: string) => {
    const existingLog = logMap.get(dateStr);
    if (existingLog) {
      await db.entries.delete(existingLog.id);
      soundService.playStrikeSound();
    } else {
      const logTimestamp = new Date(date);
      const now = new Date();
      logTimestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

      const newLog: HabitLog = {
        id: crypto.randomUUID(),
        type: 'habit-log',
        habit_id: habit.id,
        title: habit.title,
        timestamp: logTimestamp,
        created_at: new Date(),
        value: habit.target_value ? habit.target_value : undefined,
      };
      await db.entries.add(newLog as any);
      soundService.playCompleteSound();
    }
  };

  // Toggle today
  const handleToggleToday = async () => {
    const today = new Date();
    await handleToggleDate(today, todayStr);
    if (!isCompletedToday && ((streakInfo.currentStreak + 1) % 7 === 0 || streakInfo.currentStreak + 1 === 21)) {
      triggerConfetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#38bdf8', '#f59e0b', '#ec4899'],
      });
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl border bg-[#111111] transition-all ${
        isCompletedToday
          ? 'border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.04)]'
          : 'border-stone-850 hover:border-stone-800'
      }`}
    >
      {/* ── Top Header Row ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        {/* Left: Color dot + Habit Title (clickable) */}
        <button
          type="button"
          onClick={() => onEditHabit(habit)}
          className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
        >
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${theme.dot}`} />
          <span className="text-xs sm:text-sm font-semibold text-stone-200 group-hover:text-emerald-300 truncate transition-colors">
            {habit.title}
          </span>
        </button>

        {/* Right: Streak + 30D rate + Settings/Calendar icons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {streakInfo.currentStreak > 0 && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-mono font-bold"
              title={`Current streak: ${streakInfo.currentStreak}d`}
            >
              <Flame className="w-3 h-3 fill-amber-400/30" />
              {streakInfo.currentStreak}d
            </span>
          )}

          <span className="text-[10px] font-mono text-stone-500 hidden sm:inline" title="30-day completion rate">
            {streakInfo.completionRate30d}%
          </span>

          <button
            type="button"
            onClick={() => onOpenCalendar(habit)}
            className="p-1 rounded-md text-stone-500 hover:text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
            title="Consistency calendar"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onEditHabit(habit)}
            className="p-1 rounded-md text-stone-500 hover:text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
            title="Edit habit settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-stone-850/80 mx-3" />

      {/* ── Bottom Section: Punch Matrix Grid & Today Check Button ── */}
      <div className="px-3 py-2 flex items-center justify-between gap-3">
        {/* Punch Grid Area */}
        <div className="flex-1 min-w-0">
          {daysRange === 7 && (
            /* 7-Day Clean Row: 7 columns */
            <div className="grid grid-cols-7 gap-1">
              {dateColumns.map((col) => (
                <button
                  key={col.dateStr}
                  type="button"
                  onClick={() => handleToggleDate(col.date, col.dateStr)}
                  className={`flex flex-col items-center justify-center py-1 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                    col.isDone
                      ? `${theme.filled} border-emerald-500/40 shadow-sm`
                      : col.isToday
                        ? 'bg-amber-500/10 border-amber-500/30 text-stone-300'
                        : col.isScheduled
                          ? 'bg-stone-900/60 border-stone-800/80 hover:border-stone-700 text-stone-500'
                          : 'bg-transparent border-dashed border-stone-850 text-stone-750 hover:border-stone-700'
                  }`}
                  title={`${col.weekday} ${col.dayNum}: ${col.isDone ? 'Completed' : 'Incomplete'}`}
                >
                  <span className={`text-[9px] font-mono leading-none ${col.isToday ? 'text-amber-400 font-bold' : 'text-stone-500'}`}>
                    {col.weekday}
                  </span>
                  <span className={`text-[10px] font-mono mt-0.5 leading-none ${col.isToday ? 'text-amber-300 font-bold' : 'text-stone-400'}`}>
                    {col.dayNum}
                  </span>
                  <div className="mt-1 flex items-center justify-center h-2">
                    {col.isDone ? (
                      <Check className="w-2.5 h-2.5 stroke-[3] text-emerald-400" />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full ${col.isToday ? 'bg-amber-400/60' : 'bg-stone-750'}`} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {daysRange === 14 && (
            /* 14-Day Layout: 2 balanced rows of 7 days */
            <div className="flex flex-col gap-1">
              {/* Row 1 (first 7 days) */}
              <div className="grid grid-cols-7 gap-1">
                {dateColumns.slice(0, 7).map((col) => (
                  <button
                    key={col.dateStr}
                    type="button"
                    onClick={() => handleToggleDate(col.date, col.dateStr)}
                    className={`flex items-center justify-center h-6 rounded-md border text-[9px] font-mono transition-all cursor-pointer active:scale-95 ${
                      col.isDone
                        ? `${theme.filled} border-emerald-500/40`
                        : col.isToday
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-stone-900/60 border-stone-800/80 hover:border-stone-700 text-stone-500'
                    }`}
                    title={`${col.weekday} ${col.dayNum}: ${col.isDone ? 'Completed' : 'Incomplete'}`}
                  >
                    {col.isDone ? <Check className="w-3 h-3 stroke-[3]" /> : col.dayNum}
                  </button>
                ))}
              </div>
              {/* Row 2 (next 7 days) */}
              <div className="grid grid-cols-7 gap-1">
                {dateColumns.slice(7, 14).map((col) => (
                  <button
                    key={col.dateStr}
                    type="button"
                    onClick={() => handleToggleDate(col.date, col.dateStr)}
                    className={`flex items-center justify-center h-6 rounded-md border text-[9px] font-mono transition-all cursor-pointer active:scale-95 ${
                      col.isDone
                        ? `${theme.filled} border-emerald-500/40`
                        : col.isToday
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-bold'
                          : 'bg-stone-900/60 border-stone-800/80 hover:border-stone-700 text-stone-500'
                    }`}
                    title={`${col.weekday} ${col.dayNum}: ${col.isDone ? 'Completed' : 'Incomplete'}`}
                  >
                    {col.isDone ? <Check className="w-3 h-3 stroke-[3]" /> : col.dayNum}
                  </button>
                ))}
              </div>
            </div>
          )}

          {daysRange === 30 && (
            /* 30-Day Heatmap Micro-Grid: 3 rows of 10 */
            <div className="flex flex-col gap-1">
              {[0, 10, 20].map((startIndex) => (
                <div key={startIndex} className="grid grid-cols-10 gap-1">
                  {dateColumns.slice(startIndex, startIndex + 10).map((col) => (
                    <button
                      key={col.dateStr}
                      type="button"
                      onClick={() => handleToggleDate(col.date, col.dateStr)}
                      className={`h-5 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                        col.isDone
                          ? `${theme.filled} border-emerald-500/40`
                          : col.isToday
                            ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-400/40'
                            : 'bg-stone-900 border-stone-850 hover:border-stone-700'
                      }`}
                      title={`${col.weekday} ${col.dayNum}: ${col.isDone ? 'Completed' : 'Incomplete'}`}
                    >
                      {col.isDone && <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Far Right: Proportional Today Thumb Toggle Button (36x36) */}
        <div className="flex flex-col items-center flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleToday}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
              isCompletedToday
                ? `${theme.dot} text-black shadow-md shadow-emerald-950/40`
                : 'bg-stone-850/80 border border-stone-750 hover:border-stone-600 text-stone-500 hover:text-stone-300'
            }`}
            title={isCompletedToday ? 'Mark Today Incomplete' : 'Mark Today Complete'}
          >
            <Check className={`w-4 h-4 sm:w-5 sm:h-5 stroke-[2.8] ${isCompletedToday ? 'text-black' : 'text-stone-500'}`} />
          </button>
          <span className="text-[8px] font-mono uppercase text-stone-500 mt-1 tracking-wider">
            Today
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HabitMobileCardStack({
  habits,
  allLogs,
  activeDate,
  daysRange = 7,
  onEditHabit,
  onOpenCalendar,
}: HabitMobileCardStackProps) {
  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center mb-3">
          <Flame className="w-5 h-5 text-stone-600" />
        </div>
        <p className="text-stone-400 text-xs font-mono">No habits found</p>
        <p className="text-stone-600 text-[11px] font-mono mt-1">Tap "+ New Habit" to create one</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-4 overflow-y-auto flex-1 min-h-0">
      {habits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          allLogs={allLogs}
          activeDate={activeDate}
          daysRange={daysRange}
          onEditHabit={onEditHabit}
          onOpenCalendar={onOpenCalendar}
        />
      ))}
    </div>
  );
}
