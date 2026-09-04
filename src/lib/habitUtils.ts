/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Habit, HabitLog, RoutineSlot } from '../types';
import { toLocalDateString } from '../utils';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  isCompletedToday: boolean;
  hasGraceToday: boolean; // Missed today/yesterday but shielded by "Never Miss Twice"
  totalCompletions: number;
  completionRate30d: number; // 0-100%
}

export const ROUTINE_SLOTS: Array<{
  id: RoutineSlot;
  label: string;
  icon: string;
  desc: string;
  color: string;
}> = [
  { id: 'morning', label: 'Morning', icon: 'Sun', desc: '5:00 AM – 12:00 PM', color: 'text-amber-400' },
  { id: 'afternoon', label: 'Afternoon', icon: 'Zap', desc: '12:00 PM – 6:00 PM', color: 'text-sky-400' },
  { id: 'evening', label: 'Evening', icon: 'Moon', desc: '6:00 PM – 5:00 AM', color: 'text-indigo-400' },
  { id: 'anytime', label: 'Anytime', icon: 'Clock', desc: 'All-day routines', color: 'text-emerald-400' },
];

export const HABIT_THEMES: Record<
  NonNullable<Habit['color']>,
  {
    key: Habit['color'];
    label: string;
    dot: string;
    ring: string;
    filled: string;
    border: string;
    text: string;
    badgeBg: string;
    dashActive: string;
    sparkline: string;
  }
> = {
  emerald: {
    key: 'emerald',
    label: 'Emerald',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    filled: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dashActive: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
    sparkline: '#34d399',
  },
  sky: {
    key: 'sky',
    label: 'Sky',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500',
    filled: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
    border: 'border-sky-500/40',
    text: 'text-sky-400',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    dashActive: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]',
    sparkline: '#38bdf8',
  },
  violet: {
    key: 'violet',
    label: 'Violet',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500',
    filled: 'bg-violet-500/20 text-violet-300 border-violet-500/50',
    border: 'border-violet-500/40',
    text: 'text-violet-400',
    badgeBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    dashActive: 'bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]',
    sparkline: '#a78bfa',
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500',
    filled: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dashActive: 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]',
    sparkline: '#fb7185',
  },
  amber: {
    key: 'amber',
    label: 'Amber',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
    filled: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dashActive: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
    sparkline: '#fbbf24',
  },
};

export function getHabitTheme(habit: Habit) {
  return habit.color && HABIT_THEMES[habit.color] ? HABIT_THEMES[habit.color] : HABIT_THEMES.emerald;
}

/**
 * Returns current routine slot based on local clock time
 */
export function getRoutineSlotForCurrentTime(now = new Date()): RoutineSlot {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Checks whether a habit is scheduled on a given date
 */
export function isHabitScheduledForDate(habit: Habit, date: Date): boolean {
  if (!habit.frequency_type || habit.frequency_type === 'daily') {
    return true;
  }
  if (habit.frequency_type === 'specific_days') {
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    return (habit.target_weekdays ?? []).includes(dayOfWeek);
  }
  if (habit.frequency_type === 'weekly_target') {
    return true; // Scheduled as weekly goal
  }
  return true;
}

/**
 * Calculate habit streaks applying the "Never Miss Twice" Atomic Habits rule.
 * A single skipped day does not reset the streak if surrounded by completions.
 */
export function calculateStreak(
  habit: Habit,
  allHabitLogs: HabitLog[],
  activeDate: Date = new Date(),
): StreakInfo {
  const completedDateStrings = new Set<string>();
  for (const log of allHabitLogs) {
    if (log.habit_id === habit.id) {
      completedDateStrings.add(toLocalDateString(new Date(log.timestamp)));
    }
  }

  const today = new Date(activeDate);
  today.setHours(0, 0, 0, 0);

  const todayStr = toLocalDateString(today);
  const isCompletedToday = completedDateStrings.has(todayStr);

  // 30-Day Completion Rate
  let completionsIn30d = 0;
  let scheduledIn30d = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = toLocalDateString(d);
    const scheduled = isHabitScheduledForDate(habit, d);
    if (scheduled) {
      scheduledIn30d++;
      if (completedDateStrings.has(dStr)) {
        completionsIn30d++;
      }
    }
  }
  const completionRate30d =
    scheduledIn30d > 0 ? Math.round((completionsIn30d / scheduledIn30d) * 100) : 0;

  // Current Streak Calculation with "Never Miss Twice"
  let currentStreak = 0;
  let hasGraceToday = false;
  let missCount = 0;

  // Start from today or yesterday
  const cursor = new Date(today);

  // If not completed today, we check if today is counted as a pending grace day or if we start from yesterday
  if (!isCompletedToday) {
    if (isHabitScheduledForDate(habit, cursor)) {
      missCount = 1;
      hasGraceToday = true;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const dStr = toLocalDateString(cursor);
    const scheduled = isHabitScheduledForDate(habit, cursor);

    if (scheduled) {
      if (completedDateStrings.has(dStr)) {
        currentStreak++;
        missCount = 0; // Reset miss count when hit
      } else {
        missCount++;
        if (missCount > 1) {
          // Missed twice in a row: streak broken!
          break;
        }
      }
    }

    cursor.setDate(cursor.getDate() - 1);
    const daysBack = (today.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24);
    if (daysBack > 365) break;
  }

  // Longest Streak Calculation across all history
  const sortedDates = Array.from(completedDateStrings).sort();
  let longestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const currentDate = new Date(y, m - 1, d);

    if (!lastDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round(
        (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays === 2) {
        // 1 day gap allowed under "Never Miss Twice"
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    lastDate = currentDate;
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    isCompletedToday,
    hasGraceToday,
    totalCompletions: completedDateStrings.size,
    completionRate30d,
  };
}
