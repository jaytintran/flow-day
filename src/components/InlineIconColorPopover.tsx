import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Category } from '../types';
import { CATEGORY_COLORS, getCategoryColor } from './CategoryIcon';
import { CURATED_ICONS } from './IconPickerModal';

interface InlineIconColorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  currentIcon?: string;
  currentColor?: Category['color'];
  onSelectIcon: (icon: string) => void;
  onSelectColor: (color: Category['color']) => void;
  fallbackIcon?: string;
}

export default function InlineIconColorPopover({
  isOpen,
  onClose,
  currentIcon,
  currentColor = 'violet',
  onSelectIcon,
  onSelectColor,
  fallbackIcon = 'ListTodo',
}: InlineIconColorPopoverProps) {
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeIcon = currentIcon || fallbackIcon;
  const colorDef = getCategoryColor(currentColor);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen, onClose]);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return CURATED_ICONS;
    const q = search.toLowerCase();
    return CURATED_ICONS.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [search]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-1.5 z-[200] w-72 bg-[#161616] border border-stone-800 rounded-2xl shadow-2xl p-3.5 flex flex-col gap-3 max-h-[340px] font-sans"
    >
      {/* Colors Row */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest">
            Color
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 justify-between py-0.5">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelectColor(c.key)}
              className={`w-4.5 h-4.5 rounded-full ${c.dot} transition-all cursor-pointer ${
                currentColor === c.key
                  ? `ring-2 ring-offset-2 ring-offset-[#161616] ${c.ring} scale-110`
                  : 'opacity-40 hover:opacity-85'
              }`}
              title={c.name}
            />
          ))}
        </div>
      </div>

      {/* Search Icons */}
      <div>
        <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest block mb-1.5">
          Icon
        </span>
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            autoFocus
            className="w-full pl-7 pr-2.5 py-1.5 bg-[#0a0a0a] border border-stone-800 rounded-xl text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
          />
        </div>
      </div>

      {/* Icon Grid */}
      <div
        className="overflow-y-auto flex-1 max-h-[160px] pr-0.5 custom-scrollbar"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a2a transparent' }}
      >
        {filteredIcons.length === 0 ? (
          <p className="text-center text-stone-600 text-xs py-4 font-mono">No icons found</p>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {filteredIcons.map((item) => {
              const IconComp =
                (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[item.name] ||
                LucideIcons.Tag;
              const isSelected = activeIcon === item.name;

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    onSelectIcon(item.name);
                    onClose();
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? `${colorDef.bg} border-amber-500/80 shadow-sm scale-105`
                      : 'bg-[#0a0a0a] border-stone-850 hover:border-stone-700 hover:bg-stone-900'
                  }`}
                  title={item.label}
                >
                  <IconComp
                    className={`w-4 h-4 ${
                      isSelected ? colorDef.text : 'text-stone-400 hover:text-stone-100'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
