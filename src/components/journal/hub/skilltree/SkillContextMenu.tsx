import React, { useEffect, useRef } from 'react';
import {
  BookOpen,
  Zap,
  Smile,
  Plus,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { SkillNodeItem } from './types';

interface SkillContextMenuProps {
  x: number;
  y: number;
  skill: SkillNodeItem;
  availableSp: number;
  onClose: () => void;
  onInspect: (skill: SkillNodeItem) => void;
  onQuickLevelUp: (skill: SkillNodeItem) => void;
  onChangeIcon: (skill: SkillNodeItem) => void;
  onCreateChild: (parentSkill: SkillNodeItem) => void;
  onToggleMastered: (skill: SkillNodeItem) => void;
  onDelete: (skill: SkillNodeItem) => void;
}

export function SkillContextMenu({
  x,
  y,
  skill,
  availableSp,
  onClose,
  onInspect,
  onQuickLevelUp,
  onChangeIcon,
  onCreateChild,
  onToggleMastered,
  onDelete,
}: SkillContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const isMastered = skill.rank >= skill.maxRank || skill.status === 'mastered';
  const canLevelUp = availableSp > 0 && !isMastered;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust menu position so it doesn't overflow screen bounds
  const adjustedX = Math.max(10, Math.min(window.innerWidth - 240, x));
  const adjustedY = Math.max(10, Math.min(window.innerHeight - 300, y));

  return (
    <div
      ref={menuRef}
      style={{ top: adjustedY, left: adjustedX }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-56 bg-[#111114] border border-stone-800 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100 select-none space-y-0.5 font-mono"
    >
      {/* Menu Header */}
      <div className="px-2.5 py-1.5 border-b border-stone-800/80 mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold text-stone-200 truncate max-w-[130px]">
          {skill.title}
        </span>
        <span className="text-[9px] uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
          Tier {skill.tier}
        </span>
      </div>

      {/* Primary Actions */}
      <button
        type="button"
        onClick={() => {
          onInspect(skill);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-stone-200 hover:bg-stone-800/80 hover:text-amber-400 text-left transition-colors cursor-pointer"
      >
        <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="font-medium">Open Grimoire Tome</span>
      </button>

      {/* Quick Level Up */}
      <button
        type="button"
        onClick={() => {
          if (canLevelUp) {
            onQuickLevelUp(skill);
            onClose();
          }
        }}
        disabled={!canLevelUp}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left transition-colors ${
          canLevelUp
            ? 'text-amber-300 hover:bg-amber-500/15 cursor-pointer font-bold'
            : 'text-stone-600 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Quick Level Up</span>
        </div>
        <span className="text-[10px] text-stone-500">
          {skill.rank}/{skill.maxRank}
        </span>
      </button>

      {/* Change Icon */}
      <button
        type="button"
        onClick={() => {
          onChangeIcon(skill);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-stone-200 hover:bg-stone-800/80 hover:text-stone-100 text-left transition-colors cursor-pointer"
      >
        <Smile className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-medium">Change Icon</span>
      </button>

      {/* Create Child Node */}
      <button
        type="button"
        onClick={() => {
          onCreateChild(skill);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-stone-200 hover:bg-stone-800/80 hover:text-emerald-300 text-left transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0 stroke-[2.5]" />
        <span className="font-medium">Create Child Skill</span>
      </button>

      {/* Toggle Mastered */}
      <button
        type="button"
        onClick={() => {
          onToggleMastered(skill);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-stone-300 hover:bg-stone-800/80 hover:text-stone-100 text-left transition-colors cursor-pointer"
      >
        <CheckCircle2
          className={`w-3.5 h-3.5 shrink-0 ${
            isMastered ? 'text-amber-400' : 'text-stone-500'
          }`}
        />
        <span>{isMastered ? 'Mark In-Progress' : 'Mark Mastered'}</span>
      </button>

      <div className="h-px bg-stone-800/80 my-1" />

      {/* Delete */}
      <button
        type="button"
        onClick={() => {
          onDelete(skill);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-left transition-colors cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5 shrink-0" />
        <span>Delete Skill</span>
      </button>
    </div>
  );
}
