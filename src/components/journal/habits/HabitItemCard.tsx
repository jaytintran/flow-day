/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Flame,
  Shield,
  MoreHorizontal,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Calendar,
  Compass,
  Globe,
  Plus,
  Minus,
  Sun,
  Zap,
  Moon,
  Clock,
} from 'lucide-react';
import { triggerConfetti } from '../../../lib/confetti';
import { Habit, HabitLog, Purpose, Domain } from '../../../types';
import { getHabitTheme, calculateStreak } from '../../../lib/habitUtils';
import { soundService } from '../../../services/audio';
import { toLocalDateString } from '../../../utils';
import { db } from '../../../db';

interface HabitItemCardProps {
  habit: Habit;
  activeDate: Date;
  allLogs: HabitLog[];
  purposes: Purpose[];
  domains: Domain[];
  onEdit: (habit: Habit) => void;
  onOpenCalendar: (habit: Habit) => void;
  isArchived?: boolean;
}

export default function HabitItemCard({
  habit,
  activeDate,
  allLogs,
  purposes,
  domains,
  onEdit,
  onOpenCalendar,
  isArchived = false,
}: HabitItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const theme = getHabitTheme(habit);
  const activeDateStr = toLocalDateString(activeDate);

  // All logs for this habit
  const habitLogs = allLogs.filter((l) => l.habit_id === habit.id);
  const todayLog = habitLogs.find(
    (l) => toLocalDateString(new Date(l.timestamp)) === activeDateStr,
  );
  const isCompletedToday = Boolean(todayLog);

  // Streaks & Consistency
  const streakInfo = calculateStreak(habit, habitLogs, activeDate);

  // Purpose & Domain entities
  const linkedPurposes = (habit.purpose_ids || [])
    .map((pid) => purposes.find((p) => p.id === pid))
    .filter(Boolean) as Purpose[];
  const linkedDomains = (habit.domain_ids || [])
    .map((did) => domains.find((d) => d.id === did))
    .filter(Boolean) as Domain[];

  // 14-day history dots
  const recentDays = React.useMemo(() => {
    const days: Array<{ date: Date; dateStr: string; isDone: boolean; isToday: boolean }> = [];
    const loggedDates = new Set(habitLogs.map((l) => toLocalDateString(new Date(l.timestamp))));

    for (let i = 13; i >= 0; i--) {
      const d = new Date(activeDate);
      d.setDate(activeDate.getDate() - i);
      const dStr = toLocalDateString(d);
      days.push({
        date: d,
        dateStr: dStr,
        isDone: loggedDates.has(dStr),
        isToday: dStr === activeDateStr,
      });
    }
    return days;
  }, [habitLogs, activeDate, activeDateStr]);

  // Toggle or Update Log
  const handleToggle = async () => {
    if (isArchived) return;

    if (isCompletedToday && todayLog) {
      await db.entries.delete(todayLog.id);
      soundService.playStrikeSound();
    } else {
      const logTimestamp = new Date(activeDate);
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

      // Confetti burst on streak milestones (e.g. 7, 21, 30, 50, 100) or high streak
      if ((streakInfo.currentStreak + 1) % 7 === 0 || streakInfo.currentStreak + 1 === 21) {
        triggerConfetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#38bdf8', '#f59e0b', '#ec4899'],
        });
      }
    }
  };

  // Stepper for Numeric Measurable Habit
  const handleNumericStep = async (delta: number) => {
    if (isArchived) return;
    const currentVal = todayLog?.value || 0;
    const nextVal = Math.max(0, currentVal + delta);

    if (nextVal === 0 && todayLog) {
      await db.entries.delete(todayLog.id);
      soundService.playStrikeSound();
    } else if (todayLog) {
      await db.entries.update(todayLog.id, { value: nextVal } as any);
      soundService.playClickSound();
    } else if (nextVal > 0) {
      const logTimestamp = new Date(activeDate);
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
        value: nextVal,
      };
      await db.entries.add(newLog as any);
      soundService.playCompleteSound();
    }
  };

  const handleArchive = async () => {
    await db.habits.update(habit.id, { status: 'archived' });
    setMenuOpen(false);
  };

  const handleUnarchive = async () => {
    await db.habits.update(habit.id, { status: 'active' });
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    await db.habits.delete(habit.id);
    await db.entries.where('habit_id').equals(habit.id).delete();
    setIsDeleting(false);
    setMenuOpen(false);
  };

  const RoutineIcon =
    habit.routine_slot === 'morning'
      ? Sun
      : habit.routine_slot === 'afternoon'
        ? Zap
        : habit.routine_slot === 'evening'
          ? Moon
          : Clock;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 bg-[#0f0f0f] select-none ${
        isCompletedToday
          ? `${theme.border} bg-gradient-to-br from-[#121212] to-[#0d1410]`
          : 'border-stone-850 hover:border-stone-750 hover:bg-[#121212]'
      } ${isArchived ? 'opacity-60' : ''}`}
    >
      {/* Top Header Row: Icon/Slot Tag + Title + Context Menu */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Completion Check Circle */}
          {!isArchived && (
            <button
              type="button"
              onClick={handleToggle}
              className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-all cursor-pointer mt-0.5 active:scale-90 ${
                isCompletedToday
                  ? `${theme.filled} ring-2 ring-emerald-500/20 shadow-md`
                  : 'border-stone-700 bg-stone-900/60 hover:border-stone-500 text-transparent'
              }`}
              title={isCompletedToday ? 'Mark Incomplete' : 'Mark Complete'}
            >
              <Check
                className={`w-4 h-4 stroke-[3] transition-transform duration-200 ${
                  isCompletedToday ? 'scale-100' : 'scale-0'
                }`}
              />
            </button>
          )}

          {/* Title & Frequency/Slot Badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {/* Routine Slot Pill */}
              {habit.routine_slot && (
                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400 flex items-center gap-1">
                  <RoutineIcon className="w-2.5 h-2.5" />
                  {habit.routine_slot}
                </span>
              )}

              {/* Frequency Pill */}
              {habit.frequency_type === 'weekly_target' && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-amber-400">
                  {habit.target_days_per_week}× / week
                </span>
              )}

              {habit.frequency_type === 'specific_days' && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-sky-400">
                  {(habit.target_weekdays || []).length} days / wk
                </span>
              )}
            </div>

            <h4
              onClick={() => !isArchived && onEdit(habit)}
              className={`text-sm font-semibold truncate cursor-pointer transition-colors ${
                isCompletedToday
                  ? 'text-stone-100 font-medium'
                  : 'text-stone-200 hover:text-white'
              } ${isArchived ? 'line-through text-stone-500' : ''}`}
            >
              {habit.title}
            </h4>
          </div>
        </div>

        {/* Action Menu Trigger */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-7 z-50 bg-[#191919] border border-stone-750 rounded-xl shadow-2xl flex flex-col overflow-hidden min-w-[140px] py-1">
              <button
                type="button"
                onClick={() => {
                  onEdit(habit);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Habit
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenCalendar(habit);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-amber-400 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" /> Calendar
              </button>
              {!isArchived ? (
                <button
                  type="button"
                  onClick={handleArchive}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-amber-400 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnarchive}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-emerald-400 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Unarchive
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> {isDeleting ? 'Confirm Delete?' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Measurable Progress Stepper (if habit has numeric target) */}
      {habit.target_value && habit.target_value > 0 && !isArchived && (
        <div className="mt-3 p-2.5 rounded-xl bg-stone-900/70 border border-stone-850 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase text-stone-500 block">Progress</span>
            <span className="text-xs font-mono font-bold text-stone-200">
              {todayLog?.value || 0} / {habit.target_value} {habit.unit || ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleNumericStep(-1)}
              className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-all active:scale-95"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleNumericStep(1)}
              className="w-6 h-6 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center transition-all active:scale-95 font-bold"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Middle: 14-Day Sparkline Dots */}
      <div className="mt-4 pt-3 border-t border-stone-850/80 flex items-center justify-between gap-1">
        {recentDays.map((d) => (
          <div
            key={d.dateStr}
            className={`flex-1 h-2 rounded-[2px] transition-all ${
              d.isDone
                ? theme.dashActive
                : d.isToday
                  ? 'bg-stone-700 ring-1 ring-amber-400/50'
                  : 'bg-stone-850'
            }`}
            title={`${d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${
              d.isDone ? 'Completed' : 'Skipped'
            }`}
          />
        ))}
      </div>

      {/* Bottom Footer Row: Streak Badge + Consistency + Linked Purpose */}
      <div className="mt-3 flex items-center justify-between text-xs font-mono">
        {/* Streak Counter with Grace Rule Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold ${
              streakInfo.currentStreak > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
            title={`Current Streak: ${streakInfo.currentStreak} days (Best: ${streakInfo.longestStreak} days)`}
          >
            <Flame
              className={`w-3.5 h-3.5 ${
                streakInfo.currentStreak > 0 ? 'text-amber-400 fill-amber-400/30' : 'text-stone-600'
              }`}
            />
            <span>{streakInfo.currentStreak}d</span>
          </div>

          {/* Atomic Habits Grace Shield */}
          {streakInfo.hasGraceToday && (
            <span
              className="flex items-center gap-0.5 text-[9px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded"
              title="Never Miss Twice: Grace day active. Complete tomorrow to maintain streak!"
            >
              <Shield className="w-2.5 h-2.5" />
              Grace
            </span>
          )}
        </div>

        {/* 30-Day Completion Rate */}
        <span className="text-[10px] text-stone-500 font-mono">
          {streakInfo.completionRate30d}% (30d)
        </span>
      </div>

      {/* Linked Purpose / Domain Chips */}
      {(linkedPurposes.length > 0 || linkedDomains.length > 0) && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          {linkedPurposes.map((p) => (
            <span
              key={p.id}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-1"
            >
              <Compass className="w-2.5 h-2.5" />
              {p.title}
            </span>
          ))}
          {linkedDomains.map((d) => (
            <span
              key={d.id}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-teal-300 flex items-center gap-1"
            >
              <Globe className="w-2.5 h-2.5" />
              {d.title}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
