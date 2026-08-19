/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Check, Tag } from 'lucide-react';
import { db } from '../../db';
import { Category, Event, Note } from '../../types';
import CategoryIcon, { getCategoryColor } from '../CategoryIcon';

interface RecordCategoryPickerModalProps {
  record: Event | Note;
  categories: Category[];
  onClose: () => void;
}

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

  const title =
    record.type === 'note'
      ? (record as Note).title || 'Untitled Note'
      : (record as Event).title || 'Untitled Event';

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
                <p className="text-xs font-mono text-stone-500">No categories yet.</p>
                <p className="text-[10px] font-sans text-stone-600 mt-1">
                  Create categories from the categories manager.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {categories.map((cat) => {
                  const colorDef = getCategoryColor(cat.color);
                  const isAssigned = selectedIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleToggle(cat.id)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        isAssigned
                          ? colorDef.pill
                          : 'border-transparent text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                      }`}
                    >
                      <CategoryIcon
                        name={cat.icon}
                        color={cat.color}
                        className="w-4 h-4"
                        fallback="Tag"
                      />
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
