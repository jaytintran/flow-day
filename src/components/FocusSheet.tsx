/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { Compass, Globe, Plus, Trash2, Check, ChevronDown, X } from 'lucide-react';
import { db } from '../db';
import { Purpose, Domain } from '../types';
import SortableRow from './SortableRow';
import DomainPickerSheet from './DomainPickerSheet';

interface FocusSheetProps {
  isInline?: boolean;
  onClose?: () => void;
  selectedPurposeId: string | null;
  selectedDomainId: string | null;
  onSelectPurpose: (id: string | null) => void;
  onSelectDomain: (id: string | null) => void;
}

export default function FocusSheet({
  isInline = false,
  onClose = () => {},
  selectedPurposeId,
  selectedDomainId,
  onSelectPurpose,
  onSelectDomain,
}: FocusSheetProps) {
  const [activeTab, setActiveTab] = useState<'purposes' | 'domains'>('purposes');
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [domainPickerOpenId, setDomainPickerOpenId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const purposes = (useLiveQuery(() => db.purposes.toArray()) || []) as Purpose[];
  const domains = (useLiveQuery(() => db.domains.toArray()) || []) as Domain[];

  // Counts for badges
  const allGoals = useLiveQuery(() => db.entries.where('type').equals('goal').toArray()) || [];
  const allObjectives =
    useLiveQuery(() => db.entries.where('type').equals('objective').toArray()) || [];
  const allHabits = useLiveQuery(() => db.habits.toArray()) || [];

  const purposeGoalCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of allGoals as any[]) {
      for (const pid of g.purpose_ids ?? []) {
        counts[pid] = (counts[pid] || 0) + 1;
      }
    }
    return counts;
  }, [allGoals]);

  const purposeObjectiveCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of allObjectives as any[]) {
      for (const pid of o.purpose_ids ?? []) {
        counts[pid] = (counts[pid] || 0) + 1;
      }
    }
    return counts;
  }, [allObjectives]);

  const purposeHabitCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of allHabits as any[]) {
      for (const pid of h.purpose_ids ?? []) {
        counts[pid] = (counts[pid] || 0) + 1;
      }
    }
    return counts;
  }, [allHabits]);

  const domainPurposeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of purposes) {
      for (const did of p.domain_ids ?? []) {
        counts[did] = (counts[did] || 0) + 1;
      }
    }
    return counts;
  }, [purposes]);

  const domainMap = React.useMemo(() => {
    const map: Record<string, Domain> = {};
    for (const d of domains) map[d.id] = d;
    return map;
  }, [domains]);

  // Sorted lists
  const sortedPurposes = [...purposes].sort(
    (a, b) =>
      (a.sort_order ?? Date.parse(a.created_at.toString())) -
      (b.sort_order ?? Date.parse(b.created_at.toString())),
  );
  const sortedDomains = [...domains].sort(
    (a, b) =>
      (a.sort_order ?? Date.parse(a.created_at.toString())) -
      (b.sort_order ?? Date.parse(b.created_at.toString())),
  );

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [optimisticPurposes, setOptimisticPurposes] = useState<Purpose[] | null>(null);
  const [optimisticDomains, setOptimisticDomains] = useState<Domain[] | null>(null);

  const displayPurposes = optimisticPurposes ?? sortedPurposes;
  const displayDomains = optimisticDomains ?? sortedDomains;

  const handleDragEndPurposes = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = displayPurposes.map((p) => p.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(ids, oldIndex, newIndex);
      setOptimisticPurposes(
        reordered.map((id, idx) => ({
          ...displayPurposes.find((p) => p.id === id)!,
          sort_order: idx,
        })),
      );
      for (let i = 0; i < reordered.length; i++) {
        await db.purposes.update(reordered[i], { sort_order: i });
      }
      setTimeout(() => setOptimisticPurposes(null), 2000);
    },
    [displayPurposes],
  );

  const handleDragEndDomains = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = displayDomains.map((d) => d.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(ids, oldIndex, newIndex);
      setOptimisticDomains(
        reordered.map((id, idx) => ({
          ...displayDomains.find((d) => d.id === id)!,
          sort_order: idx,
        })),
      );
      for (let i = 0; i < reordered.length; i++) {
        await db.domains.update(reordered[i], { sort_order: i });
      }
      setTimeout(() => setOptimisticDomains(null), 2000);
    },
    [displayDomains],
  );

  // CRUD
  const handleCreate = async () => {
    const t = newTitle.trim();
    if (!t) return;
    if (activeTab === 'purposes') {
      const p: Purpose = { id: crypto.randomUUID(), title: t, created_at: new Date() };
      await db.purposes.add(p);
    } else {
      const d: Domain = { id: crypto.randomUUID(), title: t, created_at: new Date() };
      await db.domains.add(d);
    }
    setNewTitle('');
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string, type: 'purpose' | 'domain') => {
    if (type === 'purpose') {
      await db.purposes.delete(id);
      if (selectedPurposeId === id) onSelectPurpose(null);
    } else {
      await db.domains.delete(id);
      if (selectedDomainId === id) onSelectDomain(null);
    }
  };

  const commitEdit = async (id: string, type: 'purpose' | 'domain') => {
    const t = editTitle.trim();
    if (t) {
      if (type === 'purpose') await db.purposes.update(id, { title: t });
      else await db.domains.update(id, { title: t });
    }
    setEditingId(null);
  };

  const handleToggleDomainOnPurpose = async (purpose: Purpose, domainId: string) => {
    const current = purpose.domain_ids ?? [];
    const next = current.includes(domainId)
      ? current.filter((id) => id !== domainId)
      : [...current, domainId];
    await db.purposes.update(purpose.id, { domain_ids: next });
  };

  const renderPurposeRow = (purpose: Purpose) => {
    const isSelected = selectedPurposeId === purpose.id;
    const assignedDomains = (purpose.domain_ids ?? [])
      .map((id) => domainMap[id])
      .filter(Boolean) as Domain[];

    return (
      <div
        key={purpose.id}
        className={`relative flex flex-col gap-1.5 px-3 py-2.5 border rounded-xl transition-all group cursor-pointer ${
          isSelected
            ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.1)]'
            : 'bg-[#0a0a0a] border-stone-800/80 hover:border-stone-700'
        }`}
        onDoubleClick={() => {
          onSelectDomain(null);
          onSelectPurpose(isSelected ? null : purpose.id);
        }}
        title="Double-click to filter by this purpose"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-indigo-500/30 border-indigo-400'
                : 'border-stone-700 group-hover:border-stone-500'
            }`}
          >
            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
          </div>

          {editingId === purpose.id ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit(purpose.id, 'purpose');
                if (e.key === 'Escape') setEditingId(null);
              }}
              onBlur={() => commitEdit(purpose.id, 'purpose')}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent text-sm font-serif text-stone-100 border-b border-stone-600 focus:outline-none focus:border-indigo-400 pb-0.5 min-w-0"
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(purpose.id);
                setEditTitle(purpose.title);
              }}
              className={`flex-1 text-sm font-serif text-left truncate transition-colors ${
                isSelected ? 'text-indigo-200' : 'text-stone-200 hover:text-white'
              }`}
            >
              {purpose.title}
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(purpose.id, 'purpose');
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <div
          className="flex items-center gap-1.5 pl-6 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {purposeGoalCounts[purpose.id] > 0 && (
            <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">
              {purposeGoalCounts[purpose.id]} goals
            </span>
          )}
          {purposeObjectiveCounts[purpose.id] > 0 && (
            <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">
              {purposeObjectiveCounts[purpose.id]} objectives
            </span>
          )}
          {purposeHabitCounts[purpose.id] > 0 && (
            <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">
              {purposeHabitCounts[purpose.id]} habits
            </span>
          )}

          {assignedDomains.map((d) => (
            <span
              key={d.id}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-teal-700/40 text-teal-400 bg-teal-500/10"
            >
              <Globe className="w-2.5 h-2.5" />
              {d.title}
            </span>
          ))}

          {domains.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDomainPickerOpenId(purpose.id);
              }}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-stone-800 text-stone-500 hover:text-teal-400 hover:border-teal-700/50 transition-colors cursor-pointer"
            >
              <Globe className="w-2.5 h-2.5" />
              Domain
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDomainRow = (domain: Domain) => {
    const isSelected = selectedDomainId === domain.id;
    const purposeCount = domainPurposeCounts[domain.id] ?? 0;

    return (
      <div
        key={domain.id}
        className={`relative flex items-center gap-2.5 px-3 py-2.5 border rounded-xl transition-all group cursor-pointer ${
          isSelected
            ? 'bg-teal-500/10 border-teal-500/40 shadow-[0_0_12px_rgba(20,184,166,0.1)]'
            : 'bg-[#0a0a0a] border-stone-800/80 hover:border-stone-700'
        }`}
        onDoubleClick={() => {
          onSelectPurpose(null);
          onSelectDomain(isSelected ? null : domain.id);
        }}
        title="Double-click to filter by this domain"
      >
        <div
          className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-teal-500/30 border-teal-400'
              : 'border-stone-700 group-hover:border-stone-500'
          }`}
        >
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
        </div>

        {editingId === domain.id ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit(domain.id, 'domain');
              if (e.key === 'Escape') setEditingId(null);
            }}
            onBlur={() => commitEdit(domain.id, 'domain')}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-sm font-serif text-stone-100 border-b border-stone-600 focus:outline-none focus:border-teal-400 pb-0.5 min-w-0"
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(domain.id);
              setEditTitle(domain.title);
            }}
            className={`flex-1 text-sm font-serif text-left truncate transition-colors ${
              isSelected ? 'text-teal-200' : 'text-stone-200 hover:text-white'
            }`}
          >
            {domain.title}
          </button>
        )}

        {purposeCount > 0 && (
          <span className="text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded shrink-0">
            {purposeCount} purposes
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(domain.id, 'domain');
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full bg-[#121212]">
      {!isInline && (
        <div className="flex items-center justify-between border-b border-stone-800/60 px-4 py-3.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-indigo-400 bg-indigo-500/10 border-indigo-500/20 flex items-center gap-1.5">
            <Compass className="w-3 h-3" />
            Focus
          </span>
          <button
            onClick={onClose}
            className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex gap-1 p-2 border-b border-stone-800/60">
        <button
          onClick={() => setActiveTab('purposes')}
          className={`flex-1 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer transition-all ${
            activeTab === 'purposes'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-stone-500 border border-transparent hover:text-stone-400'
          }`}
        >
          <Compass className="w-3 h-3 inline mr-1.5" />
          Purposes
        </button>
        <button
          onClick={() => setActiveTab('domains')}
          className={`flex-1 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-widest font-mono cursor-pointer transition-all ${
            activeTab === 'domains'
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
              : 'text-stone-500 border border-transparent hover:text-stone-400'
          }`}
        >
          <Globe className="w-3 h-3 inline mr-1.5" />
          Domains
        </button>
      </div>

      {(selectedPurposeId || selectedDomainId) && (
        <div className="px-3 py-2 border-b border-stone-800/40">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-widest">
              Filtering:
            </span>
            {selectedPurposeId && (
              <button
                onClick={() => onSelectPurpose(null)}
                className="flex items-center gap-1 text-[9px] font-mono bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full hover:bg-indigo-500/20 transition-colors cursor-pointer"
              >
                {purposes.find((p) => p.id === selectedPurposeId)?.title ?? 'Purpose'}
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {selectedDomainId && (
              <button
                onClick={() => onSelectDomain(null)}
                className="flex items-center gap-1 text-[9px] font-mono bg-teal-500/10 border border-teal-500/30 text-teal-400 px-2 py-0.5 rounded-full hover:bg-teal-500/20 transition-colors cursor-pointer"
              >
                {domains.find((d) => d.id === selectedDomainId)?.title ?? 'Domain'}
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5 pt-3">
        {activeTab === 'purposes' ? (
          <>
            {displayPurposes.length === 0 ? (
              <div className="py-12 text-center text-stone-600">
                <Compass className="w-8 h-8 mx-auto mb-2 text-stone-700" />
                <p className="text-xs font-sans">No purposes yet</p>
                <p className="text-[10px] font-sans text-stone-700 mt-1">
                  A purpose is the why behind your goals. Create one below.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndPurposes}
              >
                <SortableContext
                  items={displayPurposes.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {displayPurposes.map((p) => (
                    <SortableRow key={p.id} id={p.id}>
                      {renderPurposeRow(p)}
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </>
        ) : (
          <>
            {displayDomains.length === 0 ? (
              <div className="py-12 text-center text-stone-600">
                <Globe className="w-8 h-8 mx-auto mb-2 text-stone-700" />
                <p className="text-xs font-sans">No domains yet</p>
                <p className="text-[10px] font-sans text-stone-700 mt-1">
                  A domain is a broad life area — Health, Career, Relationships.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndDomains}
              >
                <SortableContext
                  items={displayDomains.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {displayDomains.map((d) => (
                    <SortableRow key={d.id} id={d.id}>
                      {renderDomainRow(d)}
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </div>

      <div className="flex-none p-3 border-t border-stone-800 bg-[#121212] relative z-10">
        <div className="flex items-stretch gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder={activeTab === 'purposes' ? 'New purpose...' : 'New domain...'}
            className={`flex-1 bg-[#0a0a0a] text-stone-100 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none transition-all shadow-inner ${
              activeTab === 'purposes' ? 'focus:border-indigo-500/50' : 'focus:border-teal-500/50'
            }`}
          />
          <button
            onClick={handleCreate}
            className={`px-5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer border ${
              activeTab === 'purposes'
                ? 'bg-indigo-500/10 hover:bg-indigo-500/25 border-indigo-500/35 text-indigo-400 hover:text-indigo-300'
                : 'bg-teal-500/10 hover:bg-teal-500/25 border-teal-500/35 text-teal-400 hover:text-teal-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="md:hidden xl:inline">
              {activeTab === 'purposes' ? 'Purpose' : 'Domain'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const purposeToPicker = purposes.find((p) => p.id === domainPickerOpenId);

  return (
    <>
      {isInline ? (
        <div className="h-full w-full flex flex-col relative bg-[#121212] border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          {content}
        </div>
      ) : (
        content
      )}
      {purposeToPicker && (
        <DomainPickerSheet
          open={!!domainPickerOpenId}
          onClose={() => setDomainPickerOpenId(null)}
          currentDomainIds={purposeToPicker.domain_ids ?? []}
          onToggle={(domainId) => handleToggleDomainOnPurpose(purposeToPicker, domainId)}
          isMobile={isMobile}
        />
      )}
    </>
  );
}
