/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Flame, Trophy, TrendingUp, Calendar, Sun, Zap, Moon, CheckCircle2 } from 'lucide-react';
import { Habit, HabitLog } from '../../../types';
import { calculateStreak, getHabitTheme } from '../../../lib/habitUtils';
import { toLocalDateString } from '../../../utils';

interface HabitAnalyticsViewProps {
  habits: Habit[];
  allLogs: HabitLog[];
  activeDate: Date;
}

export default function HabitAnalyticsView({ habits, allLogs, activeDate }: HabitAnalyticsViewProps) {
  // 1. Overall Consistency & Streak Leaderboard
  const leaderboard = useMemo(() => {
    return habits
      .map((h) => {
        const hLogs = allLogs.filter((l) => l.habit_id === h.id);
        const streakInfo = calculateStreak(h, hLogs, activeDate);
        return {
          habit: h,
          theme: getHabitTheme(h),
          ...streakInfo,
        };
      })
      .sort((a, b) => b.currentStreak - a.currentStreak || b.completionRate30d - a.completionRate30d);
  }, [habits, allLogs, activeDate]);

  // 2. Day-of-Week Distribution
  const weekdayStats = useMemo(() => {
    const days = [
      { name: 'Sun', count: 0, total: 0 },
      { name: 'Mon', count: 0, total: 0 },
      { name: 'Tue', count: 0, total: 0 },
      { name: 'Wed', count: 0, total: 0 },
      { name: 'Thu', count: 0, total: 0 },
      { name: 'Fri', count: 0, total: 0 },
      { name: 'Sat', count: 0, total: 0 },
    ];

    // Check last 60 days
    const now = new Date(activeDate);
    for (let i = 0; i < 60; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = toLocalDateString(d);
      const dayIdx = d.getDay();

      days[dayIdx].total += habits.length;

      const dayLogs = allLogs.filter(
        (l) => toLocalDateString(new Date(l.timestamp)) === dStr,
      );
      days[dayIdx].count += dayLogs.length;
    }

    return days.map((d) => ({
      ...d,
      rate: d.total > 0 ? Math.min(100, Math.round((d.count / d.total) * 100)) : 0,
    }));
  }, [habits, allLogs, activeDate]);

  // 3. 90-Day Contribution Heatmap Grid
  const heatmapDays = useMemo(() => {
    const grid: Array<{ dateStr: string; date: Date; count: number; level: number }> = [];
    const logCountByDate = new Map<string, number>();

    for (const log of allLogs) {
      const dStr = toLocalDateString(new Date(log.timestamp));
      logCountByDate.set(dStr, (logCountByDate.get(dStr) || 0) + 1);
    }

    // 12 weeks back (84 days)
    const now = new Date(activeDate);
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = toLocalDateString(d);
      const count = logCountByDate.get(dStr) || 0;

      let level = 0;
      if (count >= 1 && count <= 2) level = 1;
      else if (count >= 3 && count <= 4) level = 2;
      else if (count >= 5) level = 3;

      grid.push({ dateStr: dStr, date: d, count, level });
    }

    return grid;
  }, [allLogs, activeDate]);

  // Total Lifetime Completions
  const totalLogsCount = allLogs.length;
  const bestStreakOverall = Math.max(0, ...leaderboard.map((l) => l.longestStreak));
  const avg30dConsistency =
    leaderboard.length > 0
      ? Math.round(
          leaderboard.reduce((acc, l) => acc + l.completionRate30d, 0) / leaderboard.length,
        )
      : 0;

  return (
    <div className="w-full flex-1 overflow-y-auto space-y-6 pb-12 select-none pr-1">
      {/* Top Highlight Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-stone-850 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block">
              Longest Habit Streak
            </span>
            <span className="text-xl font-mono font-bold text-stone-100">{bestStreakOverall} Days</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-stone-850 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block">
              30-Day Avg Consistency
            </span>
            <span className="text-xl font-mono font-bold text-emerald-400">{avg30dConsistency}%</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-stone-850 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block">
              Lifetime Completions
            </span>
            <span className="text-xl font-mono font-bold text-sky-300">{totalLogsCount}</span>
          </div>
        </div>
      </div>

      {/* Activity Heatmap Grid */}
      <div className="p-5 rounded-2xl bg-[#0f0f0f] border border-stone-850 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-stone-200">12-Week Activity Heatmap</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-500">
            <span>Less</span>
            <span className="w-2.5 h-2.5 rounded-xs bg-[#181818]" />
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-950/70 border border-emerald-900" />
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700" />
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400" />
            <span>More</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2">
          {heatmapDays.map((d) => {
            const bgClass =
              d.level === 3
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                : d.level === 2
                  ? 'bg-emerald-600'
                  : d.level === 1
                    ? 'bg-emerald-950 border border-emerald-800/60'
                    : 'bg-[#181818] border border-stone-850';

            return (
              <div
                key={d.dateStr}
                className={`w-3.5 h-3.5 rounded-xs transition-transform hover:scale-125 ${bgClass}`}
                title={`${d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${
                  d.count
                } habit completion${d.count !== 1 ? 's' : ''}`}
              />
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Day of Week Analysis & Streaks Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
        {/* Day of Week Adherence */}
        <div className="p-5 rounded-2xl bg-[#0f0f0f] border border-stone-850 space-y-4">
          <h3 className="text-sm font-semibold text-stone-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" /> Day-of-Week Adherence
          </h3>

          <div className="space-y-2.5">
            {weekdayStats.map((w) => (
              <div key={w.name} className="flex items-center gap-3">
                <span className="w-8 text-xs font-mono text-stone-400">{w.name}</span>
                <div className="flex-1 h-3 rounded-full bg-stone-900 overflow-hidden border border-stone-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${w.rate}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-mono font-bold text-stone-300">
                  {w.rate}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Habits Leaderboard */}
        <div className="p-5 rounded-2xl bg-[#0f0f0f] border border-stone-850 space-y-4">
          <h3 className="text-sm font-semibold text-stone-200 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Consistency Leaderboard
          </h3>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {leaderboard.map((item, idx) => (
              <div
                key={item.habit.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-stone-900/60 border border-stone-850"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-xs font-mono font-bold text-stone-500 w-4">#{idx + 1}</span>
                  <span className={`w-2 h-2 rounded-full ${item.theme.dot} shrink-0`} />
                  <span className="text-xs font-medium text-stone-200 truncate max-w-[160px]">
                    {item.habit.title}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-amber-400 flex items-center gap-1 font-bold">
                    <Flame className="w-3 h-3" /> {item.currentStreak}d
                  </span>
                  <span className="text-stone-500 text-[11px]">{item.completionRate30d}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
