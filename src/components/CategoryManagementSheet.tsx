/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';
import { Category, CategoryScope } from '../types';
import { Plus, X, Trash2, Check, Palette } from 'lucide-react';

const CATEGORY_COLORS = [
  'emerald',
  'sky',
  'violet',
  'rose',
  'amber',
  'indigo',
  'teal',
  'orange',
] as const;

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-500',
  orange: 'bg-orange-500',
};

const borderMap: Record<string, string> = {
  emerald: 'border-emerald-500',
  sky: 'border-sky-500',
  violet: 'border-violet-500',
  rose: 'border-rose-500',
  amber: 'border-amber-500',
  indigo: 'border-indigo-500',
  teal: 'border-teal-500',
  orange: 'border-orange-500',
};

interface CategoryManagementSheetProps {
  open: boolean;
  onClose: () => void;
  scope: CategoryScope;
}

export default function CategoryManagementSheet({
  open,
  onClose,
  scope,
}: CategoryManagementSheetProps) {
  const categories = useLiveQuery(() => db.categories.where('scope').equals(scope).toArray()) || [];

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<(typeof CATEGORY_COLORS)[number]>('emerald');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<(typeof CATEGORY_COLORS)[number]>('emerald');
  const inputRef = useRef<HTMLInputElement>(null);

  const isMobile = window.innerWidth < 768;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const exists = categories.some(
      (c) => c.name.toLowerCase() === newName.trim().toLowerCase() && c.scope === scope,
    );
    if (exists) return;
    const cat: Category = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      color: newColor,
      scope,
      created_at: new Date(),
    };
    await db.categories.add(cat);
    setNewName('');
    setNewColor('emerald');
    inputRef.current?.focus();
  };

  const handleUpdate = async (cat: Category) => {
    await db.categories.update(cat.id, {
      name: editName.trim() || cat.name,
      color: editColor,
    });
    setEditingId(null);
  };

  const handleDelete = async (cat: Category) => {
    // unlink all entries tagged with this category
    const allEntries = await db.entries.toArray();
    for (const e of allEntries) {
      const ids = (e as any).category_ids;
      if (Array.isArray(ids) && ids.includes(cat.id)) {
        await db.entries.update(e.id, {
          category_ids: ids.filter((id: string) => id !== cat.id),
        } as any);
      }
    }
    await db.categories.delete(cat.id);
    if (editingId === cat.id) setEditingId(null);
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-850 p-4">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-stone-300 bg-stone-800/40 border-stone-700 flex items-center gap-1.5">
          <Palette className="w-3 h-3" />
          {scope === 'goal' ? 'Goal' : 'Objective'} Categories
        </span>
        <button
          onClick={onClose}
          className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Create row */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="New category name..."
            className="flex-1 bg-[#0a0a0a] text-stone-100 border border-stone-800 rounded-lg px-3 py-2 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-500 transition-colors"
          />
          {/* Colour picker */}
          <div className="flex items-center gap-0.5">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full ${colorMap[c]} transition-all cursor-pointer ${
                  newColor === c ? 'ring-2 ring-white/60 scale-110' : 'opacity-50 hover:opacity-80'
                }`}
                title={c}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            className="p-2 bg-stone-700/40 border border-stone-600 text-stone-300 hover:bg-stone-600/40 rounded-lg transition-all cursor-pointer disabled:opacity-30"
            disabled={!newName.trim()}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
        {categories.length === 0 && (
          <div className="py-12 text-center text-stone-600">
            <Palette className="w-8 h-8 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No categories yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Categories help you tag and filter goals and objectives by domain.
            </p>
          </div>
        )}

        {categories.map((cat) => {
          const isEditing = editingId === cat.id;
          return (
            <div
              key={cat.id}
              className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] border border-stone-800/80 rounded-xl group"
            >
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(cat);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 bg-transparent text-sm text-stone-200 border-b border-stone-700 focus:outline-none focus:border-stone-500 px-1 py-0.5"
                    autoFocus
                  />
                  <div className="flex items-center gap-0.5">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-4 h-4 rounded-full ${colorMap[c]} transition-all cursor-pointer ${
                          editColor === c
                            ? 'ring-2 ring-white/60 scale-110'
                            : 'opacity-50 hover:opacity-80'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => handleUpdate(cat)}
                    className="p-1 rounded text-emerald-400 hover:bg-emerald-950/20 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorMap[cat.color] ?? 'bg-stone-500'}`}
                  />
                  <span className="flex-1 text-sm font-serif text-stone-200 truncate">
                    {cat.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color);
                    }}
                    className="md:opacity-0 md:group-hover:opacity-100 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide text-stone-500 hover:text-stone-300 hover:bg-stone-800/40 transition-all cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="md:opacity-0 md:group-hover:opacity-100 p-1 rounded text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1000]"
          />

          {isMobile ? (
            /* MOBILE BOTTOM SHEET */
            <div className="fixed inset-0 z-[1000] flex items-end justify-center font-sans pointer-events-none">
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="relative w-full min-h-[50vh] max-h-[80vh] bg-[#121212] border-t border-stone-850 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pointer-events-auto"
              >
                <div className="flex-none flex justify-center pt-3 pb-0">
                  <div className="w-12 h-1 bg-stone-800 rounded-full" />
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
              </motion.div>
            </div>
          ) : (
            /* DESKTOP MODAL */
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 font-sans pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#121212] border border-stone-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[80vh] pointer-events-auto"
              >
                <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
