/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Check, Tag } from 'lucide-react';
import { db } from '../../db';
import { Category, Event, Note } from '../../types';

interface RecordCategoryPickerModalProps {
  record: Event | Note;
  categories: Category[];
  onClose: () => void;
}

const COLORS: Record<string, { dot: string; active: string }> = {
  violet: {
    dot: 'bg-violet-500',
    active: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
  },
  sky: { dot: 'bg-sky-500', active: 'text-sky-300 border-sky-500/40 bg-sky-500/10' },
  emerald: {
    dot: 'bg-emerald-500',
    active: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  },
  amber: { dot: 'bg-amber-500', active: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  rose: { dot: 'bg-rose-500', active: 'text-rose-300 border-rose-500/40 bg-rose-500/10' },
  indigo: {
    dot: 'bg-indigo-500',
    active: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10',
  },
  teal: { dot: 'bg-teal-500', active: 'text-teal-300 border-teal-500/40 bg-teal-500/10' },
  orange: {
    dot: 'bg-orange-500',
    active: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
  },
};

export default function RecordCategoryPickerModal({
  record,
  categories,
  onClose,
}: RecordCategoryPickerModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(record.category_ids ?? []);

  useEffect(() => {
    setSelectedIds(record.category_ids ?? []);
  }, [record.category_ids]);

  const handleToggle = async (catId: string) => {
    const next = selectedIds.includes(catId)
      ? selectedIds.filter((id) => id !== catId)
      : [...selectedIds, catId];
    setSelectedIds(next);
    await db.entries.update(record.id, { category_ids: next } as any);
  };

  const title = record.type === 'note' ? (record as Note).title || 'Untitled Note' : (record as Event).title || 'Untitled Event';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 font-sans"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs bg-[#131313] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-stone-800/60">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
                Assign Category
              </p>
              <p className="text-xs font-serif font-semibold text-stone-200 line-clamp-1 mt-0.5">
                {title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {categories.length === 0 ? (
              <div className="text-center py-6">
                <Tag className="w-6 h-6 text-stone-700 mx-auto mb-2" />
                <p className="text-xs font-mono text-stone-500">
                  No categories yet.
                </p>
                <p className="text-[10px] font-sans text-stone-600 mt-1">
                  Create categories from the categories manager.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {categories.map((cat) => {
                  const cs = COLORS[cat.color] ?? COLORS['indigo'];
                  const isAssigned = selectedIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleToggle(cat.id)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        isAssigned
                          ? cs.active
                          : 'border-transparent text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cs.dot}`} />
                      <span className="truncate flex-1 text-left">{cat.name}</span>
                      {isAssigned && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
