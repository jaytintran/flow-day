/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { db } from '../../../db';
import { Habit, HabitLog, Purpose, Domain, RoutineSlot } from '../../../types';
import HabitMatrixGrid from './HabitMatrixGrid';
import HabitRoutineCardsView from './HabitRoutineCardsView';
import HabitAnalyticsView from './HabitAnalyticsView';
import HabitFormModal from './HabitFormModal';
import HabitConsistencyModal from '../../HabitConsistencyModal';

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

  const [daysRange, setDaysRange] = useState<number>(14);
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

  // Queries
  const allHabits = useLiveQuery(() => db.habits.toArray()) || [];
  const allLogs = (useLiveQuery(() => db.entries.where('type').equals('habit-log').toArray()) ||
    []) as HabitLog[];
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
      {/* Top Header / View Controller Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-850 flex-none">
        {/* Left: View Switcher (Matrix / Cards / Analytics) */}
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

          {/* Matrix Date Range Selector (Only when in Matrix view) */}
          {subView === 'matrix' && (
            <div className="flex items-center p-1 rounded-xl bg-[#121212] border border-stone-800 text-[11px] font-mono">
              {[
                { label: '7D', val: 7 },
                { label: '14D', val: 14 },
                { label: '30D', val: 30 },
              ].map((r) => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => setDaysRange(r.val)}
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
          )}
        </div>

        {/* Right: Search, Filter, Archive Toggle, and "+ New Habit" */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
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

          {/* Archive Switch */}
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

          {/* "+ New Habit" Primary Button */}
          <button
            type="button"
            onClick={() => {
              setEditingHabit(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 font-mono font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 pt-3 flex flex-col w-full">
        {subView === 'matrix' ? (
          <HabitMatrixGrid
            habits={filteredHabits}
            allLogs={allLogs}
            activeDate={activeDate}
            daysRange={daysRange}
            onEditHabit={(h) => {
              setEditingHabit(h);
              setIsFormOpen(true);
            }}
            onOpenCalendar={(h) => setConsistencyHabit(h)}
            onAddNewHabit={() => {
              setEditingHabit(null);
              setIsFormOpen(true);
            }}
            purposes={purposes}
            domains={domains}
          />
        ) : subView === 'cards' ? (
          <HabitRoutineCardsView
            habits={filteredHabits}
            allLogs={allLogs}
            activeDate={activeDate}
            purposes={purposes}
            domains={domains}
            onEditHabit={(h) => {
              setEditingHabit(h);
              setIsFormOpen(true);
            }}
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
