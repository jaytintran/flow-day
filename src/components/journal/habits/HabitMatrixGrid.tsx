/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Check, Flame, Shield, Calendar, Plus, MoreHorizontal } from 'lucide-react';
import { Habit, HabitLog, Purpose, Domain } from '../../../types';
import { getHabitTheme, calculateStreak, isHabitScheduledForDate } from '../../../lib/habitUtils';
import { soundService } from '../../../services/audio';
import { toLocalDateString } from '../../../utils';
import { db } from '../../../db';

interface HabitMatrixGridProps {
  habits: Habit[];
  allLogs: HabitLog[];
  activeDate: Date;
  daysRange: number; // 7, 14, or 30
  onEditHabit: (habit: Habit) => void;
  onOpenCalendar: (habit: Habit) => void;
  onAddNewHabit: () => void;
  purposes: Purpose[];
  domains: Domain[];
}

export default function HabitMatrixGrid({
  habits,
  allLogs,
  activeDate,
  daysRange = 14,
  onEditHabit,
  onOpenCalendar,
  onAddNewHabit,
}: HabitMatrixGridProps) {
  const activeDateStr = toLocalDateString(activeDate);

  // Generate date columns
  const dateColumns = useMemo(() => {
    const dates: Array<{
      date: Date;
      dateStr: string;
      dayOfWeek: string;
      dayNum: number;
      monthName: string;
      isToday: boolean;
      isActive: boolean;
    }> = [];

    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date(activeDate);
      d.setDate(activeDate.getDate() - i);
      const dStr = toLocalDateString(d);
      dates.push({
        date: d,
        dateStr: dStr,
        dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday: dStr === toLocalDateString(new Date()),
        isActive: dStr === activeDateStr,
      });
    }
    return dates;
  }, [activeDate, daysRange, activeDateStr]);

  // Map logs for instant cell lookup: `[habitId_dateStr] -> HabitLog`
  const logMap = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of allLogs) {
      const dStr = toLocalDateString(new Date(log.timestamp));
      map.set(`${log.habit_id}_${dStr}`, log);
    }
    return map;
  }, [allLogs]);

  // Calculate daily totals across all habits
  const dailyTotals = useMemo(() => {
    const counts: Record<string, { completed: number; total: number }> = {};
    for (const col of dateColumns) {
      let completed = 0;
      let scheduled = 0;
      for (const h of habits) {
        if (isHabitScheduledForDate(h, col.date)) {
          scheduled++;
        }
        if (logMap.has(`${h.id}_${col.dateStr}`)) {
          completed++;
        }
      }
      counts[col.dateStr] = { completed, total: scheduled || habits.length };
    }
    return counts;
  }, [dateColumns, habits, logMap]);

  // Cell Toggle Handler
  const handleToggleCell = async (habit: Habit, date: Date) => {
    const dStr = toLocalDateString(date);
    const key = `${habit.id}_${dStr}`;
    const existingLog = logMap.get(key);

    if (existingLog) {
      await db.entries.delete(existingLog.id);
      soundService.playStrikeSound();
    } else {
      const logTimestamp = new Date(date);
      const now = new Date();
      logTimestamp.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      );

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

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 md:max-h-[70vh] bg-[#0c0c0c] border border-stone-850 rounded-2xl shadow-xl overflow-hidden select-none">
      {/* Scrollable Matrix Table Container */}
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-stone-800 [&::-webkit-scrollbar-track]:bg-transparent">
        <table className="w-full text-left border-collapse min-w-max">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-stone-800 bg-[#121212] sticky top-0 z-30">
              {/* Sticky Frozen Column Header */}
              <th className="sticky left-0 z-40 bg-[#141414] py-3.5 px-4 min-w-[220px] sm:min-w-[280px] max-w-[320px] border-r border-stone-800 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-bold">
                    Habit / Routine ({habits.length})
                  </span>
                  <button
                    type="button"
                    onClick={onAddNewHabit}
                    className="p-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
                    title="Add Habit"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </th>

              {/* Date Column Headers */}
              {dateColumns.map((col) => {
                const total = dailyTotals[col.dateStr]?.total || 1;
                const completed = dailyTotals[col.dateStr]?.completed || 0;
                const pct = Math.round((completed / total) * 100);

                return (
                  <th
                    key={col.dateStr}
                    className={`py-2 px-1 text-center min-w-[38px] sm:min-w-[46px] border-r border-stone-850/60 transition-colors ${
                      col.isToday ? 'bg-amber-500/10' : col.isActive ? 'bg-stone-850/40' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono uppercase text-stone-500 font-bold">
                        {col.dayOfWeek}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold my-0.5 ${
                          col.isToday
                            ? 'text-amber-400 underline underline-offset-2'
                            : 'text-stone-300'
                        }`}
                      >
                        {col.dayNum}
                      </span>

                      {/* Daily Completion Progress Bar */}
                      <div
                        className="w-5 h-1 rounded-full bg-stone-800 overflow-hidden mt-1"
                        title={`${completed}/${total} completed (${pct}%)`}
                      >
                        <div
                          className="h-full bg-emerald-400 transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-stone-850/80">
            {habits.map((habit) => {
              const theme = getHabitTheme(habit);
              const habitLogs = allLogs.filter((l) => l.habit_id === habit.id);
              const streakInfo = calculateStreak(habit, habitLogs, activeDate);

              return (
                <tr key={habit.id} className="hover:bg-stone-900/40 transition-colors group">
                  {/* Sticky Frozen Habit Row Header */}
                  <td className="sticky left-0 z-20 bg-[#111111] group-hover:bg-[#151515] py-2.5 px-4 border-r border-stone-800 shadow-[4px_0_12px_rgba(0,0,0,0.5)] transition-colors">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Theme Dot */}
                        <span className={`w-2 h-2 rounded-full ${theme.dot} shrink-0`} />

                        {/* Title & Routine Badge */}
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onEditHabit(habit)}
                            className="text-xs font-medium text-stone-200 hover:text-white truncate block text-left max-w-[180px] sm:max-w-[220px] cursor-pointer"
                            title={habit.title}
                          >
                            {habit.title}
                          </button>
                        </div>
                      </div>

                      {/* Streak Badge & Calendar Trigger */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Streak Badge */}
                        <div
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            streakInfo.currentStreak > 0
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'text-stone-600'
                          }`}
                          title={`Current Streak: ${streakInfo.currentStreak}d | Best: ${streakInfo.longestStreak}d`}
                        >
                          <Flame
                            className={`w-3 h-3 ${
                              streakInfo.currentStreak > 0 ? 'text-amber-400' : 'text-stone-700'
                            }`}
                          />
                          <span>{streakInfo.currentStreak}</span>
                        </div>

                        {/* Calendar Icon Button */}
                        <button
                          type="button"
                          onClick={() => onOpenCalendar(habit)}
                          className="p-1 rounded text-stone-600 hover:text-stone-300 hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          title="View Consistency Calendar"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Punch-Card Date Cells */}
                  {dateColumns.map((col) => {
                    const key = `${habit.id}_${col.dateStr}`;
                    const isDone = logMap.has(key);
                    const isScheduled = isHabitScheduledForDate(habit, col.date);

                    return (
                      <td
                        key={col.dateStr}
                        className={`p-1 text-center border-r border-stone-850/40 transition-colors ${
                          col.isToday ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleCell(habit, col.date)}
                          className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                            isDone
                              ? `${theme.filled} border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20`
                              : isScheduled
                                ? 'border-stone-800 hover:border-stone-600 bg-stone-900/30 text-transparent'
                                : 'border-dashed border-stone-850/60 bg-transparent text-stone-700/40 hover:border-stone-700'
                          }`}
                          title={`${habit.title} on ${col.monthName} ${col.dayNum}: ${
                            isDone ? 'Completed' : 'Incomplete'
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : !isScheduled ? (
                            <span className="text-[10px] select-none">·</span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Table Summary Footer */}
          <tfoot>
            <tr className="border-t border-stone-800 bg-[#121212] font-mono">
              <td className="sticky left-0 z-20 bg-[#141414] py-3 px-4 border-r border-stone-800 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Daily Completion Total
                </span>
              </td>

              {dateColumns.map((col) => {
                const total = dailyTotals[col.dateStr]?.total || 1;
                const completed = dailyTotals[col.dateStr]?.completed || 0;
                const isFull = completed > 0 && completed >= total;

                return (
                  <td
                    key={col.dateStr}
                    className="py-2.5 px-1 text-center border-r border-stone-850/60"
                  >
                    <span
                      className={`text-xs font-bold ${
                        isFull
                          ? 'text-emerald-400'
                          : completed > 0
                            ? 'text-stone-300'
                            : 'text-stone-600'
                      }`}
                    >
                      {completed}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
