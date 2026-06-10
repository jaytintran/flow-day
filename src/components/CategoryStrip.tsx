/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Category } from '../types';
import { Settings2 } from 'lucide-react';

const colorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  sky: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/25',
    text: 'text-sky-400',
    dot: 'bg-sky-400',
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/25',
    text: 'text-violet-400',
    dot: 'bg-violet-400',
  },
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    text: 'text-indigo-400',
    dot: 'bg-indigo-400',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/25',
    text: 'text-teal-400',
    dot: 'bg-teal-400',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/25',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
  },
};

interface CategoryStripProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
  onManage: () => void;
}

export default function CategoryStrip({
  categories,
  selectedCategoryId,
  onSelect,
  onManage,
}: CategoryStripProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-stone-800/60 bg-[#121212] w-full overflow-hidden">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* "All" pill */}
        <button
          onClick={() => onSelect(null)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wide transition-all active:scale-95 cursor-pointer shrink-0 ${
            selectedCategoryId === null
              ? 'bg-stone-700/40 border-stone-600 text-stone-200'
              : 'border-stone-700 text-stone-500 hover:border-stone-500 hover:text-stone-400'
          }`}
        >
          All
        </button>

        {categories.map((cat) => {
          const c = colorMap[cat.color] ?? colorMap.emerald;
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(isSelected ? null : cat.id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wide transition-all active:scale-95 cursor-pointer shrink-0 ${
                isSelected
                  ? `${c.bg} ${c.border} ${c.text}`
                  : 'border-stone-700 text-stone-500 hover:border-stone-500 hover:text-stone-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Manage button – always visible */}
      <button
        onClick={onManage}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500 text-[10px] font-mono font-semibold uppercase tracking-wide transition-all active:scale-95 cursor-pointer shrink-0 ml-1"
        title="Manage categories"
      >
        <Settings2 className="w-3 h-3" />
      </button>
    </div>
  );
}
