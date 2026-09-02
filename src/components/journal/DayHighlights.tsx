/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { TimelineEntry, Task, Note, Event, Log, TimeBlock, TaskAchievement } from '../../types';
import {
  Star,
  X,
  GripVertical,
  Calendar,
  Clock,
  Trash,
  Edit3,
  Check,
  Search,
  FileText,
  CalendarDays,
  ListTodo,
  Sparkles,
  Trophy,
} from 'lucide-react';

interface DayHighlightsProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenDetail?: (entry: TimelineEntry) => void;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_POS_KEY = 'flowday_day_highlights_pos_v1';

function loadSavedPosition(): Position {
  try {
    const raw = localStorage.getItem(STORAGE_POS_KEY);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return parsed;
    }
    return { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

function savePosition(pos: Position) {
  try {
    localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
  } catch {}
}

export default function DayHighlights({
  isOpen,
  onToggle,
  onOpenDetail,
}: DayHighlightsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<Position>(loadSavedPosition);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const handleStartEdit = (entry: TimelineEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEntryId(entry.id);
    setEditingTitle(entry.title || '');
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      await db.entries.update(id, { title: trimmed } as any);
    }
    setEditingEntryId(null);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch all starred entries (and legacy tasks with achievements) from Dexie
  const rawEntries = useLiveQuery(async () => {
    const all = await db.entries.toArray();
    return all.filter(
      (e) =>
        e.starred === true ||
        (e.type === 'task' && (e as Task).achievements && (e as Task).achievements!.length > 0),
    );
  }, []);

  const starredEntries = useMemo(() => {
    return rawEntries || [];
  }, [rawEntries]);

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const entry of starredEntries) {
      const d =
        (entry as any).completed_at ||
        (entry as any).timestamp ||
        (entry as any).start_at ||
        (entry as any).scheduled_at ||
        entry.created_at;
      if (d) years.add(new Date(d).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [starredEntries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return starredEntries.filter((entry) => {
      const d = new Date(
        (entry as any).completed_at ||
          (entry as any).timestamp ||
          (entry as any).start_at ||
          (entry as any).scheduled_at ||
          entry.created_at,
      );

      if (filterYear !== 'all' && d.getFullYear().toString() !== filterYear) {
        return false;
      }
      if (filterMonth !== 'all' && d.getMonth().toString() !== filterMonth) {
        return false;
      }
      if (filterType !== 'all' && entry.type !== filterType) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (entry.title || '').toLowerCase().includes(q);
        const contentMatch = (entry as any).content?.toLowerCase()?.includes(q);
        const achievementsMatch =
          entry.type === 'task' &&
          ((entry as Task).achievements || []).some((a) => a.text.toLowerCase().includes(q));
        if (!titleMatch && !contentMatch && !achievementsMatch) return false;
      }

      return true;
    });
  }, [starredEntries, filterYear, filterMonth, filterType, searchQuery]);

  // Group by month
  const groupedHighlights = useMemo(() => {
    const groups: { label: string; year: number; month: number; entries: TimelineEntry[] }[] = [];
    const map = new Map<string, TimelineEntry[]>();

    // Sort newest first
    const sorted = [...filteredEntries].sort((a, b) => {
      const dateA = new Date(
        (a as any).completed_at ||
          (a as any).timestamp ||
          (a as any).start_at ||
          (a as any).scheduled_at ||
          a.created_at,
      ).getTime();
      const dateB = new Date(
        (b as any).completed_at ||
          (b as any).timestamp ||
          (b as any).start_at ||
          (b as any).scheduled_at ||
          b.created_at,
      ).getTime();
      return dateB - dateA;
    });

    for (const entry of sorted) {
      const d = new Date(
        (entry as any).completed_at ||
          (entry as any).timestamp ||
          (entry as any).start_at ||
          (entry as any).scheduled_at ||
          entry.created_at,
      );
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(entry);
    }

    for (const [key, entries] of map.entries()) {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const date = new Date(year, month, 1);
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      groups.push({ label, year, month, entries });
    }

    return groups;
  }, [filteredEntries]);

  const handleUnstar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.entries.update(id, { starred: false } as any);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this highlight entry?')) {
      await db.entries.delete(id);
    }
  };

  const getTypeIconBadge = (type: string) => {
    switch (type) {
      case 'task':
        return (
          <span
            title="Task"
            className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      case 'event':
        return (
          <span
            title="Event"
            className="p-1 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.25)]"
          >
            <Calendar className="w-3.5 h-3.5 stroke-[2]" />
          </span>
        );
      case 'note':
        return (
          <span
            title="Note"
            className="p-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.25)]"
          >
            <FileText className="w-3.5 h-3.5 stroke-[2]" />
          </span>
        );
      case 'time-block':
        return (
          <span
            title="Time Block"
            className="p-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
          >
            <Clock className="w-3.5 h-3.5 stroke-[2]" />
          </span>
        );
      case 'log':
      default:
        return (
          <span
            title="Log"
            className="p-1 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.25)]"
          >
            <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
          </span>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen &&
        (isMobile ? (
          /* MOBILE DRAWER */
          <div className="fixed inset-0 z-50 flex items-end justify-center font-sans">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onToggle}
              className="absolute inset-0 bg-black/70"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  onToggle();
                }
              }}
              transition={{ type: 'spring', damping: 30, stiffness: 320, mass: 0.7 }}
              className="relative w-full min-h-[60vh] max-h-[88vh] bg-[#141414] border-t border-stone-800 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pb-6"
            >
              {/* Header */}
              <div className="flex-none flex flex-col items-center pt-3 pb-2 border-b border-stone-850">
                <button
                  type="button"
                  onClick={onToggle}
                  className="p-2 -my-2 flex items-center justify-center cursor-pointer group"
                >
                  <div className="w-12 h-1.5 bg-stone-700 group-hover:bg-stone-500 rounded-full transition-colors" />
                </button>
                <div className="w-full px-4 flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                    <h3 className="text-sm font-serif font-bold text-stone-100">Highlights of Days</h3>
                    <span className="text-[10px] font-mono text-stone-500">
                      {starredEntries.length} starred
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onToggle}
                    className="p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Filter Pill Strip */}
                <div className="w-full px-4 mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono shrink-0 ${
                      filterType === 'all'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                        : 'bg-stone-900 border border-stone-850 text-stone-400'
                    }`}
                  >
                    All
                  </button>
                  {['task', 'note', 'event', 'time-block'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono shrink-0 capitalize ${
                        filterType === t
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                          : 'bg-stone-900 border border-stone-850 text-stone-400'
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {groupedHighlights.length === 0 ? (
                  <div className="py-12 text-center text-stone-500 text-xs font-mono flex flex-col items-center gap-2">
                    <Star className="w-6 h-6 stroke-1 text-stone-700" />
                    <span>No highlights starred yet.</span>
                    <span className="text-[10px] text-stone-600">
                      Star notes, tasks, events, and work sessions to showcase them here!
                    </span>
                  </div>
                ) : (
                  groupedHighlights.map((group) => (
                    <div key={group.label} className="space-y-2">
                      <div className="flex items-center justify-between border-b border-stone-850 pb-1">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-amber-500 font-bold">
                          {group.label}
                        </span>
                        <span className="text-[10px] font-mono text-stone-600">
                          {group.entries.length} items
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {group.entries.map((entry) => {
                          const dateObj = new Date(
                            (entry as any).completed_at ||
                              (entry as any).timestamp ||
                              (entry as any).start_at ||
                              (entry as any).scheduled_at ||
                              entry.created_at,
                          );
                          const dateFormatted = dateObj.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          });

                          const isTask = entry.type === 'task';
                          const isAccomplishment = isTask && (entry as Task).is_accomplishment;

                          const isEditingThis = editingEntryId === entry.id;

                          return (
                            <div
                              key={entry.id}
                              onClick={() => {
                                if (!isEditingThis) {
                                  handleStartEdit(entry);
                                }
                              }}
                              className="bg-[#1b1b1b] border border-stone-850 rounded-xl p-3 flex flex-col gap-2 cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {getTypeIconBadge(entry.type)}
                                  {isEditingThis ? (
                                    <input
                                      type="text"
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit(entry.id);
                                        if (e.key === 'Escape') handleCancelEdit();
                                      }}
                                      onBlur={() => handleSaveEdit(entry.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      className="bg-[#101010] border border-amber-500/40 rounded px-2 py-0.5 text-xs text-stone-100 font-sans w-full focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                                    />
                                  ) : (
                                    <span className="text-xs font-semibold text-stone-200 truncate select-none">
                                      {entry.title || 'Untitled'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] font-mono text-stone-500 bg-stone-900 px-1 py-0.5 rounded border border-stone-850">
                                    {dateFormatted}
                                  </span>
                                  {(isTask || entry.type === 'log') && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await db.entries.update(entry.id, {
                                          is_accomplishment: !isAccomplishment,
                                        } as any);
                                      }}
                                      title={
                                        isAccomplishment
                                          ? 'Marked as Accomplishment'
                                          : 'Mark as Accomplishment (Trophy)'
                                      }
                                      className={`p-1 rounded transition-colors ${
                                        isAccomplishment
                                          ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                                          : 'text-stone-500 hover:text-amber-400 bg-stone-900 border border-stone-850'
                                      }`}
                                    >
                                      <Trophy
                                        className={`w-3.5 h-3.5 ${
                                          isAccomplishment ? 'fill-current' : ''
                                        }`}
                                      />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => handleDelete(entry.id, e)}
                                    title="Delete entry"
                                    className="p-1 text-stone-500 hover:text-rose-400 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {(entry as any).content && (
                                <p className="text-[11px] text-stone-400 font-serif line-clamp-2 pl-5">
                                  {(entry as any).content}
                                </p>
                              )}
                              {(() => {
                                const wins =
                                  entry.micro_wins || (entry as any).achievements || [];
                                if (wins.length === 0) return null;
                                return (
                                  <div className="flex items-center gap-2 pl-6 pt-1 border-t border-stone-850/60 overflow-hidden">
                                    {wins.slice(0, 2).map((w: any) => (
                                      <span
                                        key={w.id}
                                        className="text-[10px] font-mono text-stone-400 flex items-center gap-1 truncate"
                                      >
                                        <Sparkles className="w-2.5 h-2.5 text-amber-500/70 shrink-0" />
                                        <span className="truncate">{w.text}</span>
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        ) : (
          /* DESKTOP FLOATING DRAGGABLE WINDOW */
          <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => {
              const newPos = {
                x: position.x + info.offset.x,
                y: position.y + info.offset.y,
              };
              setPosition(newPos);
              savePosition(newPos);
            }}
            initial={{ opacity: 0, scale: 0.95, x: position.x, y: position.y + 15 }}
            animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
            exit={{ opacity: 0, scale: 0.95, x: position.x, y: position.y + 15 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 bottom-16 right-12 w-[560px] max-w-[92vw] max-h-[640px] bg-[#141414]/95 border border-stone-800 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden font-sans"
          >
            {/* Header (Drag Handle) */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#181818] border-b border-stone-850 cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-stone-600" />
                <Star className="w-4 h-4 text-amber-400 fill-amber-400/40" />
                <h3 className="text-sm font-serif font-bold text-stone-200">Highlights of Days</h3>
                <span className="text-[10px] font-mono text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                  {starredEntries.length} total
                </span>
              </div>
              <button
                type="button"
                onClick={onToggle}
                title="Close"
                className="p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="px-4 py-2 bg-[#121212] border-b border-stone-850/70 flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search highlights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-850 rounded-lg pl-8 pr-2.5 py-1 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/40 font-mono"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-stone-950 border border-stone-850 rounded-lg px-2 py-1 text-[11px] font-mono text-stone-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="task">Tasks</option>
                  <option value="note">Notes</option>
                  <option value="event">Events</option>
                  <option value="time-block">Time Blocks</option>
                  <option value="log">Logs</option>
                </select>

                {availableYears.length > 1 && (
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="bg-stone-950 border border-stone-850 rounded-lg px-2 py-1 text-[11px] font-mono text-stone-300 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((y) => (
                      <option key={y} value={y.toString()}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Feed Content — Single Row per Entry Layout */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 max-h-[480px]">
              {groupedHighlights.length === 0 ? (
                <div className="py-16 text-center text-stone-600 text-xs font-mono flex flex-col items-center gap-2">
                  <Star className="w-8 h-8 stroke-1 text-stone-700" />
                  <span>No highlights found.</span>
                  <span className="text-[10px] text-stone-600">
                    Star entries from Day View, Timeline, or Lists to collect your memories here.
                  </span>
                </div>
              ) : (
                groupedHighlights.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <div className="flex items-center justify-between border-b border-stone-850 pb-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-bold">
                        {group.label}
                      </span>
                      <span className="text-[10px] font-mono text-stone-600 font-semibold">
                        {group.entries.length} {group.entries.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {group.entries.map((entry) => {
                        const dateObj = new Date(
                          (entry as any).completed_at ||
                            (entry as any).timestamp ||
                            (entry as any).start_at ||
                            (entry as any).scheduled_at ||
                            entry.created_at,
                        );
                        const dateFormatted = dateObj.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        });

                        const isTask = entry.type === 'task';
                        const isAccomplishment = isTask && (entry as Task).is_accomplishment;

                        const isEditingThis = editingEntryId === entry.id;

                        return (
                          <div
                            key={entry.id}
                            onClick={() => {
                              if (!isEditingThis) {
                                handleStartEdit(entry);
                              }
                            }}
                            className="group/item bg-[#1a1a1a]/80 hover:bg-[#1f1f1f] border border-stone-850 hover:border-amber-500/30 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all cursor-pointer shadow-sm relative overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {getTypeIconBadge(entry.type)}
                                {isEditingThis ? (
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit(entry.id);
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    onBlur={() => handleSaveEdit(entry.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    className="bg-[#101010] border border-amber-500/40 rounded px-2 py-0.5 text-xs text-stone-100 font-sans w-full focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                                  />
                                ) : (
                                  <span className="text-xs font-semibold text-stone-200 group-hover/item:text-amber-300 transition-colors truncate select-none">
                                    {entry.title || 'Untitled'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] font-mono text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-850">
                                  {dateFormatted}
                                </span>
                                {(isTask || entry.type === 'log') && (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await db.entries.update(entry.id, {
                                        is_accomplishment: !isAccomplishment,
                                      } as any);
                                    }}
                                    title={
                                      isAccomplishment
                                        ? 'Marked as Accomplishment'
                                        : 'Mark as Accomplishment (Trophy)'
                                    }
                                    className={`p-1 rounded transition-colors cursor-pointer ${
                                      isAccomplishment
                                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                                        : 'text-stone-500 hover:text-amber-400 bg-stone-900 border border-stone-850'
                                    }`}
                                  >
                                    <Trophy
                                      className={`w-3.5 h-3.5 ${
                                        isAccomplishment ? 'fill-current' : ''
                                      }`}
                                    />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(entry.id, e)}
                                  title="Delete entry"
                                  className="opacity-0 group-hover/item:opacity-100 text-stone-500 hover:text-rose-400 p-1 rounded-lg transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {(entry as any).content && (
                              <p className="text-[11px] text-stone-400 font-serif line-clamp-1 leading-relaxed pl-5">
                                {(entry as any).content}
                              </p>
                            )}

                            {(() => {
                              const wins =
                                entry.micro_wins || (entry as any).achievements || [];
                              if (wins.length === 0) return null;
                              return (
                                <div className="flex items-center gap-2 pl-6 pt-1 border-t border-stone-850/60 overflow-hidden">
                                  {wins.slice(0, 3).map((w: any) => (
                                    <span
                                      key={w.id}
                                      className="text-[10px] font-mono text-stone-400 flex items-center gap-1 truncate"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-amber-500/70 shrink-0" />
                                      <span className="truncate">{w.text}</span>
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Window Footer */}
            <div className="px-4 py-2 bg-[#121212] border-t border-stone-850/60 text-[10px] font-mono text-stone-500 flex justify-between items-center">
              <span>Click entry to view details</span>
              <span>Drag header to move</span>
            </div>
          </motion.div>
        ))}
    </AnimatePresence>
  );
}
