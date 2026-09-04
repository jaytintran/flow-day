/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sun, Zap, Moon, Clock, CheckCheck, Plus, Sparkles } from 'lucide-react';
import { triggerConfetti } from '../../../lib/confetti';
import { Habit, HabitLog, RoutineSlot, Purpose, Domain } from '../../../types';
import HabitItemCard from './HabitItemCard';
import { soundService } from '../../../services/audio';
import { toLocalDateString } from '../../../utils';
import { db } from '../../../db';

interface HabitRoutineCardsViewProps {
  habits: Habit[];
  allLogs: HabitLog[];
  activeDate: Date;
  purposes: Purpose[];
  domains: Domain[];
  onEditHabit: (habit: Habit) => void;
  onOpenCalendar: (habit: Habit) => void;
  onAddNewHabitWithSlot?: (slot: RoutineSlot) => void;
}

const ROUTINE_CONFIGS: Array<{
  id: RoutineSlot;
  label: string;
  desc: string;
  icon: typeof Sun;
  color: string;
  borderColor: string;
  bgAccent: string;
}> = [
  {
    id: 'morning',
    label: 'Morning Ritual',
    desc: '5:00 AM – 12:00 PM',
    icon: Sun,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgAccent: 'bg-amber-500/10',
  },
  {
    id: 'afternoon',
    label: 'Afternoon Focus',
    desc: '12:00 PM – 6:00 PM',
    icon: Zap,
    color: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    bgAccent: 'bg-sky-500/10',
  },
  {
    id: 'evening',
    label: 'Evening Wind-Down',
    desc: '6:00 PM – 5:00 AM',
    icon: Moon,
    color: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    bgAccent: 'bg-indigo-500/10',
  },
  {
    id: 'anytime',
    label: 'Anytime Routines',
    desc: 'Flexible Daily Habits',
    icon: Clock,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgAccent: 'bg-emerald-500/10',
  },
];

export default function HabitRoutineCardsView({
  habits,
  allLogs,
  activeDate,
  purposes,
  domains,
  onEditHabit,
  onOpenCalendar,
  onAddNewHabitWithSlot,
}: HabitRoutineCardsViewProps) {
  const activeDateStr = toLocalDateString(activeDate);

  // Group habits by routine_slot
  const groupedHabits = React.useMemo(() => {
    const groups: Record<RoutineSlot, Habit[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      anytime: [],
    };

    for (const h of habits) {
      const slot = h.routine_slot || 'anytime';
      if (groups[slot]) {
        groups[slot].push(h);
      } else {
        groups.anytime.push(h);
      }
    }
    return groups;
  }, [habits]);

  // Bulk complete all remaining habits in a routine block
  const handleCompleteRoutineBlock = async (slot: RoutineSlot) => {
    const slotHabits = groupedHabits[slot] || [];
    const loggedHabitIds = new Set(
      allLogs
        .filter((l) => toLocalDateString(new Date(l.timestamp)) === activeDateStr)
        .map((l) => l.habit_id),
    );

    const uncompleted = slotHabits.filter((h) => !loggedHabitIds.has(h.id));
    if (uncompleted.length === 0) return;

    const now = new Date();
    const logTimestamp = new Date(activeDate);
    logTimestamp.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );

    const logsToAdd: HabitLog[] = uncompleted.map((h) => ({
      id: crypto.randomUUID(),
      type: 'habit-log',
      habit_id: h.id,
      title: h.title,
      timestamp: logTimestamp,
      created_at: new Date(),
      value: h.target_value || undefined,
    }));

    await db.entries.bulkAdd(logsToAdd as any);
    soundService.playCompleteSound();

    triggerConfetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#34d399', '#38bdf8', '#fbbf24'],
    });
  };

  return (
    <div className="w-full flex-1 overflow-y-auto space-y-6 pb-8 select-none pr-1">
      {ROUTINE_CONFIGS.map((cfg) => {
        const slotHabits = groupedHabits[cfg.id] || [];
        if (slotHabits.length === 0 && cfg.id === 'afternoon') {
          // If no afternoon habits, still render clean or collapsible
        }

        const Icon = cfg.icon;

        // Calculate completed count in this routine block
        const loggedHabitIds = new Set(
          allLogs
            .filter((l) => toLocalDateString(new Date(l.timestamp)) === activeDateStr)
            .map((l) => l.habit_id),
        );
        const completedCount = slotHabits.filter((h) => loggedHabitIds.has(h.id)).length;
        const totalCount = slotHabits.length;
        const allDone = totalCount > 0 && completedCount === totalCount;

        return (
          <section key={cfg.id} className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center justify-between px-1 py-1.5 border-b border-stone-850">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg border ${cfg.bgAccent} ${cfg.borderColor} ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-stone-200">{cfg.label}</h3>
                    <span className="text-[10px] font-mono text-stone-500">({cfg.desc})</span>
                  </div>
                </div>
              </div>

              {/* Header Right Actions: Progress Badge & Complete All */}
              <div className="flex items-center gap-2">
                {totalCount > 0 && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                      allDone
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-stone-900 border-stone-800 text-stone-400'
                    }`}
                  >
                    {completedCount}/{totalCount} completed
                  </span>
                )}

                {totalCount > 0 && !allDone && (
                  <button
                    type="button"
                    onClick={() => handleCompleteRoutineBlock(cfg.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95"
                    title={`Complete all remaining ${totalCount - completedCount} habits in ${cfg.label}`}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Complete Routine</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onAddNewHabitWithSlot?.(cfg.id)}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
                  title={`Add Habit to ${cfg.label}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cards Grid */}
            {slotHabits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 w-full">
                {slotHabits.map((habit) => (
                  <HabitItemCard
                    key={habit.id}
                    habit={habit}
                    activeDate={activeDate}
                    allLogs={allLogs}
                    purposes={purposes}
                    domains={domains}
                    onEdit={onEditHabit}
                    onOpenCalendar={onOpenCalendar}
                  />
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-xl border border-dashed border-stone-850 text-center bg-[#0a0a0a]/50">
                <p className="text-xs text-stone-600">No {cfg.label.toLowerCase()} habits configured</p>
                <button
                  type="button"
                  onClick={() => onAddNewHabitWithSlot?.(cfg.id)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add a routine habit
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
