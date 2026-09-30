/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, ExternalLink, CheckCheck, Repeat2 } from 'lucide-react';
import { Habit } from '../types';
import { getHabitTheme } from '../lib/habitUtils';
import { toLocalDateString } from '../utils';

export interface HabitWeekDay {
  date: Date;
  dateStr: string;
  label: string;
  isToday: boolean;
  isActive: boolean;
}

interface Props {
  habit: Habit;
  /** The visible Mon–Sun week of the habit strip (same days shown in the sparkline) */
  weekDays: HabitWeekDay[];
  /** Local YYYY-MM-DD strings that already have a habit-log */
  loggedDayStrings: Set<string>;
  onToggleDay: (habit: Habit, date: Date) => void;
  onTickAllRemaining: (habit: Habit, days: HabitWeekDay[]) => void;
  onOpenMonth: (habit: Habit) => void;
  onOpenHabitView: () => void;
  onClose: () => void;
}

/**
 * Long-press mini-editor for a single habit.
 *
 * The habit strip itself is "one card = one tap for today"; deliberate backfill of the other
 * days of the week happens here, with 44px tap targets, so a stray thumb can never write to
 * the wrong day from the strip.
 */
export default function HabitWeekMiniModal({
  habit,
  weekDays,
  loggedDayStrings,
  onToggleDay,
  onTickAllRemaining,
  onOpenMonth,
  onOpenHabitView,
  onClose,
}: Props) {
  const theme = getHabitTheme(habit);
  const todayStr = toLocalDateString(new Date());

  const completedCount = weekDays.filter((d) => loggedDayStrings.has(d.dateStr)).length;
  const remainingDays = weekDays.filter(
    (d) => d.dateStr <= todayStr && !loggedDayStrings.has(d.dateStr),
  );

  const weekStart = weekDays[0]?.date;
  const weekEnd = weekDays[weekDays.length - 1]?.date;
  const rangeLabel =
    weekStart && weekEnd
      ? `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : '';

  return (
    <AnimatePresence>
      <motion.div
        key="habit-week-mini-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] flex items-end sm:items-center justify-center sm:p-4 font-sans"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 24 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md bg-[#131313] border border-stone-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Mobile drag affordance */}
          <div className="w-10 h-1 rounded-full bg-stone-700 mx-auto mt-2 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-800/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dot}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-100 truncate">{habit.title}</p>
                <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
                  {rangeLabel} · {completedCount}/{weekDays.length} done
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close week editor"
              className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shrink-0 touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pt-4">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {weekDays.map((d) => (
                <span
                  key={`label-${d.dateStr}`}
                  className={`text-center text-[9px] font-mono font-bold uppercase tracking-wider ${
                    d.isToday ? 'text-amber-400' : 'text-stone-600'
                  }`}
                >
                  {d.label}
                </span>
              ))}
            </div>

            {/* Day cells — 44px tall tap targets (no more 6px dashes) */}
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d) => {
                const isDone = loggedDayStrings.has(d.dateStr);
                const isFuture = d.dateStr > todayStr;

                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    disabled={isFuture}
                    aria-pressed={isDone}
                    aria-label={`${d.dateStr}${isDone ? ' completed' : ' not completed'}`}
                    title={`${d.label} ${d.dateStr} · ${isDone ? 'Completed' : 'Empty'}`}
                    onClick={() => onToggleDay(habit, d.date)}
                    className={`h-11 flex flex-col items-center justify-center rounded-lg border text-xs font-mono transition-all touch-manipulation ${
                      isFuture
                        ? 'border-stone-800/30 text-stone-700 cursor-not-allowed'
                        : isDone
                          ? `${theme.filled} font-bold cursor-pointer active:scale-95`
                          : d.isToday
                            ? 'border-amber-500/40 bg-stone-800/60 text-amber-300 cursor-pointer hover:bg-stone-800 active:scale-95'
                            : 'border-stone-800/60 text-stone-400 cursor-pointer hover:bg-stone-800/60 hover:text-stone-200 active:scale-95'
                    }`}
                  >
                    <span className="leading-none">{d.date.getDate()}</span>
                    <span
                      className={`w-1 h-1 rounded-full mt-1 ${
                        isDone ? theme.dot : 'bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <p className="mt-2.5 text-[9px] font-mono text-stone-600 uppercase tracking-wider text-center">
              Tap a day to toggle it · amber = today
            </p>
          </div>

          {/* Footer actions */}
          <div className="px-4 pb-5 pt-4 mt-3 border-t border-stone-800/60 flex flex-col gap-2">
            {remainingDays.length > 0 ? (
              <button
                type="button"
                onClick={() => onTickAllRemaining(habit, weekDays)}
                className="w-full h-11 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold uppercase tracking-wider hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer touch-manipulation"
              >
                <CheckCheck className="w-4 h-4" />
                Tick all remaining ({remainingDays.length})
              </button>
            ) : (
              <div className="w-full h-11 flex items-center justify-center gap-1.5 rounded-xl bg-stone-900/60 border border-stone-800 text-stone-500 text-[11px] font-mono uppercase tracking-wider">
                <Repeat2 className="w-3.5 h-3.5" />
                {weekDays.every((d) => d.dateStr > todayStr) ? 'Future week' : 'Week complete'}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenMonth(habit)}
                className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 text-[11px] font-mono uppercase tracking-wider hover:border-stone-700 hover:text-stone-100 transition-all cursor-pointer active:scale-95 touch-manipulation"
              >
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                Month view
              </button>
              <button
                type="button"
                onClick={onOpenHabitView}
                className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 text-[11px] font-mono uppercase tracking-wider hover:border-stone-700 hover:text-stone-100 transition-all cursor-pointer active:scale-95 touch-manipulation"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                Open habit
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
