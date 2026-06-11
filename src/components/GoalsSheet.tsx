/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
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
import { Goal, Category } from '../types';
import { formatDuration } from '../utils';
import {
  Flag,
  Plus,
  Check,
  Archive,
  Trash2,
  X,
  Clock,
  ChevronDown,
  Tag,
  MoreHorizontal,
} from 'lucide-react';
import CategoryStrip from './CategoryStrip';
import CategoryManagementSheet from './CategoryManagementSheet';
import SortableRow from './SortableRow';

const colorDotMap: Record<string, string> = {
  emerald: 'bg-emerald-400',
  sky: 'bg-sky-400',
  violet: 'bg-violet-400',
  rose: 'bg-rose-400',
  amber: 'bg-amber-400',
  indigo: 'bg-indigo-400',
  teal: 'bg-teal-400',
  orange: 'bg-orange-400',
};

interface GoalsSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function GoalsSheet({ open, onClose }: GoalsSheetProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const goals = useLiveQuery(() => db.entries.where('type').equals('goal').toArray()) || [];
  const typedGoals = goals as Goal[];

  const activeGoals = typedGoals.filter((o) => o.status === 'active');
  const achievedGoals = typedGoals.filter((o) => o.status === 'achieved');
  const archivedGoals = typedGoals.filter((o) => o.status === 'archived');

  const [newTitle, setNewTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [chipOpenId, setChipOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  const categories =
    useLiveQuery(() => db.categories.where('scope').equals('goal').toArray()) || [];
  const categoryMap = React.useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) {
      map[c.id] = c;
    }
    return map;
  }, [categories]);

  // Filter helpers — checks if an entry's category_ids includes the selected id
  const matchesFilter = (ids: string[] | undefined) =>
    !selectedCategoryId || (Array.isArray(ids) && ids.includes(selectedCategoryId));

  const filteredActiveGoals = activeGoals.filter((g) => matchesFilter(g.category_ids));
  const filteredAchievedGoals = achievedGoals.filter((g) => matchesFilter(g.category_ids));
  const filteredArchivedGoals = archivedGoals.filter((g) => matchesFilter(g.category_ids));

  // ── DnD reordering (active goals only) ────────────────────────────────────

  const [optimisticGoals, setOptimisticGoals] = useState<Goal[] | null>(null);
  const displayActive = optimisticGoals ?? filteredActiveGoals;
  const sortedActiveGoals = [...displayActive].sort(
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

      const ids = sortedActiveGoals.map((g) => g.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(ids, oldIndex, newIndex);

      setOptimisticGoals((prev) => {
        const base = prev ?? filteredActiveGoals;
        const mapped = reordered.map((id, idx) => {
          const g = base.find((x) => x.id === id)!;
          return { ...g, sort_order: idx };
        });
        return mapped;
      });

      for (let i = 0; i < reordered.length; i++) {
        await db.entries.update(reordered[i], { sort_order: i } as any);
      }

      setTimeout(() => setOptimisticGoals(null), 2000);
    },
    [filteredActiveGoals, sortedActiveGoals],
  );

  // Close chip popover on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setChipOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggleStatus = async (obj: Goal) => {
    const nextStatus = obj.status === 'active' ? 'achieved' : 'active';
    await db.entries.update(obj.id, {
      status: nextStatus,
      achieved_at: nextStatus === 'achieved' ? new Date() : undefined,
    } as any);
  };

  const handleArchive = async (obj: Goal) => {
    await db.entries.update(obj.id, { status: 'archived' } as any);
  };

  const handleDelete = async (obj: Goal) => {
    await db.entries.delete(obj.id);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const newObj: Goal = {
      id: crypto.randomUUID(),
      type: 'goal',
      title: newTitle.trim(),
      time_spent: 0,
      status: 'active',
      created_at: new Date(),
    };
    await db.entries.add(newObj);
    setNewTitle('');
    inputRef.current?.focus();
  };

  // Multi-toggle: add or remove a category id from the array
  const handleCategoryToggle = async (goal: Goal, catId: string) => {
    const current = goal.category_ids ?? [];
    const next = current.includes(catId)
      ? current.filter((id) => id !== catId)
      : [...current, catId];
    await db.entries.update(goal.id, { category_ids: next } as any);
  };

  // Count linked objectives and tasks for display
  const allObjs = useLiveQuery(() => db.entries.where('type').equals('objective').toArray()) || [];
  const allTasks = useLiveQuery(() => db.entries.where('type').equals('task').toArray()) || [];
  const { objectiveCounts, taskCounts } = React.useMemo(() => {
    const objCounts: Record<string, number> = {};
    const tCounts: Record<string, number> = {};
    for (const o of allObjs as any[]) {
      if (o.goal_id) {
        objCounts[o.goal_id] = (objCounts[o.goal_id] || 0) + 1;
      }
    }
    for (const t of allTasks as any[]) {
      if (t.objective_id) {
        const obj = (allObjs as any[]).find((o) => o.id === t.objective_id);
        if (obj?.goal_id) {
          tCounts[obj.goal_id] = (tCounts[obj.goal_id] || 0) + 1;
        }
      }
    }
    return { objectiveCounts: objCounts, taskCounts: tCounts };
  }, [allObjs, allTasks]);

  const assignedCategories = (obj: Goal) =>
    (obj.category_ids ?? []).map((id) => categoryMap[id]).filter(Boolean) as Category[];

  const renderGoalRow = (obj: Goal) => {
    const assigned = assignedCategories(obj);
    return (
      <div
        key={obj.id}
        className={`relative flex flex-col gap-1.5 px-4 py-3 border rounded-xl transition-colors group ${
          obj.status === 'achieved'
            ? 'bg-emerald-950/10 border-emerald-900/30 hover:border-emerald-800/50'
            : obj.status === 'archived'
              ? 'bg-stone-900/20 border-stone-800/40 hover:border-stone-700/60'
              : 'bg-[#0a0a0a] border-stone-800/80 hover:border-stone-700'
        }`}
      >
        {/* Top row: Status circle + Title + Actions (archive/delete) */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => handleToggleStatus(obj)}
            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              obj.status === 'achieved'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'border-stone-700 hover:border-stone-500'
            }`}
          >
            {obj.status === 'achieved' && <Check className="w-3 h-3 stroke-[3]" />}
          </button>

          <span
            className={`flex-1 text-sm font-serif min-w-0 truncate ${
              obj.status === 'achieved' ? 'line-through text-stone-500' : 'text-stone-200'
            }`}
          >
            {obj.title}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === obj.id ? null : obj.id);
            }}
            className="md:hidden p-1.5 rounded text-stone-600 hover:text-stone-400 transition-all cursor-pointer shrink-0"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {menuOpenId === obj.id && (
            <div className="absolute right-2 top-8 z-50 bg-[#1a1a1a] border border-stone-700 rounded-lg shadow-xl flex flex-col overflow-hidden min-w-[120px]">
              {obj.status !== 'archived' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(obj);
                    setMenuOpenId(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-stone-400 hover:bg-stone-800 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(obj);
                  setMenuOpenId(null);
                }}
                className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-stone-400 hover:bg-stone-800 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}

          {obj.status !== 'archived' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleArchive(obj);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-stone-600 hover:text-amber-400 hover:bg-amber-950/20 transition-all cursor-pointer shrink-0"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(obj);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer shrink-0"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom row: Chips + category tags */}
        <div className="flex items-center gap-1.5 pl-7 flex-wrap">
          {objectiveCounts[obj.id] > 0 && (
            <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">
              {objectiveCounts[obj.id]} objectives
            </span>
          )}

          {taskCounts[obj.id] > 0 && (
            <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">
              {taskCounts[obj.id]} tasks
            </span>
          )}

          <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(obj.time_spent)}
          </span>

          {/* Assigned category tags */}
          {assigned.map((cat) => (
            <span
              key={cat.id}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-stone-700/50 text-stone-300 bg-stone-800/40"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${colorDotMap[cat.color] ?? 'bg-stone-500'}`}
              />
              {cat.name}
            </span>
          ))}

          {/* Tag button + popover — always visible when categories exist */}
          {categories.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChipOpenId(chipOpenId === obj.id ? null : obj.id);
                }}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-stone-800 text-stone-500 hover:text-stone-400 hover:border-stone-600 transition-colors cursor-pointer"
              >
                <Tag className="w-2.5 h-2.5" />
                Tag
              </button>

              {chipOpenId === obj.id && (
                <div
                  ref={chipRef}
                  className="absolute bottom-full left-0 mb-1 z-50 bg-[#1a1a1a] border border-stone-700 rounded-lg p-1.5 shadow-xl flex flex-col gap-1 min-w-[140px]"
                >
                  {categories.map((cat) => {
                    const isActive = (obj.category_ids ?? []).includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryToggle(obj, cat.id);
                        }}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer text-left ${
                          isActive
                            ? 'bg-stone-700/50 text-stone-200'
                            : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${colorDotMap[cat.color] ?? 'bg-stone-500'}`}
                        />
                        <span className="flex-1">{cat.name}</span>
                        {isActive && <Check className="w-3 h-3 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800/60 px-4 py-3.5">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-sky-400 bg-sky-500/10 border-sky-500/20 flex items-center gap-1.5">
          <Flag className="w-3 h-3" />
          Goals / Projects
        </span>
        <button
          onClick={onClose}
          className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* Category strip – full width */}
      <CategoryStrip
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
        onManage={() => setIsCategoryManagerOpen(true)}
      />

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {filteredActiveGoals.length > 0 && (
          <div className="pt-3 pb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-1">
              Active ({filteredActiveGoals.length})
            </span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedActiveGoals.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedActiveGoals.map((g) => (
              <SortableRow key={g.id} id={g.id}>
                {renderGoalRow(g)}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>

        {filteredAchievedGoals.length > 0 && (
          <div className="pt-4 pb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-1">
              Achieved ({filteredAchievedGoals.length})
            </span>
          </div>
        )}
        {filteredAchievedGoals.map(renderGoalRow)}

        {filteredArchivedGoals.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 px-1 pt-4 pb-1 text-stone-500 hover:text-stone-400 transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showArchived ? '' : '-rotate-90'}`}
              />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest">
                Archived ({filteredArchivedGoals.length})
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
                  {filteredArchivedGoals.map(renderGoalRow)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {typedGoals.length === 0 && (
          <div className="py-12 text-center text-stone-600">
            <Flag className="w-8 h-8 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No goals or projects yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create your first goal above. A goal (or project) is a high-level ambition that groups
              multiple objectives together.
            </p>
          </div>
        )}
      </div>

      {/* Create input */}
      <div className="flex-none px-4 py-3 border-t border-stone-800/60">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="New goal or project..."
            className="flex-1 bg-[#0a0a0a] text-stone-100 border border-stone-800 rounded-lg px-3 py-2 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500/40 transition-colors"
          />
          <button
            onClick={handleCreate}
            className="p-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999]" />

          {isMobile ? (
            <div className="fixed inset-0 z-[999] flex items-end justify-center font-sans pointer-events-none">
              <div className="relative w-full h-[82vh] bg-[#121212] border-t border-stone-850 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pointer-events-auto animate-slide-up">
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
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999] p-4 font-sans pointer-events-none">
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

          <CategoryManagementSheet
            open={isCategoryManagerOpen}
            onClose={() => setIsCategoryManagerOpen(false)}
            scope="goal"
          />
        </>
      )}
    </AnimatePresence>
  );
}
