/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileText,
  Sparkles,
  Calendar,
  Trash2,
  Search,
  Pin,
  Tag,
  Layers,
  Inbox,
  Plus,
  Pencil,
  Star,
  X,
  Maximize2,
  Minimize2,
  Send,
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
import { AnimatePresence, motion } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TimelineEntry, Event, Note, Category } from '../../types';
import { db } from '../../db';
import {
  toLocalDateString,
  RECORD_CATEGORY_SCOPE,
  toggleRecordPin,
  createRecordCategory,
  migrateRecordsOnCategoryDelete,
} from '../../utils';
import RecordCategoryPickerModal from './RecordCategoryPickerModal';
import CategoryIcon from '../CategoryIcon';
import InlineIconColorPopover from '../InlineIconColorPopover';
import SortableCategorySidebarItem from './lists/SortableCategorySidebarItem';
import MarkdownPreview from '../MarkdownPreview';

interface RecordsViewProps {
  entries: TimelineEntry[];
  deletingId: string | null;
  onDeleteEntry: (id: string) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  formatTime: (dateInput: Date | string) => string;
  formatDateStringLabel: (dayStr: string) => string;
}

// Identical to LIST_COLORS in ListsView for visual cohesion
const CAT_COLORS: Record<string, { active: string; dot: string; glow: string }> = {
  violet: {
    active: 'bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]',
    dot: 'bg-violet-500',
    glow: 'text-violet-400',
  },
  emerald: {
    active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    dot: 'bg-emerald-500',
    glow: 'text-emerald-400',
  },
  sky: {
    active: 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)]',
    dot: 'bg-sky-500',
    glow: 'text-sky-400',
  },
  rose: {
    active: 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]',
    dot: 'bg-rose-500',
    glow: 'text-rose-400',
  },
  amber: {
    active: 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    dot: 'bg-amber-500',
    glow: 'text-amber-400',
  },
  teal: {
    active: 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]',
    dot: 'bg-teal-500',
    glow: 'text-teal-400',
  },
  indigo: {
    active: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]',
    dot: 'bg-indigo-500',
    glow: 'text-indigo-400',
  },
  orange: {
    active: 'bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.15)]',
    dot: 'bg-orange-500',
    glow: 'text-orange-400',
  },
};

