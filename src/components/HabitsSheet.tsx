/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Globe,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { db } from '../db';
import { Habit, HabitLog } from '../types';
import { toLocalDateString } from '../utils';
import HabitConsistencyModal from './HabitConsistencyModal';
import SortableRow from './SortableRow';

import { Compass } from 'lucide-react';
import PurposePickerSheet from './PurposePickerSheet';
import DomainPickerSheet from './DomainPickerSheet';
import { Purpose, Domain } from '../types';

interface HabitsSheetProps {
  open?: boolean;
  onClose?: () => void;
  /** The currently active date in the navigator — used for tick/check operations */
  activeDate: Date;
  isInline?: boolean;
  highlightPurposeIds?: string[] | null;
  highlightDomainId?: string | null;
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
  onToggle: (date: Date) => void;
}

function MiniStrip({ habitId, activeDate, logs, colorDot, colorFilled, onToggle }: MiniStripProps) {
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

        // Custom label mapping
        const weekdayIndex = day.getDay();
        const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][weekdayIndex];

        return (
          <div key={dayStr} className="flex flex-col items-center gap-0.5 select-none scale-[0.9]">
            <span className="text-[8px] font-mono text-stone-600 uppercase">{label}</span>
            <button
              onClick={() => onToggle(day)}
              className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                isLogged
                  ? `${colorFilled} border`
                  : isToday
                    ? 'border-stone-500 bg-stone-800/50'
                    : 'border-stone-800 bg-transparent'
              }`}
            >
              {isLogged && <span className={`w-3 h-3 rounded-full ${colorDot}`} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HabitsSheet({
  open = false,
  onClose = () => {},
  activeDate,
  isInline = false,
  highlightPurposeIds,
  highlightDomainId,
}: HabitsSheetProps) {
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

  const [purposePickerTarget, setPurposePickerTarget] = useState<Habit | null>(null);
  const [domainPickerTarget, setDomainPickerTarget] = useState<Habit | null>(null);
  const purposes = (useLiveQuery(() => db.purposes.toArray()) || []) as Purpose[];
  const domains = (useLiveQuery(() => db.domains.toArray()) || []) as Domain[];
  const domainMap = React.useMemo(() => {
    const map: Record<string, Domain> = {};
    for (const d of domains) {
      map[d.id] = d;
    }
    return map;
  }, [domains]);

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

  // ── DnD reordering ───────────────────────────────────────────────────────

  const [optimisticHabits, setOptimisticHabits] = useState<Habit[] | null>(null);
  const displayActive = optimisticHabits ?? activeHabits;

  // Sort by sort_order (or created_at as fallback)
  const sortedActive = [...displayActive].sort(
    (a, b) =>
      (a.sort_order ?? Date.parse(a.created_at.toString())) -
      (b.sort_order ?? Date.parse(b.created_at.toString())),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Get the current sortable IDs (sorted)
      const ids = sortedActive.map((h) => h.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(ids, oldIndex, newIndex);

      // Optimistic update
      setOptimisticHabits((prev) => {
        const base = prev ?? activeHabits;
        const mapped = reordered.map((id, idx) => {
          const h = base.find((x) => x.id === id)!;
          return { ...h, sort_order: idx };
        });
        return mapped;
      });

      // Persist
      for (let i = 0; i < reordered.length; i++) {
        await db.habits.update(reordered[i], { sort_order: i });
      }

      // Clear optimistic after a beat so future adds/refetches still work
      setTimeout(() => setOptimisticHabits(null), 2000);
    },
    [activeHabits, sortedActive],
  );

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

  // Generic toggle for any date — replaces the inline handleToggleTick logic
  const handleToggleForDate = async (habit: Habit, date: Date) => {
    const dateStr = toLocalDateString(date);
    const logsForDate = allLogs.filter(
      (l) => l.habit_id === habit.id && toLocalDateString(new Date(l.timestamp)) === dateStr,
    );

    if (logsForDate.length > 0) {
      await db.entries.delete(logsForDate[logsForDate.length - 1].id);
    } else {
      const logTimestamp = new Date(date);
      const now = new Date();
      logTimestamp.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      );

      const log: HabitLog = {
        id: crypto.randomUUID(),
        type: 'habit-log',
        habit_id: habit.id,
        title: habit.title,
        timestamp: logTimestamp,
        created_at: new Date(),
      };
      await db.entries.add(log as any);
    }
  };

  /** Check / uncheck a habit for the active date */
  const handleToggleTick = (habit: Habit) => handleToggleForDate(habit, activeDate);

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

  const handlePurposeToggle = async (habit: Habit, purposeId: string) => {
    const current = habit.purpose_ids ?? [];
    const next = current.includes(purposeId)
      ? current.filter((id) => id !== purposeId)
      : [...current, purposeId];
    await db.habits.update(habit.id, { purpose_ids: next });
  };

  const handleDomainToggle = async (habit: Habit, domainId: string) => {
    const current = habit.domain_ids ?? [];
    const next = current.includes(domainId)
      ? current.filter((id) => id !== domainId)
      : [...current, domainId];
    await db.habits.update(habit.id, { domain_ids: next });
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

    const matchesHighlightedDomain = () => {
      if (!highlightDomainId) return true;
      if ((habit.domain_ids ?? []).includes(highlightDomainId)) return true;
      return (habit.purpose_ids ?? []).some((pid) => {
        const purpose = purposes.find((p) => p.id === pid);
        return (purpose?.domain_ids ?? []).includes(highlightDomainId);
      });
    };

    const isDimmedByPurpose =
      highlightPurposeIds != null &&
      highlightPurposeIds.length > 0 &&
      !(habit.purpose_ids ?? []).some((pid) => highlightPurposeIds.includes(pid));
    const isDimmedByDomain = highlightDomainId != null && !matchesHighlightedDomain();
    const isDimmed = isDimmedByPurpose || isDimmedByDomain;

    const todayLogs = allLogs.filter(
      (l) => l.habit_id === habit.id && toLocalDateString(new Date(l.timestamp)) === activeDateStr,
    );
    const isTicked = todayLogs.length > 0;

    return (
      <div
        key={habit.id}
        className={`flex flex-col gap-0 px-3 py-2.5 bg-[#0a0a0a] border border-stone-800/80 rounded-xl hover:border-stone-700 transition-colors group ${isDimmed ? 'opacity-50' : ''}`}
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

        {/* Row 1.5: Purpose chips */}
        {!isArchived && (
          <div className="flex items-center gap-1.5 pl-[30px] flex-wrap mt-1">
            {(habit.purpose_ids ?? []).map((pid) => {
              const p = purposes.find((x) => x.id === pid);
              if (!p) return null;
              return (
                <span
                  key={pid}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-700/40 text-indigo-400 bg-indigo-500/10"
                >
                  <Compass className="w-2.5 h-2.5" />
                  {p.title}
                </span>
              );
            })}
            {(habit.domain_ids ?? []).map((did) => {
              const d = domainMap[did];
              if (!d) return null;
              return (
                <span
                  key={did}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-teal-700/40 text-teal-400 bg-teal-500/10"
                >
                  <Globe className="w-2.5 h-2.5" />
                  {d.title}
                </span>
              );
            })}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPurposePickerTarget(habit);
              }}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-stone-800 text-stone-500 hover:text-indigo-400 hover:border-indigo-700/50 transition-colors cursor-pointer"
            >
              <Compass className="w-2.5 h-2.5" />
              Purpose
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDomainPickerTarget(habit);
              }}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-stone-800 text-stone-500 hover:text-teal-400 hover:border-teal-700/50 transition-colors cursor-pointer"
            >
              <Globe className="w-2.5 h-2.5" />
              Domain
            </button>
          </div>
        )}

        {/* Row 2: 7-day mini strip (active habits only) */}
        {!isArchived && (
          <div className="pl-[30px]">
            <MiniStrip
              habitId={habit.id}
              activeDate={activeDate}
              logs={allLogs}
              colorDot={cs.dot}
              colorFilled={cs.filled}
              onToggle={(date) => handleToggleForDate(habit, date)}
            />
          </div>
        )}
      </div>
    );
  };

  // ── Sheet content ─────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Header */}
      {!isInline && (
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
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {sortedActive.length > 0 && (
          <div className="pt-3 pb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-1">
              Active ({sortedActive.length})
            </span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedActive.map((h) => h.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedActive.map((h) => (
              <SortableRow key={h.id} id={h.id}>
                {renderHabitRow(h, false)}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>

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

        {habits.length === 0 && (
          <div className="py-12 text-center text-stone-600">
            <Repeat2 className="w-8 h-8 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No habits yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create a habit below and tick it off daily to build consistency.
            </p>
          </div>
        )}
      </div>

      {/* Create input */}
      <div className="flex-none p-3 border-t border-stone-850 bg-[#121212] relative z-10 flex flex-col gap-2">
        {/* Color picker */}
        <div className="flex items-center gap-2 px-1 py-0.5">
          <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest">
            Color Theme:
          </span>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setNewColor(c.key)}
                className={`w-4 h-4 rounded-full ${c.dot} transition-all cursor-pointer ${
                  newColor === c.key
                    ? `ring-2 ring-offset-2 ring-offset-[#121212] ${c.ring} scale-110`
                    : 'opacity-40 hover:opacity-75'
                }`}
                title={c.key}
              />
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="flex items-stretch gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="Capture new daily habit..."
            className="flex-1 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 focus:bg-stone-950 transition-all shadow-inner animate-none"
          />
          <button
            onClick={handleCreate}
            className="px-5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="md:hidden xl:inline">Habit</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className="h-full w-full flex flex-col relative bg-[#121212] border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        {content}
        {consistencyHabit && (
          <HabitConsistencyModal
            habit={consistencyHabit}
            onClose={() => setConsistencyHabit(null)}
          />
        )}
        <PurposePickerSheet
          open={purposePickerTarget !== null}
          onClose={() => setPurposePickerTarget(null)}
          currentPurposeIds={purposePickerTarget?.purpose_ids ?? []}
          onToggle={(pid) => purposePickerTarget && handlePurposeToggle(purposePickerTarget, pid)}
          isMobile={isMobile}
        />
        <DomainPickerSheet
          open={domainPickerTarget !== null}
          onClose={() => setDomainPickerTarget(null)}
          currentDomainIds={domainPickerTarget?.domain_ids ?? []}
          onToggle={(did) => domainPickerTarget && handleDomainToggle(domainPickerTarget, did)}
          isMobile={isMobile}
        />
      </div>
    );
  }

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

      <PurposePickerSheet
        open={purposePickerTarget !== null}
        onClose={() => setPurposePickerTarget(null)}
        currentPurposeIds={purposePickerTarget?.purpose_ids ?? []}
        onToggle={(pid) => purposePickerTarget && handlePurposeToggle(purposePickerTarget, pid)}
        isMobile={isMobile}
      />

      <DomainPickerSheet
        open={domainPickerTarget !== null}
        onClose={() => setDomainPickerTarget(null)}
        currentDomainIds={domainPickerTarget?.domain_ids ?? []}
        onToggle={(did) => domainPickerTarget && handleDomainToggle(domainPickerTarget, did)}
        isMobile={isMobile}
      />
    </>
  );
}
