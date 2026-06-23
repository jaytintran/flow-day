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
import { Objective, Goal, Category, Purpose, Domain } from '../types';
import { formatDuration } from '../utils';
import {
  Target,
  Plus,
  Check,
  Archive,
  Trash2,
  X,
  Clock,
  ChevronDown,
  Flag,
  Tag,
  MoreHorizontal,
  Globe,
} from 'lucide-react';
import GoalPickerSheet from './GoalPickerSheet';
import CategoryStrip from './CategoryStrip';
import CategoryManagementSheet from './CategoryManagementSheet';
import SortableRow from './SortableRow';

import { Compass } from 'lucide-react';
import PurposePickerSheet from './PurposePickerSheet';
import DomainPickerSheet from './DomainPickerSheet';

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

interface ObjectivesSheetProps {
  open?: boolean;
  onClose?: () => void;
  isInline?: boolean;
  highlightPurposeIds?: string[] | null;
  highlightDomainId?: string | null;
}

export default function ObjectivesSheet({
  open = false,
  onClose = () => {},
  isInline = false,
  highlightPurposeIds,
  highlightDomainId,
}: ObjectivesSheetProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const [purposePickerTarget, setPurposePickerTarget] = useState<Objective | null>(null);
  const [domainPickerTarget, setDomainPickerTarget] = useState<Objective | null>(null);
  const purposes = (useLiveQuery(() => db.purposes.toArray()) || []) as Purpose[];
  const domains = (useLiveQuery(() => db.domains.toArray()) || []) as Domain[];
  const domainMap = React.useMemo(() => {
    const map: Record<string, Domain> = {};
    for (const d of domains) {
      map[d.id] = d;
    }
    return map;
  }, [domains]);

  const startEdit = (obj: Objective) => {
    setEditingId(obj.id);
    setEditTitle(obj.title);
  };

  const commitEdit = async (obj: Objective) => {
    const t = editTitle.trim();
    if (t && t !== obj.title) {
      await db.entries.update(obj.id, { title: t } as any);
    }
    setEditingId(null);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const objectives =
    useLiveQuery(() => db.entries.where('type').equals('objective').toArray()) || [];
  const typedObjectives = objectives as Objective[];

  // Count linked tasks per objective
  const allTasks = useLiveQuery(() => db.entries.where('type').equals('task').toArray()) || [];
  const taskCountByObjective = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTasks as any[]) {
      if (t.objective_id) {
        counts[t.objective_id] = (counts[t.objective_id] || 0) + 1;
      }
    }
    return counts;
  }, [allTasks]);

  const todoObjectives = typedObjectives.filter((o) => o.status === 'todo');
  const doneObjectives = typedObjectives.filter((o) => o.status === 'done');
  const archivedObjectives = typedObjectives.filter((o) => o.status === 'archived');

  const [newTitle, setNewTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [goalPickerTarget, setGoalPickerTarget] = useState<Objective | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [chipOpenId, setChipOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  const goals = useLiveQuery(() => db.entries.where('type').equals('goal').toArray()) || [];
  const typedGoals = goals as Goal[];
  const goalMap = React.useMemo(() => {
    const map: Record<string, Goal> = {};
    for (const g of typedGoals) {
      map[g.id] = g;
    }
    return map;
  }, [typedGoals]);

  const categories =
    useLiveQuery(() => db.categories.where('scope').equals('objective').toArray()) || [];
  const categoryMap = React.useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) {
      map[c.id] = c;
    }
    return map;
  }, [categories]);

  // Filter helpers
  const matchesFilter = (ids: string[] | undefined) =>
    !selectedCategoryId || (Array.isArray(ids) && ids.includes(selectedCategoryId));

  const filteredTodoObjectives = todoObjectives.filter((o) => matchesFilter(o.category_ids));
  const filteredDoneObjectives = doneObjectives.filter((o) => matchesFilter(o.category_ids));
  const filteredArchivedObjectives = archivedObjectives.filter((o) =>
    matchesFilter(o.category_ids),
  );

  // ── DnD reordering (todo objectives only) ──────────────────────────────────

  const [optimisticObjectives, setOptimisticObjectives] = useState<Objective[] | null>(null);
  const displayTodo = optimisticObjectives ?? filteredTodoObjectives;
  const sortedTodoObjectives = [...displayTodo].sort(
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

      const ids = sortedTodoObjectives.map((o) => o.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(ids, oldIndex, newIndex);

      setOptimisticObjectives((prev) => {
        const base = prev ?? filteredTodoObjectives;
        const mapped = reordered.map((id, idx) => {
          const o = base.find((x) => x.id === id)!;
          return { ...o, sort_order: idx };
        });
        return mapped;
      });

      for (let i = 0; i < reordered.length; i++) {
        await db.entries.update(reordered[i], { sort_order: i } as any);
      }

      setTimeout(() => setOptimisticObjectives(null), 2000);
    },
    [filteredTodoObjectives, sortedTodoObjectives],
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

  const handleToggleStatus = async (obj: Objective) => {
    const nextStatus = obj.status === 'todo' ? 'done' : 'todo';
    await db.entries.update(obj.id, {
      status: nextStatus,
      completed_at: nextStatus === 'done' ? new Date() : undefined,
    } as any);
  };

  const handleArchive = async (obj: Objective) => {
    await db.entries.update(obj.id, { status: 'archived' } as any);
  };

  const handleDelete = async (obj: Objective) => {
    await db.entries.delete(obj.id);
  };

  const handleGoalSelect = async (goalId: string | undefined) => {
    if (!goalPickerTarget) return;
    await db.entries.update(goalPickerTarget.id, { goal_id: goalId } as any);
    setGoalPickerTarget(null);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const newObj: Objective = {
      id: crypto.randomUUID(),
      type: 'objective',
      title: newTitle.trim(),
      time_spent: 0,
      status: 'todo',
      created_at: new Date(),
    };
    await db.entries.add(newObj);
    setNewTitle('');
    inputRef.current?.focus();
  };

  // Multi-toggle: add or remove a category id from the array
  const handleCategoryToggle = async (obj: Objective, catId: string) => {
    const current = obj.category_ids ?? [];
    const next = current.includes(catId)
      ? current.filter((id) => id !== catId)
      : [...current, catId];
    await db.entries.update(obj.id, { category_ids: next } as any);
  };

  const handlePurposeToggle = async (obj: Objective, purposeId: string) => {
    const current = obj.purpose_ids ?? [];
    const next = current.includes(purposeId)
      ? current.filter((id) => id !== purposeId)
      : [...current, purposeId];
    await db.entries.update(obj.id, { purpose_ids: next } as any);
  };

  const handleDomainToggle = async (obj: Objective, domainId: string) => {
    const current = obj.domain_ids ?? [];
    const next = current.includes(domainId)
      ? current.filter((id) => id !== domainId)
      : [...current, domainId];
    await db.entries.update(obj.id, { domain_ids: next } as any);
  };

  const assignedCategories = (obj: Objective) =>
    (obj.category_ids ?? []).map((id) => categoryMap[id]).filter(Boolean) as Category[];

  const matchesHighlightedDomain = (obj: Objective) => {
    if (!highlightDomainId) return true;
    if ((obj.domain_ids ?? []).includes(highlightDomainId)) return true;
    return (obj.purpose_ids ?? []).some((pid) => {
      const purpose = purposes.find((p) => p.id === pid);
      return (purpose?.domain_ids ?? []).includes(highlightDomainId);
    });
  };

  const renderObjectiveRow = (obj: Objective) => {
    const assigned = assignedCategories(obj);
    const isDimmedByPurpose =
      highlightPurposeIds != null &&
      highlightPurposeIds.length > 0 &&
      !(obj.purpose_ids ?? []).some((pid) => highlightPurposeIds.includes(pid));
    const isDimmedByDomain = highlightDomainId != null && !matchesHighlightedDomain(obj);
    const isDimmed = isDimmedByPurpose || isDimmedByDomain;
    return (
      <div
        key={obj.id}
        className={`relative flex flex-col gap-1.5 px-4 py-3 border rounded-xl transition-colors group ${
          isDimmed ? 'opacity-50' : ''
        } ${
          obj.status === 'done'
            ? 'bg-emerald-950/10 border-emerald-900/30 hover:border-emerald-800/50'
            : obj.status === 'archived'
              ? 'bg-stone-900/20 border-stone-800/40 hover:border-stone-700/60'
              : 'bg-[#0a0a0a] border-stone-800/80 hover:border-stone-700'
        }`}
      >
        {/* Top row: Status circle + Title + Actions (archive/delete) */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Status circle */}
          <button
            onClick={() => handleToggleStatus(obj)}
            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              obj.status === 'done'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'border-stone-700 hover:border-stone-500'
            }`}
          >
            {obj.status === 'done' && <Check className="w-3 h-3 stroke-[3]" />}
          </button>

          {/* Title */}
          {editingId === obj.id ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit(obj);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onBlur={() => commitEdit(obj)}
              className="flex-1 bg-transparent text-sm font-serif text-stone-100 border-b border-stone-600 focus:outline-none focus:border-stone-400 pb-0.5 min-w-0"
            />
          ) : (
            <button
              onClick={() => obj.status === 'todo' && startEdit(obj)}
              className={`flex-1 text-sm font-serif min-w-0 truncate text-left ${
                obj.status === 'done'
                  ? 'line-through text-stone-500 cursor-default'
                  : obj.status === 'archived'
                    ? 'text-stone-600 cursor-default'
                    : 'text-stone-200 hover:text-white transition-colors cursor-pointer'
              }`}
            >
              {obj.title}
            </button>
          )}

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

          {/* Actions: always visible on mobile, hover on desktop */}
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
          {/* Linked goal chip */}
          {obj.goal_id && goalMap[obj.goal_id] ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGoalPickerTarget(obj);
              }}
              className="text-[9px] font-mono text-sky-500 bg-sky-950/20 border border-sky-800/30 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-sky-950/30 transition-colors cursor-pointer"
            >
              <Flag className="w-2.5 h-2.5" />
              <span className="max-w-[100px] truncate">{goalMap[obj.goal_id].title}</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGoalPickerTarget(obj);
              }}
              className="text-[9px] font-mono text-stone-600 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded flex items-center gap-1 hover:text-sky-400 hover:border-sky-800/50 transition-colors cursor-pointer"
            >
              <Flag className="w-2.5 h-2.5" />
              <span>Link Goal</span>
            </button>
          )}

          {/* Task count chip */}
          {taskCountByObjective[obj.id] > 0 && (
            <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded flex items-center gap-1">
              {taskCountByObjective[obj.id]} tasks
            </span>
          )}

          {/* Time spent */}
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

          {/* Assigned purpose chips */}
          {(obj.purpose_ids ?? []).map((pid) => {
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

          {(obj.domain_ids ?? []).map((did) => {
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
              setPurposePickerTarget(obj);
            }}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-stone-800 text-stone-500 hover:text-indigo-400 hover:border-indigo-700/50 transition-colors cursor-pointer"
          >
            <Compass className="w-2.5 h-2.5" />
            Purpose
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setDomainPickerTarget(obj);
            }}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-stone-800 text-stone-500 hover:text-teal-400 hover:border-teal-700/50 transition-colors cursor-pointer"
          >
            <Globe className="w-2.5 h-2.5" />
            Domain
          </button>

          {/* Tag button + popover */}
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
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Header */}
      {!isInline && (
        <div className="flex items-center justify-between border-b border-stone-800/60 px-4 py-3.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-rose-400 bg-rose-500/10 border-rose-500/20 flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            Objectives
          </span>
          <button
            onClick={onClose}
            className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Category strip – full width */}
      <CategoryStrip
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
        onManage={() => setIsCategoryManagerOpen(true)}
      />

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {filteredTodoObjectives.length > 0 && (
          <div className="pt-3 pb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-1">
              Active ({filteredTodoObjectives.length})
            </span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedTodoObjectives.map((o) => o.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedTodoObjectives.map((o) => (
              <SortableRow key={o.id} id={o.id}>
                {renderObjectiveRow(o)}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>

        {filteredDoneObjectives.length > 0 && (
          <div className="pt-4 pb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-1">
              Completed ({filteredDoneObjectives.length})
            </span>
          </div>
        )}
        {filteredDoneObjectives.map(renderObjectiveRow)}

        {filteredArchivedObjectives.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 px-1 pt-4 pb-1 text-stone-500 hover:text-stone-400 transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showArchived ? '' : '-rotate-90'}`}
              />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest">
                Archived ({filteredArchivedObjectives.length})
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
                  {filteredArchivedObjectives.map(renderObjectiveRow)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {typedObjectives.length === 0 && (
          <div className="py-12 text-center text-stone-600">
            <Target className="w-8 h-8 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No objectives yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create your first objective below. Objectives are long-running goals that span
              multiple days.
            </p>
          </div>
        )}
      </div>

      {/* Create input */}
      <div className="flex-none p-3 border-t border-stone-850 bg-[#121212] relative z-10">
        <div className="flex items-stretch gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="Capture new medium-term objective..."
            className="flex-1 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500/50 focus:bg-stone-950 transition-all shadow-inner animate-none"
          />
          <button
            onClick={handleCreate}
            className="px-5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/35 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="md:hidden xl:inline">Objective</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className="h-full w-full flex flex-col relative bg-[#121212] border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        {content}
        <CategoryManagementSheet
          open={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          scope="objective"
        />

        <GoalPickerSheet
          open={goalPickerTarget !== null}
          onClose={() => setGoalPickerTarget(null)}
          currentGoalId={goalPickerTarget?.goal_id}
          onSelect={handleGoalSelect}
          isMobile={isMobile}
        />

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
            scope="objective"
          />

          <GoalPickerSheet
            open={goalPickerTarget !== null}
            onClose={() => setGoalPickerTarget(null)}
            currentGoalId={goalPickerTarget?.goal_id}
            onSelect={handleGoalSelect}
            isMobile={isMobile}
          />

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
      )}
    </AnimatePresence>
  );
}
