/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Plus, Trash2, GripVertical, Tag } from 'lucide-react';
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
import CategoryIcon, { CATEGORY_COLORS } from '../CategoryIcon';
import InlineIconColorPopover from '../InlineIconColorPopover';

// ─── Sortable Category Row ───────────────────────────────────────────────────

interface SortableCategoryRowProps {
  category: Category;
  deletingId: string | null;
  onDelete: (cat: Category) => void;
  onRename: (cat: Category, newName: string) => void;
  onUpdateIcon: (cat: Category, icon: string) => void;
  onUpdateColor: (cat: Category, color: Category['color']) => void;
}

function SortableCategoryRow({
  category,
  deletingId,
  onDelete,
  onRename,
  onUpdateIcon,
  onUpdateColor,
}: SortableCategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [editingName, setEditingName] = useState(category.name);
  const [isEditing, setIsEditing] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const startEdit = () => {
    setEditingName(category.name);
    setIsEditing(true);
  };

  const commitEdit = () => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(category, trimmed);
    } else {
      setEditingName(category.name);
    }
    setIsEditing(false);
  };

  const isDeleting = deletingId === category.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-center gap-3 px-3.5 py-2.5 bg-[#0a0a0a] hover:bg-[#121212] border border-stone-800/80 hover:border-stone-700/80 rounded-xl transition-all duration-150 group shadow-sm"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-stone-700 hover:text-stone-400 cursor-grab active:cursor-grabbing touch-none transition-colors shrink-0 rounded"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Icon button (Clicking opens inline icon + color dropdown) */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className="p-1.5 rounded-lg bg-stone-900/80 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 transition-all cursor-pointer flex items-center justify-center shadow-sm"
          title="Change icon & color"
        >
          <CategoryIcon name={category.icon} color={category.color} className="w-4 h-4" fallback="Tag" />
        </button>

        <InlineIconColorPopover
          isOpen={isPopoverOpen}
          onClose={() => setIsPopoverOpen(false)}
          currentIcon={category.icon}
          currentColor={category.color}
          fallbackIcon="Tag"
          onSelectIcon={(icon) => onUpdateIcon(category, icon)}
          onSelectColor={(color) => onUpdateColor(category, color)}
        />
      </div>

      {/* Name / direct click inline edit */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            autoFocus
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') {
                setEditingName(category.name);
                setIsEditing(false);
              }
            }}
            onBlur={commitEdit}
            className="w-full bg-[#161616] text-sm font-serif text-stone-100 border border-stone-600 rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500/80 transition-colors shadow-inner"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit category name"
            className="text-sm font-serif text-stone-200 hover:text-white transition-colors text-left w-full truncate cursor-text py-1 px-1 rounded hover:bg-stone-900/60"
          >
            {category.name}
          </button>
        )}
      </div>

      {/* Delete */}
      {isDeleting ? (
        <button
          onClick={() => onDelete(category)}
          className="px-2.5 py-1 text-[10px] bg-red-950/90 border border-red-800 rounded-lg text-red-300 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer shrink-0"
        >
          Sure?
        </button>
      ) : (
        <button
          onClick={() => onDelete(category)}
          className="p-1.5 rounded-lg text-stone-700 hover:text-red-400 hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
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
  const [newIcon, setNewIcon] = useState<string>('Tag');
  const [isCreationPopoverOpen, setIsCreationPopoverOpen] = useState(false);

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
    await createRecordCategory(name, newColor, newIcon);
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

  const handleUpdateIcon = async (cat: Category, icon: string) => {
    await db.categories.update(cat.id, { icon });
  };

  const handleUpdateColor = async (cat: Category, color: Category['color']) => {
    await db.categories.update(cat.id, { color });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[#131313] border border-stone-800 rounded-2xl shadow-2xl w-[540px] max-w-[94vw] h-[640px] max-h-[88vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-850 bg-[#111111] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-serif font-bold text-stone-100">
                    Manage Categories
                  </h2>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-400 border border-stone-700/60">
                    {categories.length} {categories.length === 1 ? 'category' : 'categories'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-stone-500 mt-0.5">
                  Click title to rename · Click icon to customize
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-200 hover:bg-stone-800/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List Content */}
          <div
            className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a2a transparent' }}
          >
            {categories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-600 py-16">
                <div className="w-12 h-12 rounded-2xl bg-stone-900/60 border border-stone-850 flex items-center justify-center mb-3 text-stone-600">
                  <Tag className="w-6 h-6" />
                </div>
                <p className="text-sm font-sans font-medium text-stone-400">No categories yet</p>
                <p className="text-xs font-sans text-stone-600 mt-1 text-center max-w-xs">
                  Create custom categories below to organize your notes and events.
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
                      onUpdateIcon={handleUpdateIcon}
                      onUpdateColor={handleUpdateColor}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Create new category Footer */}
          <div className="shrink-0 px-6 pt-3.5 pb-4 border-t border-stone-850 bg-[#0f0f0f] space-y-3">
            {/* Options Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex items-center gap-2">
                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest shrink-0">
                  Icon:
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreationPopoverOpen(!isCreationPopoverOpen)}
                  className="p-1.5 bg-[#0a0a0a] hover:bg-stone-850 border border-stone-800 hover:border-stone-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Choose Icon & Color"
                >
                  <CategoryIcon
                    name={newIcon}
                    color={newColor}
                    className="w-4 h-4"
                    fallback="Tag"
                  />
                  <span className="text-[10px] font-mono text-stone-400 pr-0.5">Edit</span>
                </button>

                <InlineIconColorPopover
                  isOpen={isCreationPopoverOpen}
                  onClose={() => setIsCreationPopoverOpen(false)}
                  currentIcon={newIcon}
                  currentColor={newColor}
                  fallbackIcon="Tag"
                  onSelectIcon={(icon) => setNewIcon(icon)}
                  onSelectColor={(color) => setNewColor(color)}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest shrink-0">
                  Color:
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setNewColor(c.key)}
                      className={`w-4 h-4 rounded-full ${c.dot} transition-all cursor-pointer ${
                        newColor === c.key
                          ? `ring-2 ring-offset-2 ring-offset-[#0f0f0f] ${c.ring} scale-110`
                          : 'opacity-40 hover:opacity-80'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Input Row */}
            <div className="flex items-stretch gap-2.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                placeholder="New category name..."
                className="flex-1 bg-[#0a0a0a] border border-stone-800 focus:border-stone-600 rounded-xl px-3.5 py-2.5 text-sm font-serif text-stone-100 placeholder-stone-600 focus:outline-none transition-colors shadow-inner"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-5 py-2.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:text-violet-300 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 shadow-sm active:scale-98"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
