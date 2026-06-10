/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import {
  Repeat2,
  Plus,
  Check,
  Archive,
  Trash2,
  X,
  CalendarDays,
  ChevronDown,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';
import { db } from '../db';
import { Habit, HabitLog } from '../types';
import { toLocalDateString } from '../utils';
import HabitConsistencyModal from './HabitConsistencyModal';

interface HabitsSheetProps {
  open: boolean;
  onClose: () => void;
  /** The currently active date in the navigator — used for tick/check operations */
  activeDate: Date;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS: Array<{
  key: Habit['color'];
  dot: string;
  ring: string;
  filled: string;
  icon: string;
}> = [
  {
    key: 'emerald',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    filled: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
    icon: 'text-emerald-400',
  },
  {
    key: 'sky',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500',
    filled: 'bg-sky-500/15 border-sky-500/40 text-sky-400',
    icon: 'text-sky-400',
  },
  {
    key: 'violet',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500',
    filled: 'bg-violet-500/15 border-violet-500/40 text-violet-400',
    icon: 'text-violet-400',
  },
  {
    key: 'rose',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500',
    filled: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
    icon: 'text-rose-400',
  },
  {
    key: 'amber',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
    filled: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
    icon: 'text-amber-400',
  },
];
const DEFAULT_COLOR = COLORS[0];

function getColorSet(habit: Habit) {
  return COLORS.find((c) => c.key === habit.color) ?? DEFAULT_COLOR;
}

// ─── Mini 7-day strip ─────────────────────────────────────────────────────────

interface MiniStripProps {
  habitId: string;
  activeDate: Date;
  logs: HabitLog[];
  colorDot: string;
  colorFilled: string;
}

function MiniStrip({ habitId, activeDate, logs, colorDot, colorFilled }: MiniStripProps) {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(activeDate);
    d.setDate(activeDate.getDate() - i);
    days.push(d);
  }

  const loggedDays = React.useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      if (log.habit_id === habitId) {
        set.add(toLocalDateString(new Date(log.timestamp)));
      }
    }
    return set;
  }, [logs, habitId]);

  const todayStr = toLocalDateString(activeDate);

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {days.map((day) => {
        const dayStr = toLocalDateString(day);
        const isLogged = loggedDays.has(dayStr);
        const isToday = dayStr === todayStr;
        const label = day.toLocaleString('default', { weekday: 'narrow' });

        return (
          <div key={dayStr} className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-mono text-stone-600 uppercase">{label}</span>
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                isLogged
                  ? `${colorFilled} border`
                  : isToday
                    ? 'border-stone-500 bg-stone-800/50'
                    : 'border-stone-800 bg-transparent'
              }`}
            >
              {isLogged && <span className={`w-1.5 h-1.5 rounded-full ${colorDot}`} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HabitsSheet({ open, onClose, activeDate }: HabitsSheetProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState<Habit['color']>('emerald');
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState<Habit['color']>('emerald');
  const [consistencyHabit, setConsistencyHabit] = useState<Habit | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────

  const habits = useLiveQuery(() => db.habits.toArray()) || [];
  const activeHabits = habits.filter((h) => h.status === 'active');
  const archivedHabits = habits.filter((h) => h.status === 'archived');

  // Load ALL habit-logs for mini strip & check button (scoped to habit later)
  const allLogs =
    useLiveQuery(
      () => db.entries.where('type').equals('habit-log').toArray() as Promise<HabitLog[]>,
    ) || [];

  const activeDateStr = toLocalDateString(activeDate);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const t = newTitle.trim();
    if (!t) return;
    const habit: Habit = {
      id: crypto.randomUUID(),
      title: t,
      created_at: new Date(),
      status: 'active',
      color: newColor,
    };
    await db.habits.add(habit);
    setNewTitle('');
    inputRef.current?.focus();
  };

  /** Check / uncheck a habit for the active date */
  const handleToggleTick = async (habit: Habit) => {
    // Find existing log(s) for this habit on the active date
    const todayLogs = allLogs.filter(
      (l) => l.habit_id === habit.id && toLocalDateString(new Date(l.timestamp)) === activeDateStr,
    );
    if (todayLogs.length > 0) {
      // Already ticked → remove the most recent one
      await db.entries.delete(todayLogs[todayLogs.length - 1].id);
    } else {
      // Not ticked → add a log
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

  const startEdit = (habit: Habit) => {
    setEditingId(habit.id);
    setEditTitle(habit.title);
    setEditColor(habit.color);
  };

  const commitEdit = async (habit: Habit) => {
    const t = editTitle.trim();
    const updates: Partial<Habit> = {};
    if (t && t !== habit.title) updates.title = t;
    if (editColor !== habit.color) updates.color = editColor;
    if (Object.keys(updates).length > 0) {
      await db.habits.update(habit.id, updates);
    }
    setEditingId(null);
  };

  const handleArchive = async (habit: Habit) => {
    await db.habits.update(habit.id, { status: 'archived' });
  };

  const handleUnarchive = async (habit: Habit) => {
    await db.habits.update(habit.id, { status: 'active' });
  };

  const handleDelete = async (habit: Habit) => {
    if (deletingId !== habit.id) {
      setDeletingId(habit.id);
      return;
    }
    // Confirmed: delete habit + all its logs
    await db.habits.delete(habit.id);
    await db.entries.where('habit_id').equals(habit.id).delete();
    setDeletingId(null);
  };

  // ── Row renderer ──────────────────────────────────────────────────────────

  const renderHabitRow = (habit: Habit, isArchived = false) => {
    const cs = getColorSet(habit);
    const isEditing = editingId === habit.id;
    const isDeleting = deletingId === habit.id;

    const todayLogs = allLogs.filter(
      (l) => l.habit_id === habit.id && toLocalDateString(new Date(l.timestamp)) === activeDateStr,
    );
    const isTicked = todayLogs.length > 0;

    return (
      <div
        key={habit.id}
        className="flex flex-col gap-0 px-3 py-2.5 bg-[#0a0a0a] border border-stone-800/80 rounded-xl hover:border-stone-700 transition-colors group"
      >
        {/* Row 1: Check + title/edit + actions */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Check button */}
          {!isArchived && (
            <button
              onClick={() => handleToggleTick(habit)}
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                isTicked
                  ? `${cs.filled} border`
                  : 'border-stone-700 hover:border-stone-500 bg-transparent'
              }`}
              title={isTicked ? 'Uncheck habit for this day' : 'Check habit for this day'}
            >
              {isTicked && <Check className="w-3 h-3 stroke-[3]" />}
            </button>
          )}

          {/* Title / edit */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(habit);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => commitEdit(habit)}
                  className="w-full bg-transparent text-sm text-stone-100 border-b border-stone-600 focus:outline-none focus:border-stone-400 font-serif pb-0.5"
                />
                {/* Inline color picker */}
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-1">
                    {COLORS.map((c) => (
                      <button
                        key={c.key}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setEditColor(c.key)}
                        className={`w-3.5 h-3.5 rounded-full ${c.dot} transition-all cursor-pointer ${
                          editColor === c.key
                            ? `ring-2 ring-offset-1 ring-offset-[#0a0a0a] ${c.ring}`
                            : 'opacity-40 hover:opacity-80'
                        }`}
                        title={c.key}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => !isArchived && startEdit(habit)}
                className={`text-sm font-serif truncate block text-left w-full cursor-pointer ${
                  isArchived
                    ? 'text-stone-600 line-through cursor-default'
                    : 'text-stone-200 hover:text-white transition-colors'
                }`}
              >
                {habit.title}
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Consistency calendar — always visible */}
            <button
              onClick={() => setConsistencyHabit(habit)}
              className="p-1.5 rounded text-stone-600 hover:text-amber-400 hover:bg-amber-950/20 transition-all cursor-pointer"
              title="View consistency calendar"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>

            {/* Desktop hover actions */}
            {!isArchived && (
              <button
                onClick={() => handleArchive(habit)}
                className="hidden md:block opacity-0 group-hover:opacity-100 p-1.5 rounded text-stone-600 hover:text-amber-400 hover:bg-amber-950/20 transition-all cursor-pointer"
                title="Archive"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            )}

            {isArchived && (
              <button
                onClick={() => handleUnarchive(habit)}
                className="hidden md:block p-1.5 rounded text-stone-600 hover:text-emerald-400 hover:bg-emerald-950/20 transition-all cursor-pointer"
                title="Unarchive"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {isDeleting ? (
              <button
                onClick={() => handleDelete(habit)}
                className="px-2 py-1 text-[10px] bg-red-950/80 border border-red-800/80 rounded text-red-400 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer"
              >
                Sure?
              </button>
            ) : (
              <button
                onClick={() => handleDelete(habit)}
                className="hidden md:block opacity-0 group-hover:opacity-100 p-1.5 rounded text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Mobile ... menu */}
            <div className="relative md:hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === habit.id ? null : habit.id);
                }}
                className="p-1.5 rounded text-stone-600 hover:text-stone-400 transition-all cursor-pointer"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuOpenId === habit.id && (
                <div className="absolute right-0 top-8 z-50 bg-[#1a1a1a] border border-stone-700 rounded-lg shadow-xl flex flex-col overflow-hidden min-w-[130px]">
                  {!isArchived && (
                    <button
                      onClick={() => {
                        handleArchive(habit);
                        setMenuOpenId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-stone-400 hover:bg-stone-800 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" /> Archive
                    </button>
                  )}
                  {isArchived && (
                    <button
                      onClick={() => {
                        handleUnarchive(habit);
                        setMenuOpenId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-stone-400 hover:bg-stone-800 hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Unarchive
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleDelete(habit);
                      setMenuOpenId(null);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-stone-400 hover:bg-stone-800 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: 7-day mini strip (active habits only) */}
        {!isArchived && (
          <div className="pl-[30px]">
            <MiniStrip
              habitId={habit.id}
              activeDate={activeDate}
              logs={allLogs}
              colorDot={cs.dot}
              colorFilled={cs.filled}
            />
          </div>
        )}
      </div>
    );
  };

  // ── Sheet content ─────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800/60 px-4 py-3.5">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-1.5">
          <Repeat2 className="w-3 h-3" />
          Habits
        </span>
        <button
          onClick={onClose}
          className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {activeHabits.length > 0 && (
          <div className="pt-3 pb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-1">
              Active ({activeHabits.length})
            </span>
          </div>
        )}
        {activeHabits.map((h) => renderHabitRow(h, false))}

        {/* Archived section */}
        {archivedHabits.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived((s) => !s)}
              className="flex items-center gap-2 px-1 pt-4 pb-1 text-stone-500 hover:text-stone-400 transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showArchived ? '' : '-rotate-90'}`}
              />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest">
                Archived ({archivedHabits.length})
              </span>
            </button>
            <AnimatePresence>
              {showArchived && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  {archivedHabits.map((h) => renderHabitRow(h, true))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Create new habit */}
        <div className="px-4 pt-4 pb-2 border-b border-stone-800/40">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="New habit..."
              className="flex-1 bg-[#0a0a0a] text-stone-100 border border-stone-800 rounded-lg px-3 py-2 text-sm placeholder-stone-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
            <button
              onClick={handleCreate}
              className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-2 mt-2.5 px-0.5">
            <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest">
              Color:
            </span>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setNewColor(c.key)}
                  className={`w-4 h-4 rounded-full ${c.dot} transition-all cursor-pointer ${
                    newColor === c.key
                      ? `ring-2 ring-offset-1 ring-offset-[#131313] ${c.ring}`
                      : 'opacity-40 hover:opacity-70'
                  }`}
                  title={c.key}
                />
              ))}
            </div>
          </div>
        </div>

        {habits.length === 0 && (
          <div className="py-12 text-center text-stone-600">
            <Repeat2 className="w-8 h-8 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No habits yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create a habit above and tick it off daily to build consistency.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999]" />

            {isMobile ? (
              /* MOBILE BOTTOM SHEET */
              <div className="fixed inset-0 z-[999] flex items-end justify-center font-sans pointer-events-none">
                <div className="relative w-full h-[82vh] bg-[#121212] border-t border-stone-800 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pointer-events-auto animate-slide-up">
                  <div className="flex-none flex justify-center pt-3 pb-0">
                    <button
                      onClick={onClose}
                      className="w-12 h-1 bg-stone-700 hover:bg-stone-500 rounded-full transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
                </div>
              </div>
            ) : (
              /* DESKTOP MODAL */
              <div className="fixed inset-0 flex items-center justify-center z-[999] p-4 font-sans pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#121212] border border-stone-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col h-[85vh] pointer-events-auto"
                >
                  <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
                </motion.div>
              </div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Consistency modal — rendered outside AnimatePresence so it can persist when sheet is closed */}
      {consistencyHabit && (
        <HabitConsistencyModal habit={consistencyHabit} onClose={() => setConsistencyHabit(null)} />
      )}
    </>
  );
}