export default function RecordsView({
  entries,
  deletingId,
  onDeleteEntry,
  onOpenDetail,
  formatTime,
  formatDateStringLabel,
}: RecordsViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'event' | 'note'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    return localStorage.getItem('flowday-records-selected-category') ?? 'all';
  });
  const [pickerRecord, setPickerRecord] = useState<(Event | Note) | null>(null);

  // Sidebar Direct Category Creation State
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<Category['color']>('violet');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Tag');
  const [isNewCategoryPopoverOpen, setIsNewCategoryPopoverOpen] = useState(false);

  // Sidebar Direct Category Inline Rename State
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Quick Record Input Bar State
  const [quickRecordTitle, setQuickRecordTitle] = useState('');
  const [quickRecordType, setQuickRecordType] = useState<'note' | 'event'>('note');
  const [quickRecordPinned, setQuickRecordPinned] = useState(false);
  const quickRecordInputRef = useRef<HTMLInputElement>(null);

  // Open Details Modal for Rich Note/Event Creation
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'note' | 'event'>('note');
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalPinned, setModalPinned] = useState(false);
  const [modalStarred, setModalStarred] = useState(false);
  const [modalCategoryIds, setModalCategoryIds] = useState<string[]>([]);
  const [isModalMaximized, setIsModalMaximized] = useState(false);

  // Dedicated Drag Sensor for Custom Categories in Sidebar
  const categorySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Save selected category filter preference
  useEffect(() => {
    localStorage.setItem('flowday-records-selected-category', selectedCategoryId);
  }, [selectedCategoryId]);

  // Fetch record categories
  const rawCategories = (useLiveQuery(
    () => db.categories.where('scope').equals(RECORD_CATEGORY_SCOPE).toArray(),
    [],
  ) ?? []) as Category[];

  const categories: Category[] = useMemo(() => {
    return [...rawCategories].sort((a, b) => {
      const aO = (a as any).sort_order ?? Date.parse(a.created_at.toString());
      const bO = (b as any).sort_order ?? Date.parse(b.created_at.toString());
      return aO - bO;
    });
  }, [rawCategories]);

  // Handle Drag Reorder for Custom Categories
  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      const reordered = arrayMove(categories, oldIdx, newIdx);
      await db.transaction('rw', db.categories, async () => {
        for (let i = 0; i < reordered.length; i++) {
          await db.categories.update(reordered[i].id, { sort_order: i });
        }
      });
    }
  };

  // Direct Category Creation Commit
  const handleCommitCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setIsCreatingCategory(false);
      setNewCategoryName('');
      return;
    }
    const createdId = await createRecordCategory(trimmed, newCategoryColor, newCategoryIcon);
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setNewCategoryColor('violet');
    setNewCategoryIcon('Tag');
    if (createdId) {
      setSelectedCategoryId(createdId);
    }
  };

  // Category Deletion
  const handleDeleteCategory = async (catId: string) => {
    await migrateRecordsOnCategoryDelete(catId);
    if (selectedCategoryId === catId) {
      setSelectedCategoryId('all');
    }
  };

  // All base records (events & notes)
  const allRecords = useMemo(() => {
    return entries.filter((e) => e.type === 'event' || e.type === 'note') as (Event | Note)[];
  }, [entries]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allRecords.length,
      none: 0,
      events: allRecords.filter((r) => r.type === 'event').length,
      notes: allRecords.filter((r) => r.type === 'note').length,
    };

    categories.forEach((cat) => {
      counts[cat.id] = 0;
    });

    allRecords.forEach((record) => {
      const catIds = record.category_ids ?? [];
      if (catIds.length === 0) {
        counts.none = (counts.none || 0) + 1;
      } else {
        catIds.forEach((id) => {
          if (counts[id] !== undefined) {
            counts[id]++;
          }
        });
      }
    });

    return counts;
  }, [allRecords, categories]);

  // 1. Filter by Category / Smart View
  const categoryFilteredRecords = useMemo(() => {
    if (selectedCategoryId === 'all') return allRecords;
    if (selectedCategoryId === 'none') {
      return allRecords.filter((r) => !r.category_ids || r.category_ids.length === 0);
    }
    if (selectedCategoryId === 'events') {
      return allRecords.filter((r) => r.type === 'event');
    }
    if (selectedCategoryId === 'notes') {
      return allRecords.filter((r) => r.type === 'note');
    }
    return allRecords.filter((r) => r.category_ids?.includes(selectedCategoryId));
  }, [allRecords, selectedCategoryId]);

  // 2. Filter by Type (All / Event / Note)
  const typeFilteredRecords = useMemo(() => {
    if (filterType === 'all') return categoryFilteredRecords;
    return categoryFilteredRecords.filter((r) => r.type === filterType);
  }, [categoryFilteredRecords, filterType]);

  // 3. Filter by Search Query
  const searchedRecords = useMemo(() => {
    if (!searchQuery.trim()) return typeFilteredRecords;
    const q = searchQuery.toLowerCase();
    return typeFilteredRecords.filter((r) => {
      const title = (
        (r.type === 'note' ? (r as Note).title : (r as Event).title) || ''
      ).toLowerCase();
      const content = (r.content || '').toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }, [typeFilteredRecords, searchQuery]);

  // Separate Pinned items vs Chronological feed
  const pinnedRecords = useMemo(() => {
    return searchedRecords.filter((r) => r.pinned);
  }, [searchedRecords]);

  const regularRecords = useMemo(() => {
    return searchedRecords.filter((r) => !r.pinned);
  }, [searchedRecords]);

  // Group regular records by day
  const regularRecordsGrouped: { [dayStr: string]: (Event | Note)[] } = useMemo(() => {
    const grouped: { [dayStr: string]: (Event | Note)[] } = {};
    regularRecords.forEach((e) => {
      const dayStr = toLocalDateString(new Date(e.timestamp));
      if (!grouped[dayStr]) {
        grouped[dayStr] = [];
      }
      grouped[dayStr].push(e);
    });
    return grouped;
  }, [regularRecords]);

  const sortedDays = useMemo(() => {
    return Object.keys(regularRecordsGrouped).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );
  }, [regularRecordsGrouped]);

  const activeCategory = categories.find((c) => c.id === selectedCategoryId);

  // Quick Record Creation Handler
  const handleQuickCreateRecord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickRecordTitle.trim();
    if (!trimmed) return;

    const targetCatIds: string[] = [];
    if (
      selectedCategoryId &&
      selectedCategoryId !== 'all' &&
      selectedCategoryId !== 'none' &&
      selectedCategoryId !== 'events' &&
      selectedCategoryId !== 'notes'
    ) {
      targetCatIds.push(selectedCategoryId);
    }

    const entryId = crypto.randomUUID();
    const now = new Date();
    const newEntry: TimelineEntry = {
      id: entryId,
      type: quickRecordType,
      title: trimmed,
      content: '',
      timestamp: now,
      created_at: now,
      scheduled_at: now,
      pinned: quickRecordPinned,
      ...(targetCatIds.length > 0 ? { category_ids: targetCatIds } : {}),
    };

    await db.entries.add(newEntry);
    setQuickRecordTitle('');
    quickRecordInputRef.current?.focus();
  };

  // Open Details Modal for Rich Note/Event Creation
  const handleOpenDetailModal = (typeToUse?: 'note' | 'event') => {
    const t = typeToUse || (selectedCategoryId === 'events' ? 'event' : selectedCategoryId === 'notes' ? 'note' : quickRecordType);
    setModalType(t);
    setModalTitle(quickRecordTitle.trim());
    setModalContent('');
    setModalPinned(quickRecordPinned);
    setModalStarred(false);

    const initialCats: string[] = [];
    if (
      selectedCategoryId &&
      selectedCategoryId !== 'all' &&
      selectedCategoryId !== 'none' &&
      selectedCategoryId !== 'events' &&
      selectedCategoryId !== 'notes'
    ) {
      initialCats.push(selectedCategoryId);
    }
    setModalCategoryIds(initialCats);
    setIsDetailModalOpen(true);
  };

  // Save from Detail Modal
  const handleSaveDetailRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = modalTitle.trim();
    if (!trimmed) return;

    const entryId = crypto.randomUUID();
    const now = new Date();
    const newEntry: TimelineEntry = {
      id: entryId,
      type: modalType,
      title: trimmed,
      content: modalContent.trim(),
      timestamp: now,
      created_at: now,
      scheduled_at: now,
      pinned: modalPinned,
      starred: modalStarred,
      ...(modalCategoryIds.length > 0 ? { category_ids: modalCategoryIds } : {}),
    };

    await db.entries.add(newEntry);
    setIsDetailModalOpen(false);
    setModalTitle('');
    setModalContent('');
    setModalPinned(false);
    setModalStarred(false);
    setQuickRecordTitle('');
  };

  // Render an individual card
  const renderCard = (record: Event | Note, isPinnedShelfItem = false) => {
    const isEvent = record.type === 'event';
    const isPinned = record.pinned ?? false;
    const recordCategoryIds = record.category_ids ?? [];
    const assignedCategories = recordCategoryIds
      .map((id) => categories.find((c) => c.id === id))
      .filter((c): c is Category => Boolean(c));

    return (
      <div
        key={record.id}
        id={`record-card-${record.id}`}
        onClick={() => onOpenDetail(record)}
        className={`group/card relative flex flex-col justify-between p-4 bg-[#121212]/95 border rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
          isPinned
            ? 'border-amber-500/30 bg-amber-500/[0.02] hover:border-amber-500/50 hover:bg-amber-500/[0.04]'
            : isEvent
              ? 'border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5'
              : 'border-stone-850 hover:border-stone-700 hover:bg-stone-900/20'
        }`}
      >
        {/* Top Badges & Actions */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Type badge */}
            <span
              className={`text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                isEvent
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'bg-stone-850 text-stone-400 border border-stone-800'
              }`}
            >
              {isEvent ? 'Event' : 'Note'}
            </span>

            {/* Category pills on card */}
            {assignedCategories.map((cat) => {
              const cs = CAT_COLORS[cat.color] ?? CAT_COLORS['indigo'];
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCategoryId(cat.id);
                  }}
                  className={`inline-flex items-center gap-1 text-[8px] font-mono font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${cs.active}`}
                  title={`Filter by ${cat.name}`}
                >
                  <CategoryIcon
                    name={cat.icon}
                    color={cat.color}
                    className="w-2.5 h-2.5"
                    fallback="Tag"
                  />
                  <span className="truncate max-w-[80px]">{cat.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Pin / Unpin button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleRecordPin(record.id, isPinned);
              }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                isPinned
                  ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30'
                  : 'text-stone-600 hover:text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover/card:opacity-100'
              }`}
              title={isPinned ? 'Unpin record' : 'Pin to top'}
            >
              {isPinned ? <Pin className="w-3 h-3 fill-current" /> : <Pin className="w-3 h-3" />}
            </button>

            {/* Quick Assign Category button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPickerRecord(record);
              }}
              className="opacity-0 group-hover/card:opacity-100 p-1.5 rounded-lg text-stone-600 hover:text-stone-300 hover:bg-stone-800 transition-all cursor-pointer flex items-center justify-center"
              title="Assign Category"
            >
              <Tag className="w-3 h-3" />
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntry(record.id);
              }}
              className="opacity-0 group-hover/card:opacity-100 p-1.5 rounded-lg text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer flex items-center justify-center"
              title="Delete Record"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Record Content */}
        <div className="flex-1 space-y-1.5">
          {isEvent ? (
            <div>
              <h4 className="font-serif font-bold text-sm text-stone-100 tracking-wide break-words leading-snug">
                {(record as Event).title}
              </h4>
              {record.content?.trim() && (
                <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3 mt-1">
                  {record.content}
                </p>
              )}
            </div>
          ) : (
            <div>
              <h4 className="font-serif font-semibold text-sm text-stone-100 tracking-wide break-words leading-snug">
                {(record as Note).title || 'Untitled Note'}
              </h4>
              {record.content?.trim() ? (
                <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3 mt-1">
                  {record.content}
                </p>
              ) : (
                <p className="text-[11px] text-stone-600 italic mt-1">No description</p>
              )}
            </div>
          )}
        </div>

        {/* Footer timestamp */}
        <div className="mt-3 pt-2.5 border-t border-stone-850/60 flex items-center justify-between text-[10px] text-stone-500 font-mono">
          <div className="flex items-center gap-1.5">
            {isEvent ? (
              <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
            ) : (
              <FileText className="w-3 h-3 text-stone-400 shrink-0" />
            )}
            <span>
              {isPinnedShelfItem
                ? formatDateStringLabel(toLocalDateString(new Date(record.timestamp)))
                : formatTime(record.timestamp)}
            </span>
          </div>

          {isPinnedShelfItem && (
            <span className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-wider text-amber-400/90">
              <Pin className="w-2.5 h-2.5 fill-current" /> Pinned
            </span>
          )}
        </div>

        {/* Safety confirm delete banner */}
        {deletingId === record.id && (
          <div className="mt-3 pt-2 border-t border-red-950/30 flex items-center justify-between font-mono">
            <span className="text-[8px] text-red-400 font-bold uppercase">Confirm deletion?</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntry(record.id);
              }}
              className="px-2 py-0.5 bg-red-950/20 text-red-400 border border-red-800 rounded text-[8px] font-bold hover:bg-red-900 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  // For mobile strip fade effect
  const stripScrollRef = useRef<HTMLDivElement>(null);
  const [showStripFade, setShowStripFade] = useState(false);
  useEffect(() => {
    const el = stripScrollRef.current;
    if (!el) return;
    const check = () =>
      setShowStripFade(
        el.scrollWidth > el.clientWidth && el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
      );
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [categories]);

  // Active Category helper for input bar
  const activeCategoryForInput = categories.find((c) => c.id === selectedCategoryId);

  // Dedicated Quick Record Input Bar
  const quickRecordInputBar = (
    <div className="pt-2 pb-1 shrink-0">
      <form
        onSubmit={handleQuickCreateRecord}
        className="flex items-center gap-2 bg-[#121212]/95 backdrop-blur-md border border-stone-800 hover:border-stone-700 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20 rounded-2xl px-3 py-2 shadow-xl transition-all"
      >
        {/* Type selector toggle (Note / Event) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setQuickRecordType((prev) => (prev === 'note' ? 'event' : 'note'));
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              quickRecordType === 'event'
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-stone-100 hover:border-stone-700'
            }`}
            title="Click to toggle type (Note / Event)"
          >
            {quickRecordType === 'event' ? (
              <Calendar className="w-3 h-3 text-indigo-400" />
            ) : (
              <FileText className="w-3 h-3 text-stone-400" />
            )}
            <span>{quickRecordType === 'event' ? 'Event' : 'Note'}</span>
          </button>
        </div>

        {/* Target category badge if custom category is selected */}
        {activeCategoryForInput && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 text-[10px] font-mono font-semibold shrink-0">
            <CategoryIcon
              name={activeCategoryForInput.icon}
              color={activeCategoryForInput.color}
              className="w-3 h-3"
              fallback="Tag"
            />
            <span className="truncate max-w-[90px]">{activeCategoryForInput.name}</span>
          </span>
        )}

        {/* Text input */}
        <input
          ref={quickRecordInputRef}
          id="quick-record-input"
          type="text"
          value={quickRecordTitle}
          onChange={(e) => setQuickRecordTitle(e.target.value)}
          placeholder={
            activeCategoryForInput
              ? `Add ${quickRecordType === 'event' ? 'event' : 'note'} to "${activeCategoryForInput.name}"... (Enter to add)`
              : `Add ${quickRecordType === 'event' ? 'event' : 'note'}... (Enter to add)`
          }
          className="flex-1 min-w-0 bg-transparent text-[13px] text-stone-100 placeholder-stone-500 focus:outline-none"
        />

        {/* Pin toggle */}
        <button
          type="button"
          onClick={() => setQuickRecordPinned(!quickRecordPinned)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
            quickRecordPinned
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-transparent border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-800'
          }`}
          title={quickRecordPinned ? 'Pinned to top' : 'Pin record'}
        >
          <Pin className={`w-3.5 h-3.5 ${quickRecordPinned ? 'fill-current' : ''}`} />
        </button>

        {/* Open Details Modal (Pencil / Rich Editor) button */}
        <button
          type="button"
          onClick={() => handleOpenDetailModal()}
          className="p-1.5 rounded-lg border border-stone-800 hover:border-stone-700 bg-stone-900/80 text-stone-400 hover:text-amber-300 transition-all cursor-pointer shrink-0 flex items-center justify-center"
          title="Open rich details modal to write markdown description and assign categories"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Add button */}
        <button
          type="submit"
          disabled={!quickRecordTitle.trim()}
          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-stone-950 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden" id="records-view-root">
      {/* ─── MOBILE ONLY (< md): Full Height Flex with Sticky Docked Input ─── */}
      <div className="md:hidden flex flex-col flex-1 h-full min-h-0 overflow-hidden">
        {/* Top Search + Type Filter row */}
        <div className="shrink-0 flex flex-col gap-2 pb-1">
          <div className="z-20 bg-[#0a0a0a] py-0 flex items-center justify-between gap-2">
            <div className="relative flex items-center flex-1 max-w-[200px] sm:max-w-xs">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="w-full sm:w-64 pl-7 pr-2.5 py-1.5 text-[11px] font-mono bg-[#0a0a0a] border border-stone-800 rounded-lg text-stone-300 placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
              />
            </div>

            {/* Type Filter pills */}
            <div className="flex items-center gap-1 bg-[#0a0a0a] border border-stone-800 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-stone-800 text-stone-200 shadow-sm'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('event')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                  filterType === 'event'
                    ? 'bg-indigo-900/60 text-indigo-300 shadow-sm'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                Events
              </button>
              <button
                onClick={() => setFilterType('note')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                  filterType === 'note'
                    ? 'bg-blue-900/60 text-blue-300 shadow-sm'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                Notes
              </button>
            </div>
          </div>

          {/* Category strip */}
          <div className="relative flex items-center gap-1">
            {/* Pinned left: Smart views */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`shrink-0 p-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-stone-700 border-stone-600 text-stone-100'
                    : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
                }`}
                title="All Records"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryId('none')}
                className={`shrink-0 p-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedCategoryId === 'none'
                    ? 'bg-stone-700 border-stone-600 text-stone-100'
                    : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
                }`}
                title="Uncategorized"
              >
                <Inbox className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryId('events')}
                className={`shrink-0 p-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedCategoryId === 'events'
                    ? 'bg-indigo-900/60 border-indigo-500/50 text-indigo-300'
                    : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
                }`}
                title="Events"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryId('notes')}
                className={`shrink-0 p-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedCategoryId === 'notes'
                    ? 'bg-stone-700 border-stone-600 text-stone-100'
                    : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
                }`}
                title="Notes"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>

              {/* Divider */}
              {categories.length > 0 && <div className="w-px h-4 bg-stone-800 mx-0.5 shrink-0" />}
            </div>

            {/* Scrollable category pills */}
            <div
              ref={stripScrollRef}
              className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 pr-1 scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((cat) => {
                const cs = CAT_COLORS[cat.color] ?? CAT_COLORS['violet'];
                const isActive = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? `${cs.active} !border-amber-500 !text-stone-100`
                        : `${cs.active} border-stone-800 !text-stone-100 hover:text-stone-300 hover:border-stone-700`
                    }`}
                  >
                    <CategoryIcon
                      name={cat.icon}
                      color={cat.color}
                      className="w-3 h-3"
                      fallback="Tag"
                    />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Right fade overlay */}
            {showStripFade && (
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none" />
            )}
          </div>
        </div>

        {/* Mobile Content Feed (Independently Scrollable) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-6 pt-2 pb-2 pr-0.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Pinned shelf */}
          {pinnedRecords.length > 0 && (
            <div className="space-y-3 pb-2 border-b border-stone-900/80">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Pin className="w-3 h-3 fill-current" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400/90">
                  Pinned ({pinnedRecords.length})
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {pinnedRecords.map((record) => renderCard(record, true))}
              </div>
            </div>
          )}

          {/* Chronological groups */}
          {sortedDays.length > 0 ? (
            <div className="space-y-6">
              {sortedDays.map((dayStr) => {
                const dayRecords = regularRecordsGrouped[dayStr];
                if (!dayRecords || dayRecords.length === 0) return null;

                return (
                  <div key={dayStr} className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-950 border border-stone-900 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                      <span className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-widest">
                        {formatDateStringLabel(dayStr)}
                      </span>
                      <span className="text-[9px] font-mono text-stone-600 ml-0.5">
                        ({dayRecords.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {dayRecords.map((record) => renderCard(record, false))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : pinnedRecords.length === 0 ? (
            <div className="py-12 px-4 border border-dashed border-stone-850 rounded-2xl text-center text-stone-500">
              <Sparkles className="w-6 h-6 text-stone-800 mx-auto mb-2" />
              <p className="text-xs font-sans font-medium text-stone-400">No records found</p>
            </div>
          ) : null}
        </div>

        {/* Sticky Bottom Docked Quick Record Input on Mobile */}
        <div className="shrink-0 bg-[#0a0a0a]/95 backdrop-blur-md pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] border-t border-stone-850/80">
          {quickRecordInputBar}
        </div>
      </div>

      {/* ─── DESKTOP (>= md): Unified Two-Column Layout ─── */}
      <div className="hidden md:flex gap-0 flex-1 h-full min-h-0 overflow-hidden">
        {/* LEFT COLUMN — Sidebar */}
        <div className="w-[220px] lg:w-[270px] h-full overflow-y-auto shrink-0 flex flex-col min-h-0 border-r border-stone-800/60 pr-3 mr-3 font-sans">
          {/* Smart Views */}
          <div className="flex flex-col gap-1 pb-3 shrink-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500 px-2 py-0.5">
              Smart Views
            </span>

            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
                selectedCategoryId === 'all'
                  ? 'bg-white/[0.08] border-white/20 text-white shadow-sm font-semibold'
                  : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-200'
              }`}
            >
              <Layers className="w-4 h-4 text-stone-300 shrink-0" />
              <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                All Records
              </span>
              <span className="text-[11px] font-mono text-stone-500 font-semibold tabular-nums">
                {categoryCounts.all ?? 0}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategoryId('none')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
                selectedCategoryId === 'none'
                  ? 'bg-white/[0.08] border-white/20 text-white shadow-sm font-semibold'
                  : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-200'
              }`}
            >
              <Inbox className="w-4 h-4 text-stone-300 shrink-0" />
              <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                Uncategorized
              </span>
              <span className="text-[11px] font-mono text-stone-500 font-semibold tabular-nums">
                {categoryCounts.none ?? 0}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategoryId('events')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
                selectedCategoryId === 'events'
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)] font-semibold'
                  : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-indigo-300'
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                Events
              </span>
              <span className="text-[11px] font-mono text-indigo-400 font-semibold tabular-nums">
                {categoryCounts.events ?? 0}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategoryId('notes')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
                selectedCategoryId === 'notes'
                  ? 'bg-white/[0.08] border-white/20 text-white shadow-sm font-semibold'
                  : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-200'
              }`}
            >
              <FileText className="w-4 h-4 text-stone-300 shrink-0" />
              <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                Notes
              </span>
              <span className="text-[11px] font-mono text-stone-500 font-semibold tabular-nums">
                {categoryCounts.notes ?? 0}
              </span>
            </button>
          </div>

          {/* Custom Categories Header */}
          <div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between px-2 mb-1.5 shrink-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500">
              Custom Categories
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingCategory(true)}
              className="p-1 rounded-md text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Add new category"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Custom Categories Sortable Reordering */}
          <DndContext
            sensors={categorySensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoryDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0"
                style={{ scrollbarWidth: 'none' }}
              >
                {categories.map((cat) => {
                  const cs = CAT_COLORS[cat.color] ?? CAT_COLORS['violet'];
                  const isActive = selectedCategoryId === cat.id;
                  const count = categoryCounts[cat.id] ?? 0;

                  return (
                    <SortableCategorySidebarItem
                      key={cat.id}
                      category={cat}
                      isActive={isActive}
                      colorStyle={cs}
                      count={count}
                      isEditing={editingCategoryId === cat.id}
                      editingName={editingCategoryName}
                      onStartRename={() => {
                        setEditingCategoryId(cat.id);
                        setEditingCategoryName(cat.name);
                      }}
                      onRenameChange={setEditingCategoryName}
                      onCommitRename={async () => {
                        const trimmed = editingCategoryName.trim();
                        if (trimmed && trimmed !== cat.name) {
                          await db.categories.update(cat.id, {
                            name: trimmed,
                          });
                        }
                        setEditingCategoryId(null);
                      }}
                      onCancelRename={() => setEditingCategoryId(null)}
                      onSelect={() => setSelectedCategoryId(cat.id)}
                      onUpdateIcon={async (icon) => {
                        await db.categories.update(cat.id, { icon });
                      }}
                      onUpdateColor={async (color) => {
                        await db.categories.update(cat.id, { color });
                      }}
                      onDelete={() => handleDeleteCategory(cat.id)}
                    />
                  );
                })}

                {/* Inline New Category Creator */}
                {isCreatingCategory && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#141414] border border-amber-500/40 rounded-xl shadow-lg my-1">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setIsNewCategoryPopoverOpen(!isNewCategoryPopoverOpen)
                        }
                        className="p-1 rounded-lg bg-stone-900 border border-stone-800 hover:border-stone-700 cursor-pointer flex items-center justify-center"
                        title="Change icon & color"
                      >
                        <CategoryIcon
                          name={newCategoryIcon}
                          color={newCategoryColor}
                          className="w-4 h-4"
                          fallback="Tag"
                        />
                      </button>
                      <InlineIconColorPopover
                        isOpen={isNewCategoryPopoverOpen}
                        onClose={() => setIsNewCategoryPopoverOpen(false)}
                        currentIcon={newCategoryIcon}
                        currentColor={newCategoryColor}
                        fallbackIcon="Tag"
                        onSelectIcon={setNewCategoryIcon}
                        onSelectColor={setNewCategoryColor}
                      />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Category name..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitCreateCategory();
                        if (e.key === 'Escape') setIsCreatingCategory(false);
                      }}
                      onBlur={handleCommitCreateCategory}
                      className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-stone-100 placeholder-stone-600 focus:outline-none"
                    />
                  </div>
                )}

                {/* Ghost "+ New Category" Button */}
                {!isCreatingCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-mono text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-dashed border-stone-800/80 hover:border-stone-700 transition-all cursor-pointer mt-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-stone-500" />
                    <span>New Category</span>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* RIGHT COLUMN — Content area */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full">
          {/* Top Search + Type Filter Toolbar */}
          <div className="z-20 pb-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap shrink-0">
            <div className="relative flex items-center flex-1 max-w-[200px] sm:max-w-xs">
              <Search className="absolute left-3 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs font-mono bg-white/[0.03] border border-white/[0.08] rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:border-indigo-400/50 focus:bg-white/[0.05] transition-all"
              />
            </div>

            {/* Type switcher pills */}
            <div className="flex items-center gap-1 bg-[#121212] border border-stone-800 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-stone-800 text-stone-100 shadow-sm'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('event')}
                className={`px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  filterType === 'event'
                    ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                Events
              </button>
              <button
                onClick={() => setFilterType('note')}
                className={`px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  filterType === 'note'
                    ? 'bg-white/10 text-stone-200 shadow-sm border border-white/15'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                Notes
              </button>
            </div>
          </div>

          {/* Scrollable Records Grid */}
          <div
            className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#3d3d3d transparent',
            }}
          >
            {/* Active Header indicator */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {activeCategory ? (
                  <CategoryIcon
                    name={activeCategory.icon}
                    color={activeCategory.color}
                    className="w-4 h-4"
                    fallback="Tag"
                  />
                ) : selectedCategoryId === 'events' ? (
                  <Calendar className="w-4 h-4 text-indigo-400" />
                ) : selectedCategoryId === 'notes' ? (
                  <FileText className="w-4 h-4 text-stone-300" />
                ) : selectedCategoryId === 'none' ? (
                  <Inbox className="w-4 h-4 text-stone-400" />
                ) : (
                  <Layers className="w-4 h-4 text-stone-400" />
                )}
                <h3 className="text-[12px] font-mono font-bold uppercase tracking-widest text-stone-300">
                  {selectedCategoryId === 'all'
                    ? 'All Records'
                    : selectedCategoryId === 'none'
                      ? 'Uncategorized'
                      : selectedCategoryId === 'events'
                        ? 'Events'
                        : selectedCategoryId === 'notes'
                          ? 'Notes'
                          : (activeCategory?.name ?? 'Records')}
                </h3>
                <span className="text-[10px] font-mono text-stone-500 tabular-nums ml-1">
                  ({searchedRecords.length})
                </span>
              </div>
            </div>

            {/* 📌 PINNED ITEMS SHELF */}
            {pinnedRecords.length > 0 && (
              <div className="space-y-3 pb-2 border-b border-stone-900/80">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Pin className="w-3 h-3 fill-current" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400/90">
                    Pinned Shelf ({pinnedRecords.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {pinnedRecords.map((record) => renderCard(record, true))}
                </div>
              </div>
            )}

            {/* 📅 CHRONOLOGICAL REGULAR RECORDS FEED */}
            {sortedDays.length > 0 ? (
              <div className="space-y-8">
                {sortedDays.map((dayStr) => {
                  const dayRecords = regularRecordsGrouped[dayStr];
                  if (!dayRecords || dayRecords.length === 0) return null;

                  return (
                    <div key={dayStr} className="space-y-3" id={`historic-day-group-${dayStr}`}>
                      {/* Day Group Header */}
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-950 border border-stone-900 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                        <span className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-widest">
                          {formatDateStringLabel(dayStr)}
                        </span>
                        <span className="text-[9px] font-mono text-stone-600 ml-0.5">
                          ({dayRecords.length})
                        </span>
                      </div>

                      {/* Responsive Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {dayRecords.map((record) => renderCard(record, false))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : pinnedRecords.length === 0 ? (
              /* Empty State */
              <div className="py-20 px-6 border border-dashed border-stone-850 rounded-2xl text-center text-stone-500">
                <Sparkles className="w-8 h-8 text-stone-800 mx-auto mb-3" />
                <p className="text-sm font-sans font-medium text-stone-400">
                  {searchQuery.trim()
                    ? 'No matching notes or events'
                    : selectedCategoryId !== 'all'
                      ? 'No records in this category'
                      : filterType === 'event'
                        ? 'No events logged yet'
                        : filterType === 'note'
                          ? 'No notes logged yet'
                          : 'Your Records catalog is empty'}
                </p>
                <p className="text-xs font-sans text-stone-600 mt-1 max-w-sm mx-auto">
                  {searchQuery.trim()
                    ? 'Try a different search term or clear the filter.'
                    : selectedCategoryId !== 'all'
                      ? 'Assign notes or events to this category using the tag icon on any card.'
                      : 'Capture your thoughts and scheduled milestones using the input bar below.'}
                </p>
              </div>
            ) : null}
          </div>

          {/* Docked Quick Record Input for Records View */}
          {quickRecordInputBar}
        </div>
      </div>

      {/* ─── MODALS ─── */}
      {/* Category Picker Popover */}
      {pickerRecord && (
        <RecordCategoryPickerModal
          record={pickerRecord}
          categories={categories}
          onClose={() => setPickerRecord(null)}
        />
      )}

      {/* ─── RICH DETAIL CREATION MODAL ─── */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 md:p-8">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`relative z-10 w-full ${
                isModalMaximized ? 'max-w-6xl h-[92vh]' : 'max-w-4xl max-h-[88vh]'
              } bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 font-sans`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-850/80 bg-stone-950/50 shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Type Selector (Note vs Event) */}
                  <div className="flex items-center gap-1 bg-[#1c1c1c] border border-stone-800 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setModalType('note')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        modalType === 'note'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Note</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalType('event')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        modalType === 'event'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Event</span>
                    </button>
                  </div>

                  {/* Pin Toggle */}
                  <button
                    type="button"
                    onClick={() => setModalPinned(!modalPinned)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                      modalPinned
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    <Pin className={`w-3 h-3 ${modalPinned ? 'fill-current' : ''}`} />
                    <span>Pin</span>
                  </button>

                  {/* Star / Highlight Toggle */}
                  <button
                    type="button"
                    onClick={() => setModalStarred(!modalStarred)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                      modalStarred
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${modalStarred ? 'fill-current' : ''}`} />
                    <span>Highlight</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Maximize / Restore Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsModalMaximized(!isModalMaximized)}
                    className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                    title={isModalMaximized ? 'Restore window size' : 'Maximize editor'}
                  >
                    {isModalMaximized ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Form body */}
              <form
                onSubmit={handleSaveDetailRecord}
                className="px-6 sm:px-8 py-5 flex flex-col flex-1 min-h-0 space-y-4 overflow-hidden"
              >
                {/* Title */}
                <div className="space-y-1 border-b border-stone-850/80 pb-3 shrink-0">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className={`w-full bg-transparent text-stone-100 text-2xl font-serif font-bold tracking-tight focus:outline-none placeholder-stone-700 py-1 ${
                      modalType === 'event'
                        ? 'focus:border-amber-500/50'
                        : 'focus:border-blue-500/50'
                    }`}
                    placeholder={
                      modalType === 'event'
                        ? 'Event title (e.g. Project briefing presentation tomorrow at 10am)...'
                        : 'Note title (e.g. Weekly reflections, ideas & brainstorming)...'
                    }
                  />
                </div>

                {/* Categories Selector Strip */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold mr-1">
                      Categories:
                    </span>
                    {categories.map((cat) => {
                      const isAssigned = modalCategoryIds.includes(cat.id);
                      const cs = CAT_COLORS[cat.color] ?? CAT_COLORS['violet'];
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setModalCategoryIds((prev) =>
                              prev.includes(cat.id)
                                ? prev.filter((id) => id !== cat.id)
                                : [...prev, cat.id],
                            );
                          }}
                          className={`inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                            isAssigned
                              ? `${cs.active} font-semibold`
                              : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                          }`}
                        >
                          <CategoryIcon
                            name={cat.icon}
                            color={cat.color}
                            className="w-3 h-3"
                            fallback="Tag"
                          />
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Markdown Description */}
                <div className="flex-1 flex flex-col min-h-[260px] max-h-[55vh] overflow-y-auto pr-1 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold block">
                    {modalType === 'event'
                      ? 'Event Description / Agenda'
                      : 'Content & Markdown Notes'}
                  </span>
                  <div className="flex-1 flex flex-col min-h-[220px]">
                    <MarkdownPreview
                      text={modalContent}
                      value={modalContent}
                      placeholder={
                        modalType === 'event'
                          ? 'Write event description, agenda, location, or notes...'
                          : 'Write structured thoughts, reflections, details, checklists, or markdown...'
                      }
                      editable={true}
                      onChange={setModalContent}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-stone-850/80 flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-stone-600 font-mono hidden sm:inline">
                    Ctrl+Enter or Esc to save/cancel
                  </span>
                  <div className="flex items-center gap-2.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setIsDetailModalOpen(false)}
                      className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-stone-300 text-xs font-mono uppercase tracking-wider rounded-xl border border-stone-800 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!modalTitle.trim()}
                      className={`px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-xl border transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                        modalType === 'event'
                          ? 'bg-amber-500 hover:bg-amber-400 text-[#0e0c08] border-amber-400'
                          : 'bg-blue-500 hover:bg-blue-400 text-[#070a0e] border-blue-400'
                      }`}
                    >
                      <span>{modalType === 'event' ? 'Save Event' : 'Save Note'}</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
