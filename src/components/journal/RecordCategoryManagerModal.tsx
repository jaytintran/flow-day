/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Category } from '../../types';
import {
  createRecordCategory,
  migrateRecordsOnCategoryDelete,
  RECORD_CATEGORY_SCOPE,
} from '../../utils';

// ─── Color palette (identical to ListsView / TaskListManagerModal) ───────────

const COLORS: Array<{ key: Category['color']; dot: string; ring: string; pill: string }> = [
  {
    key: 'violet',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500',
    pill: 'bg-violet-500/15 border-violet-500/40 text-violet-400',
  },
  {
    key: 'sky',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500',
    pill: 'bg-sky-500/15 border-sky-500/40 text-sky-400',
  },
  {
    key: 'emerald',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    pill: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
  },
  {
    key: 'amber',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
    pill: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
  },
  {
    key: 'rose',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500',
    pill: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
  },
  {
    key: 'indigo',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-500',
    pill: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400',
  },
  {
    key: 'teal',
    dot: 'bg-teal-500',
    ring: 'ring-teal-500',
    pill: 'bg-teal-500/15 border-teal-500/40 text-teal-400',
  },
  {
    key: 'orange',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500',
    pill: 'bg-orange-500/15 border-orange-500/40 text-orange-400',
  },
];

function getColor(color: Category['color']) {
  return COLORS.find((c) => c.key === color) ?? COLORS[0];
}

// ─── Sortable Category Row ───────────────────────────────────────────────────

interface SortableCategoryRowProps {
  category: Category;
  deletingId: string | null;
  onDelete: (cat: Category) => void;
  onRename: (cat: Category, newName: string) => void;
}

function SortableCategoryRow({
  category,
  deletingId,
  onDelete,
  onRename,
}: SortableCategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [editingName, setEditingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const cs = getColor(category.color);

  const startEdit = () => {
    setEditingName(category.name);
    setIsEditing(true);
  };

  const commitEdit = () => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(category, trimmed);
    }
    setIsEditing(false);
  };

  const isDeleting = deletingId === category.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 px-3 py-2.5 bg-[#0a0a0a] border border-stone-800/80 rounded-xl group"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 text-stone-700 hover:text-stone-400 cursor-grab active:cursor-grabbing touch-none transition-colors shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Color dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${cs.dot}`} />

      {/* Name / inline edit */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            autoFocus
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            onBlur={commitEdit}
            className="w-full bg-transparent text-sm font-serif text-stone-100 border-b border-stone-600 focus:outline-none focus:border-stone-400 pb-0.5"
          />
        ) : (
          <button
            onDoubleClick={startEdit}
            title="Double-click to rename"
            className="text-sm font-serif text-stone-300 hover:text-stone-100 transition-colors text-left w-full truncate cursor-pointer"
          >
            {category.name}
          </button>
        )}
      </div>

      {/* Delete */}
      {isDeleting ? (
        <button
          onClick={() => onDelete(category)}
          className="px-2 py-1 text-[10px] bg-red-950/80 border border-red-800/80 rounded text-red-400 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer shrink-0"
        >
          Sure?
        </button>
      ) : (
        <button
          onClick={() => onDelete(category)}
          className="p-1.5 rounded text-stone-700 hover:text-red-400 hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
          title="Delete category"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface RecordCategoryManagerModalProps {
  onClose: () => void;
}

export default function RecordCategoryManagerModal({ onClose }: RecordCategoryManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<Category['color']>('violet');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [optimisticList, setOptimisticList] = useState<Category[] | null>(null);

  const rawCategories = (useLiveQuery(
    () => db.categories.where('scope').equals(RECORD_CATEGORY_SCOPE).toArray(),
    [],
  ) ?? []) as Category[];

  const categories: Category[] = (optimisticList ?? rawCategories).sort((a, b) => {
    const aO = (a as any).sort_order ?? Date.parse(a.created_at.toString());
    const bO = (b as any).sort_order ?? Date.parse(b.created_at.toString());
    return aO - bO;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = categories.map((l) => l.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(ids, oldIndex, newIndex);

      setOptimisticList(
        reordered.map((id, i) => {
          const l = categories.find((x) => x.id === id)!;
          return { ...l, sort_order: i } as any;
        }),
      );

      for (let i = 0; i < reordered.length; i++) {
        await db.categories.update(reordered[i], { sort_order: i } as any);
      }

      setTimeout(() => setOptimisticList(null), 2000);
    },
    [categories],
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createRecordCategory(name, newColor);
    setNewName('');
  };

  const handleDelete = async (cat: Category) => {
    if (deletingId !== cat.id) {
      setDeletingId(cat.id);
      return;
    }
    await migrateRecordsOnCategoryDelete(cat.id);
    await db.categories.delete(cat.id);
    setDeletingId(null);
  };

  const handleRename = async (cat: Category, nextName: string) => {
    await db.categories.update(cat.id, { name: nextName });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl w-[400px] max-w-[90vw] flex flex-col max-h-[75vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-900/60 shrink-0">
            <div>
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-1">
                Manage Categories
              </p>
              <p className="text-sm font-serif font-semibold text-stone-200">
                Note & Event Categories
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
            {categories.length === 0 ? (
              <div className="py-10 text-center text-stone-600">
                <p className="text-xs font-sans">No categories yet</p>
                <p className="text-[10px] font-sans text-stone-700 mt-1">
                  Create one below to start organizing your notes and events.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={categories.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categories.map((cat) => (
                    <SortableCategoryRow
                      key={cat.id}
                      category={cat}
                      deletingId={deletingId}
                      onDelete={handleDelete}
                      onRename={handleRename}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Create new category */}
          <div className="shrink-0 px-4 pb-4 pt-3 border-t border-stone-900/60 space-y-2.5">
            {/* Color picker */}
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest shrink-0">
                Color:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setNewColor(c.key)}
                    className={`w-3.5 h-3.5 rounded-full ${c.dot} transition-all cursor-pointer ${
                      newColor === c.key
                        ? `ring-2 ring-offset-2 ring-offset-[#141414] ${c.ring} scale-110`
                        : 'opacity-40 hover:opacity-75'
                    }`}
                    title={c.key}
                  />
                ))}
              </div>
            </div>

            {/* Input row */}
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                placeholder="New category name..."
                className="flex-1 bg-[#0a0a0a] border border-stone-850 rounded-xl px-3 py-2 text-sm font-serif text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:text-violet-300 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
