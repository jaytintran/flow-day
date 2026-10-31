/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Repeat2,
  Plus,
  LayoutGrid,
  Columns3,
  BarChart3,
  Search,
  Compass,
  Globe,
  Archive,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Table2,
  LayoutList,
} from 'lucide-react';
import { db } from '../../../db';
import { Habit, HabitLog, Purpose, Domain, RoutineSlot } from '../../../types';
import HabitMatrixGrid from './HabitMatrixGrid';
import HabitRoutineCardsView from './HabitRoutineCardsView';
import HabitAnalyticsView from './HabitAnalyticsView';
import HabitFormModal from './HabitFormModal';
import HabitConsistencyModal from '../../HabitConsistencyModal';
import HabitMobileCardStack from './HabitMobileCardStack';

type HabitSubView = 'matrix' | 'cards' | 'analytics';

interface HabitsViewProps {
  activeDate: Date;
  highlightPurposeIds?: string[] | null;
  highlightDomainId?: string | null;
}

export default function HabitsView({
  activeDate,
  highlightPurposeIds,
  highlightDomainId,
}: HabitsViewProps) {
  const [subView, setSubView] = useState<HabitSubView>(() => {
    try {
      const stored = localStorage.getItem('flowday_habit_subview');
      if (stored === 'matrix' || stored === 'cards' || stored === 'analytics') return stored;
    } catch {}
    return 'matrix';
  });

  // Desktop matrix style: 'matrix' table or 'cards' flat stack (persisted)
  const [matrixStyle, setMatrixStyle] = useState<'matrix' | 'cards'>(() => {
    try {
      const s = localStorage.getItem('flowday_habit_matrix_style');
      if (s === 'matrix' || s === 'cards') return s;
    } catch {}
    return 'matrix';
  });

  const setMatrixStyleAndSave = (s: 'matrix' | 'cards') => {
    setMatrixStyle(s);
    try { localStorage.setItem('flowday_habit_matrix_style', s); } catch {}
  };

  // Responsive: track isMobile
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mobile search expand
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [daysRange, setDaysRange] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 7;
    return 14;
  });
  const [windowOffset, setWindowOffset] = useState<number>(0); // 0 = current, -1 = previous period, +1 = next period
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string | null>(
    highlightDomainId || null,
  );
  const [selectedPurposeFilter, setSelectedPurposeFilter] = useState<string | null>(null);

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [consistencyHabit, setConsistencyHabit] = useState<Habit | null>(null);

  const setView = (mode: HabitSubView) => {
    setSubView(mode);
    try {
      localStorage.setItem('flowday_habit_subview', mode);
    } catch {}
  };

  // Calculate anchor date for matrix based on activeDate + windowOffset * daysRange
  const matrixAnchorDate = useMemo(() => {
    const d = new Date(activeDate);
    if (windowOffset !== 0) {
      d.setDate(d.getDate() + windowOffset * daysRange);
    }
    return d;
  }, [activeDate, windowOffset, daysRange]);

  // Format label for current matrix period
  const periodLabel = useMemo(() => {
    const end = new Date(matrixAnchorDate);
    const start = new Date(matrixAnchorDate);
    start.setDate(start.getDate() - (daysRange - 1));

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [matrixAnchorDate, daysRange]);

  // Queries: Window habit-logs to 180-day range around matrixAnchorDate for matrix/routines/analytics
  const allHabits = useLiveQuery(() => db.habits.toArray()) || [];
  const allLogs =
    (useLiveQuery(async () => {
      const windowStart = new Date(matrixAnchorDate);
      windowStart.setDate(windowStart.getDate() - 120);
      windowStart.setHours(0, 0, 0, 0);

      const windowEnd = new Date(matrixAnchorDate);
      windowEnd.setDate(windowEnd.getDate() + 60);
      windowEnd.setHours(23, 59, 59, 999);

      return (await db.entries
        .where('type')
        .equals('habit-log')
        .filter((e) => {
          const t = new Date(e.timestamp || e.created_at).getTime();
          return t >= windowStart.getTime() && t <= windowEnd.getTime();
        })
        .toArray()) as HabitLog[];
    }, [matrixAnchorDate]) || []) as HabitLog[];
  const purposes = (useLiveQuery(() => db.purposes.toArray()) || []) as Purpose[];
  const domains = (useLiveQuery(() => db.domains.toArray()) || []) as Domain[];

  // Filter Active vs Archived
  const statusFiltered = useMemo(() => {
    return allHabits.filter((h) =>
      showArchived ? h.status === 'archived' : h.status === 'active',
    );
  }, [allHabits, showArchived]);

  // Apply Search, Purpose, and Domain Filters
  const filteredHabits = useMemo(() => {
    return statusFiltered
      .filter((h) => {
        if (searchQuery.trim() && !h.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (selectedPurposeFilter && !(h.purpose_ids || []).includes(selectedPurposeFilter)) {
          return false;
        }
        if (selectedDomainFilter && !(h.domain_ids || []).includes(selectedDomainFilter)) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (a.sort_order ?? Date.parse(a.created_at.toString())) -
          (b.sort_order ?? Date.parse(b.created_at.toString())),
      );
  }, [statusFiltered, searchQuery, selectedPurposeFilter, selectedDomainFilter]);

  const handleAddNewWithSlot = (slot: RoutineSlot) => {
    setEditingHabit({
      id: '',
      title: '',
      created_at: new Date(),
      status: 'active',
      routine_slot: slot,
    } as Habit);
    setIsFormOpen(true);
  };

  return (
    <div className="w-full flex-1 flex flex-col h-full min-h-0 bg-[#0a0a0a] px-3 md:px-6 pt-2 pb-3 select-none">

      {/* ── MOBILE HEADER ── single sparse action bar + optional controls row */}
      {isMobile && (
        <div className="flex flex-col gap-2 pb-2.5 border-b border-stone-850 flex-none">
          <div className="flex items-center gap-2">
            {/* View switcher: icon-only pills */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#121212] border border-stone-800 gap-0.5">
              <button
                type="button"
                onClick={() => setView('matrix')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  subView === 'matrix'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
                title="Card Stack"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('cards')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  subView === 'cards'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
                title="Routines"
              >
                <Columns3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('analytics')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  subView === 'analytics'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
                title="Analytics"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search icon / expanding input */}
            {mobileSearchOpen ? (
              <div className="relative flex-1 max-w-[150px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => { if (!searchQuery) setMobileSearchOpen(false); }}
                  placeholder="Search..."
                  className="bg-[#121212] text-xs font-mono text-stone-200 border border-stone-700 rounded-xl pl-8 pr-3 py-1.5 placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 w-full transition-all"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className="p-2 rounded-xl bg-[#121212] border border-stone-800 text-stone-400 hover:text-stone-200 transition-all cursor-pointer"
                title="Search habits"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Archive toggle */}
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showArchived
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300'
              }`}
              title={showArchived ? 'Show Active' : 'Show Archived'}
            >
              <Archive className="w-4 h-4" />
            </button>

            {/* + New Habit */}
            <button
              type="button"
              onClick={() => { setEditingHabit(null); setIsFormOpen(true); }}
              className="flex items-center justify-center p-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 font-mono font-bold transition-all active:scale-95 shadow-lg shadow-emerald-950/40 cursor-pointer"
              title="New Habit"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Mobile Secondary Row: Range Pills & Date Pager (when in matrix/card stack view) */}
          {subView === 'matrix' && (
            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              {/* Range Pills (7D / 14D / 30D) */}
              <div className="flex items-center p-0.5 rounded-lg bg-[#121212] border border-stone-800 text-[10px] font-mono">
                {[
                  { label: '7D', val: 7 },
                  { label: '14D', val: 14 },
                  { label: '30D', val: 30 },
                ].map((r) => (
                  <button
                    key={r.val}
                    type="button"
                    onClick={() => { setDaysRange(r.val); setWindowOffset(0); }}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      daysRange === r.val
                        ? 'bg-stone-800 text-stone-100 font-bold'
                        : 'text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Date Cycling Pager */}
              <div className="flex items-center gap-1 bg-[#121212] border border-stone-800 rounded-lg p-0.5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setWindowOffset((prev) => prev - 1)}
                  className="p-1 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Previous period"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="px-1 text-[10px] text-stone-300 font-semibold select-none whitespace-nowrap">
                  {periodLabel}
                </span>

                <button
                  type="button"
                  onClick={() => setWindowOffset((prev) => prev + 1)}
                  className="p-1 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Next period"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {windowOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setWindowOffset(0)}
                    className="ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all cursor-pointer"
                    title="Jump to today"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DESKTOP HEADER ── full multi-row controls (unchanged) */}
      {!isMobile && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-850 flex-none">
          {/* Left: View Switcher + Matrix Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-1 rounded-xl bg-[#121212] border border-stone-800">
              <button
                type="button"
                onClick={() => setView('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  subView === 'matrix'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Matrix Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setView('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  subView === 'cards'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Routines</span>
              </button>

              <button
                type="button"
                onClick={() => setView('analytics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  subView === 'analytics'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>
            </div>

            {/* Matrix Controls: Range + Date Pager + Style Toggle */}
            {subView === 'matrix' && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Range Pills */}
                <div className="flex items-center p-1 rounded-xl bg-[#121212] border border-stone-800 text-[11px] font-mono">
                  {[
                    { label: '7D', val: 7 },
                    { label: '14D', val: 14 },
                    { label: '30D', val: 30 },
                  ].map((r) => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => { setDaysRange(r.val); setWindowOffset(0); }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        daysRange === r.val
                          ? 'bg-stone-800 text-stone-100 font-bold'
                          : 'text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* Date Cycling Pager */}
                <div className="flex items-center gap-1 bg-[#121212] border border-stone-800 rounded-xl p-1 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setWindowOffset((prev) => prev - 1)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                    title="Previous period"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-2 text-[11px] text-stone-300 font-semibold select-none whitespace-nowrap">
                    {periodLabel}
                  </span>

                  <button
                    type="button"
                    onClick={() => setWindowOffset((prev) => prev + 1)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                    title="Next period"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {windowOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setWindowOffset(0)}
                      className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all cursor-pointer"
                      title="Jump back to current period"
                    >
                      Today
                    </button>
                  )}
                </div>

                {/* Matrix / Cards style toggle (desktop only) */}
                <div className="flex items-center p-0.5 rounded-xl bg-[#121212] border border-stone-800 gap-0.5" title="View style">
                  <button
                    type="button"
                    onClick={() => setMatrixStyleAndSave('matrix')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      matrixStyle === 'matrix'
                        ? 'bg-stone-700 text-stone-100'
                        : 'text-stone-500 hover:text-stone-300'
                    }`}
                    title="Matrix table"
                  >
                    <Table2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixStyleAndSave('cards')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      matrixStyle === 'cards'
                        ? 'bg-stone-700 text-stone-100'
                        : 'text-stone-500 hover:text-stone-300'
                    }`}
                    title="Card stack"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Search + Archive + New Habit */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search habits..."
                className="bg-[#121212] text-xs font-mono text-stone-200 border border-stone-800 rounded-xl pl-8 pr-3 py-1.5 placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 w-36 sm:w-44 transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={`p-2 rounded-xl border text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                showArchived
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-[#121212] border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
              title={showArchived ? 'Show Active Habits' : 'Show Archived Habits'}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => { setEditingHabit(null); setIsFormOpen(true); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 font-mono font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Habit</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 pt-3 flex flex-col w-full">
        {subView === 'matrix' ? (
          // Mobile always shows card stack; desktop respects matrixStyle toggle
          isMobile || matrixStyle === 'cards' ? (
            <HabitMobileCardStack
              habits={filteredHabits}
              allLogs={allLogs}
              activeDate={matrixAnchorDate}
              daysRange={daysRange}
              onEditHabit={(h) => { setEditingHabit(h); setIsFormOpen(true); }}
              onOpenCalendar={(h) => setConsistencyHabit(h)}
            />
          ) : (
            <HabitMatrixGrid
              habits={filteredHabits}
              allLogs={allLogs}
              activeDate={matrixAnchorDate}
              daysRange={daysRange}
              onEditHabit={(h) => { setEditingHabit(h); setIsFormOpen(true); }}
              onOpenCalendar={(h) => setConsistencyHabit(h)}
              onAddNewHabit={() => { setEditingHabit(null); setIsFormOpen(true); }}
              purposes={purposes}
              domains={domains}
            />
          )
        ) : subView === 'cards' ? (
          <HabitRoutineCardsView
            habits={filteredHabits}
            allLogs={allLogs}
            activeDate={activeDate}
            purposes={purposes}
            domains={domains}
            onEditHabit={(h) => { setEditingHabit(h); setIsFormOpen(true); }}
            onOpenCalendar={(h) => setConsistencyHabit(h)}
            onAddNewHabitWithSlot={handleAddNewWithSlot}
          />
        ) : (
          <HabitAnalyticsView habits={filteredHabits} allLogs={allLogs} activeDate={activeDate} />
        )}
      </div>

      {/* Habit Create / Edit Modal */}
      <HabitFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingHabit(null);
        }}
        habitToEdit={editingHabit}
      />

      {/* Habit Consistency Calendar Modal */}
      {consistencyHabit && (
        <HabitConsistencyModal habit={consistencyHabit} onClose={() => setConsistencyHabit(null)} />
      )}
    </div>
  );
}
