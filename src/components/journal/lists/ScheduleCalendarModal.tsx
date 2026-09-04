/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '../../../types';

interface ScheduleCalendarModalProps {
  task: Task;
  onClose: () => void;
  onSelectDate: (taskId: string, date: Date) => void;
  onUnschedule: (taskId: string) => void;
}

export default function ScheduleCalendarModal({
  task,
  onClose,
  onSelectDate,
  onUnschedule,
}: ScheduleCalendarModalProps) {
  const today = new Date();
  const initialMonth = task.scheduled_at ? new Date(task.scheduled_at) : today;
  const [displayedMonth, setDisplayedMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  );

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const dayCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) dayCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) dayCells.push(d);

  const monthLabel = displayedMonth.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const handleDoToday = () => {
    onSelectDate(task.id, new Date());
    onClose();
  };

  const handleSelectDay = (day: number) => {
    const selected = new Date(year, month, day);
    const now = new Date();
    selected.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );
    onSelectDate(task.id, selected);
    onClose();
  };

  const handleUnschedule = () => {
    onUnschedule(task.id);
    onClose();
  };

  const scheduledDate = task.scheduled_at ? new Date(task.scheduled_at) : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl w-[340px] max-w-[90vw] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-1">
                Schedule Task
              </p>
              <p className="text-sm font-serif font-semibold text-stone-200 line-clamp-1">
                {task.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pt-2 pb-3">
            <button
              onClick={handleDoToday}
              className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono font-bold uppercase tracking-widest hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer active:scale-[0.98]"
            >
              ⚡ Do Today
            </button>
          </div>

          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setDisplayedMonth(new Date(year, month - 1, 1))}
                className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-stone-400 uppercase tracking-widest font-semibold">
                {monthLabel}
              </span>
              <button
                onClick={() => setDisplayedMonth(new Date(year, month + 1, 1))}
                className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs gap-1">
              {weekdays.map((wd) => (
                <span
                  key={wd}
                  className="text-stone-600 font-mono font-semibold py-1 text-[9px] uppercase tracking-widest"
                >
                  {wd}
                </span>
              ))}
              {dayCells.map((day, dIdx) => {
                if (day === null) return <span key={`blank-${dIdx}`} />;

                const cellDate = new Date(year, month, day);
                const isToday = isSameDay(cellDate, today);
                const isScheduledDay = scheduledDate
                  ? isSameDay(cellDate, scheduledDate)
                  : false;

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => handleSelectDay(day)}
                    className={`py-1.5 text-[11px] font-mono rounded-lg transition-all cursor-pointer active:scale-95 ${
                      isScheduledDay
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                        : isToday
                          ? 'border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/10'
                          : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {scheduledDate && (
            <div className="px-5 pb-4">
              <button
                onClick={handleUnschedule}
                className="w-full py-2 rounded-xl bg-stone-800/40 border border-stone-700/50 text-stone-400 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-stone-800/70 hover:text-stone-300 transition-all cursor-pointer"
              >
                Clear Scheduled Date
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
