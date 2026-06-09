/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X, Repeat2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { Habit, HabitLog } from "../types";
import { toLocalDateString } from "../utils";

const HABIT_COLORS: Record<
  NonNullable<Habit["color"]>,
  { dot: string; filled: string; label: string }
> = {
  emerald: { dot: "bg-emerald-500", filled: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400", label: "text-emerald-400" },
  sky:     { dot: "bg-sky-500",     filled: "bg-sky-500/20 border-sky-500/50 text-sky-400",             label: "text-sky-400" },
  violet:  { dot: "bg-violet-500",  filled: "bg-violet-500/20 border-violet-500/50 text-violet-400",    label: "text-violet-400" },
  rose:    { dot: "bg-rose-500",    filled: "bg-rose-500/20 border-rose-500/50 text-rose-400",          label: "text-rose-400" },
  amber:   { dot: "bg-amber-500",   filled: "bg-amber-500/20 border-amber-500/50 text-amber-400",       label: "text-amber-400" },
};

const DEFAULT_COLOR = HABIT_COLORS.emerald;

function getColorTheme(habit: Habit) {
  return habit.color ? HABIT_COLORS[habit.color] : DEFAULT_COLOR;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props {
  habit: Habit;
  onClose: () => void;
}

export default function HabitConsistencyModal({ habit, onClose }: Props) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const theme = getColorTheme(habit);

  // Load all habit-logs for this habit
  const logs =
    useLiveQuery(
      () =>
        (db.entries.where("habit_id").equals(habit.id).toArray() as Promise<HabitLog[]>),
      [habit.id],
    ) || [];

  // Build a Set of day strings where logs exist for the viewed month
  const loggedDaysInMonth = React.useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      const d = new Date(log.timestamp);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        set.add(toLocalDateString(d));
      }
    }
    return set;
  }, [logs, viewMonth, viewYear]);

  const totalThisMonth = loggedDaysInMonth.size;

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayStr = toLocalDateString(now);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const handlePrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const handleNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="habit-consistency-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 font-sans"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 12 }}
          transition={{ type: "spring", damping: 26, stiffness: 260 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-[#131313] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-stone-800/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`p-1.5 rounded-lg bg-stone-900 border border-stone-800 ${theme.label}`}>
                <Repeat2 className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-100 truncate">{habit.title}</p>
                <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
                  Consistency Calendar
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-3">
            <button
              onClick={handlePrev}
              className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <span className="text-xs font-mono font-bold text-stone-200 uppercase tracking-widest">
                {monthLabel}
              </span>
              <p className={`text-[10px] font-mono mt-0.5 ${theme.label}`}>
                {totalThisMonth} day{totalThisMonth !== 1 ? "s" : ""} logged
              </p>
            </div>
            <button
              onClick={handleNext}
              className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="px-4 pb-5">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map(wd => (
                <span
                  key={wd}
                  className="text-center text-[9px] font-mono font-bold text-stone-600 uppercase tracking-wider py-1"
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (day === null) return <span key={`blank-${idx}`} />;

                const cellDate = new Date(viewYear, viewMonth, day);
                const cellStr = toLocalDateString(cellDate);
                const isLogged = loggedDaysInMonth.has(cellStr);
                const isToday = cellStr === todayStr;
                const isFuture = cellDate > now && cellStr !== todayStr;

                return (
                  <div
                    key={cellStr}
                    className={`
                      aspect-square flex flex-col items-center justify-center rounded-lg border text-[11px] font-mono transition-all
                      ${isLogged
                        ? `${theme.filled} border font-bold`
                        : isToday
                          ? "border-stone-600 bg-stone-800/60 text-stone-300"
                          : isFuture
                            ? "border-stone-800/30 text-stone-700"
                            : "border-stone-800/50 text-stone-500"
                      }
                    `}
                  >
                    {day}
                    {isLogged && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${theme.dot}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
