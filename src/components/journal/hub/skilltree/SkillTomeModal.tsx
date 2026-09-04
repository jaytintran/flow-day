import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import {
  X,
  Zap,
  Clock,
  Check,
  Plus,
  Sparkles,
  BookOpen,
  Trash2,
  Edit2,
  ChevronDown,
  Smile,
} from 'lucide-react';
import { SkillNodeItem, ELEMENTAL_THEMES } from './types';
import { extractSkillNotes } from './utils';
import MarkdownPreview from '../../../MarkdownPreview';

interface SkillTomeModalProps {
  skill: SkillNodeItem | null;
  availableSp: number;
  onClose: () => void;
  onAllocateSp: (skill: SkillNodeItem) => void;
  onToggleDrill: (skill: SkillNodeItem, drillIndex: number) => void;
  onAddDrill: (skill: SkillNodeItem, drillTitle: string) => void;
  onEditDrill: (skill: SkillNodeItem, drillIndex: number, newTitle: string) => void;
  onDeleteDrill: (skill: SkillNodeItem, drillIndex: number) => void;
  onDeleteSkill: (skill: SkillNodeItem) => void;
  onUpdateTitle: (skill: SkillNodeItem, title: string) => void;
  onUpdateNotes: (skill: SkillNodeItem, notes: string) => void;
  onUpdateColor: (skill: SkillNodeItem, color: string) => void;
  onChangeIcon: (skill: SkillNodeItem) => void;
}

export function SkillTomeModal({
  skill,
  availableSp,
  onClose,
  onAllocateSp,
  onToggleDrill,
  onAddDrill,
  onEditDrill,
  onDeleteDrill,
  onDeleteSkill,
  onUpdateTitle,
  onUpdateNotes,
  onUpdateColor,
  onChangeIcon,
}: SkillTomeModalProps) {
  // Inline Title Editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(skill?.title || '');

  // Inline Drill Editing
  const [editingDrillIdx, setEditingDrillIdx] = useState<number | null>(null);
  const [draftDrillText, setDraftDrillText] = useState('');
  const [newDrillText, setNewDrillText] = useState('');

  // Color Selector Popover
  const [isColorSelectorOpen, setIsColorSelectorOpen] = useState(false);

  // Notes Editing & Markdown
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');

  const colorSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skill) {
      setDraftTitle(skill.title);
      setDraftNotes(extractSkillNotes(skill.content));
      setIsEditingTitle(false);
      setEditingDrillIdx(null);
      setIsEditingNotes(false);
    }
  }, [skill?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isColorSelectorOpen && !isEditingTitle && !isEditingNotes && editingDrillIdx === null) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isColorSelectorOpen, isEditingTitle, isEditingNotes, editingDrillIdx]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorSelectorRef.current &&
        !colorSelectorRef.current.contains(e.target as Node)
      ) {
        setIsColorSelectorOpen(false);
      }
    };
    if (isColorSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isColorSelectorOpen]);

  if (!skill) return null;

  const IconComponent = (Icons as any)[skill.icon || 'Sparkles'] || Icons.Sparkles;
  const isMastered = skill.rank >= skill.maxRank || skill.status === 'mastered';
  const hoursSpent = Math.round((skill.time_spent / 3600000) * 10) / 10;
  const activeColor = skill.color || (isMastered ? 'amber' : 'sky');
  const activeTheme = ELEMENTAL_THEMES.find((t) => t.id === activeColor) || ELEMENTAL_THEMES[0];
  const pureNotes = extractSkillNotes(skill.content);

  const handleSaveTitle = () => {
    if (draftTitle.trim() && draftTitle.trim() !== skill.title) {
      onUpdateTitle(skill, draftTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleAddDrillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrillText.trim()) return;
    onAddDrill(skill, newDrillText.trim());
    setNewDrillText('');
  };

  const handleSaveDrillEdit = (idx: number) => {
    if (draftDrillText.trim()) {
      onEditDrill(skill, idx, draftDrillText.trim());
    }
    setEditingDrillIdx(null);
  };

  const handleSaveNotes = () => {
    onUpdateNotes(skill, draftNotes);
    setIsEditingNotes(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] bg-[#111114] border border-stone-800 rounded-2xl shadow-2xl flex flex-col font-mono animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-800 flex items-start justify-between bg-[#141418]">
          <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
            {/* Clickable Header Icon */}
            <button
              type="button"
              onClick={() => onChangeIcon(skill)}
              title="Click to change icon"
              className="group relative w-12 h-12 rounded-2xl border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer hover:border-white bg-[#1a1a20]"
              style={{
                borderColor: isMastered ? '#f59e0b' : activeTheme.glow,
              }}
            >
              <IconComponent
                className="w-6 h-6 transition-transform group-hover:scale-110"
                style={{ color: isMastered ? '#fbbf24' : activeTheme.glow }}
              />
              <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Smile className="w-4 h-4 text-white" />
              </div>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">
                  Tier {skill.tier}
                </span>
                <span className="text-stone-600">•</span>
                <span className="text-[10px] uppercase text-stone-400">
                  Rank {skill.rank}/{skill.maxRank}
                </span>
              </div>

              {/* Inline Editable Title */}
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') {
                        setDraftTitle(skill.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    className="w-full bg-[#18181c] border border-amber-500/50 rounded-lg px-2 py-0.5 text-sm font-bold text-stone-100 focus:outline-none"
                  />
                </div>
              ) : (
                <div
                  onClick={() => {
                    setDraftTitle(skill.title);
                    setIsEditingTitle(true);
                  }}
                  className="group flex items-center gap-2 cursor-pointer mt-0.5"
                  title="Click to rename skill"
                >
                  <h2 className="text-base font-bold text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                    {skill.title}
                  </h2>
                  <Edit2 className="w-3.5 h-3.5 text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Compact Theme Palette Selector */}
          <div className="relative" ref={colorSelectorRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold tracking-wider uppercase text-stone-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Elemental Color Theme
              </label>
            </div>

            <button
              type="button"
              onClick={() => setIsColorSelectorOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-2.5 bg-[#16161b] border border-stone-800 hover:border-stone-700 rounded-xl transition-all cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: activeTheme.glow }}
                />
                <span className="font-bold text-stone-200">{activeTheme.name}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-stone-400 transition-transform ${
                  isColorSelectorOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isColorSelectorOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-[#16161b] border border-stone-700 rounded-2xl shadow-2xl z-50 grid grid-cols-6 gap-2 animate-in fade-in zoom-in-95 duration-100">
                {ELEMENTAL_THEMES.map((theme) => {
                  const isCurrent = activeColor === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        onUpdateColor(skill, theme.id);
                        setIsColorSelectorOpen(false);
                      }}
                      className={`h-8 rounded-lg ${theme.bgClass} flex items-center justify-center transition-all cursor-pointer relative group ${
                        isCurrent
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16161b] scale-105'
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                      }`}
                      title={theme.name}
                    >
                      {isCurrent && <Check className="w-3.5 h-3.5 text-stone-950 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Level & SP Action Card */}
          <div className="bg-[#16161b] border border-stone-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-400">Mastery Progress</span>
              <span className="text-amber-400 font-bold">
                {isMastered ? '★ MAX LEVEL (Mastered)' : `Rank ${skill.rank} / ${skill.maxRank}`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
              <div
                className={`h-full transition-all duration-300 ${
                  isMastered ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${(skill.rank / skill.maxRank) * 100}%` }}
              />
            </div>

            {/* Spend SP Button */}
            {!isMastered && (
              <button
                onClick={() => onAllocateSp(skill)}
                disabled={availableSp <= 0}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  availableSp > 0
                    ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm active:scale-98'
                    : 'bg-stone-800/60 text-stone-500 cursor-not-allowed border border-stone-800'
                }`}
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Level Up (Cost: 1 SP)</span>
              </button>
            )}

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {hoursSpent} hrs practiced
              </span>
              <span className="text-amber-400/80 font-bold">{availableSp} SP available</span>
            </div>
          </div>

          {/* Drills & Practice Kata Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider uppercase text-stone-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Drills & Practice Kata ({skill.drills.filter((d) => d.completed).length}/
                {skill.drills.length})
              </h3>
            </div>

            {/* Scrollable drill items list */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {skill.drills.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-stone-800 text-center text-xs text-stone-500">
                  No practice drills forged yet. Add checkpoints below!
                </div>
              ) : (
                skill.drills.map((drill, idx) => (
                  <div
                    key={drill.id || idx}
                    className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                      drill.completed
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-[#16161b] border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => onToggleDrill(skill, idx)}
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        drill.completed
                          ? 'bg-emerald-500 border-emerald-400 text-stone-950'
                          : 'border-stone-700 bg-transparent hover:border-stone-500'
                      }`}
                    >
                      {drill.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    {/* Inline Editable Drill Title */}
                    {editingDrillIdx === idx ? (
                      <input
                        type="text"
                        autoFocus
                        value={draftDrillText}
                        onChange={(e) => setDraftDrillText(e.target.value)}
                        onBlur={() => handleSaveDrillEdit(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDrillEdit(idx);
                          if (e.key === 'Escape') setEditingDrillIdx(null);
                        }}
                        className="flex-1 bg-[#18181c] border border-amber-500/50 rounded px-2 py-0.5 text-xs text-stone-100 focus:outline-none"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingDrillIdx(idx);
                          setDraftDrillText(drill.title);
                        }}
                        title="Click to edit drill title"
                        className={`text-xs flex-1 cursor-text truncate ${
                          drill.completed ? 'line-through opacity-70' : ''
                        }`}
                      >
                        {drill.title}
                      </span>
                    )}

                    {/* Delete Drill Button */}
                    <button
                      type="button"
                      onClick={() => onDeleteDrill(skill, idx)}
                      title="Delete drill"
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-500 hover:text-rose-400 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Drill Form */}
            <form onSubmit={handleAddDrillSubmit} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="+ Add practice drill or checkpoint..."
                value={newDrillText}
                onChange={(e) => setNewDrillText(e.target.value)}
                className="flex-1 bg-[#16161b] border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Add
              </button>
            </form>
          </div>

          {/* Study Notes & Grimoire Lore (with Markdown Preview) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider uppercase text-stone-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                Skill Notes & Strategy
              </h3>
              <button
                onClick={() => {
                  if (isEditingNotes) {
                    handleSaveNotes();
                  } else {
                    setDraftNotes(pureNotes);
                    setIsEditingNotes(true);
                  }
                }}
                className="text-[11px] text-amber-400 hover:underline cursor-pointer font-bold"
              >
                {isEditingNotes ? 'Save Notes' : 'Edit'}
              </button>
            </div>

            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  autoFocus
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Describe what this skill is, why to train it, core principles, and learning roadmap..."
                  className="w-full bg-[#16161b] border border-stone-800 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50 font-sans"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingNotes(false)}
                    className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  setDraftNotes(pureNotes);
                  setIsEditingNotes(true);
                }}
                title="Click to edit notes"
                className="bg-[#16161b] border border-stone-800/80 hover:border-stone-700 rounded-xl p-3 text-xs min-h-[70px] cursor-pointer transition-colors"
              >
                {pureNotes ? (
                  <div className="prose prose-invert prose-xs max-w-none">
                    <MarkdownPreview text={pureNotes} />
                  </div>
                ) : (
                  <span className="text-stone-600 italic">
                    No strategy description yet. Click to write what this skill is, why train it, and key insights...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-800 flex items-center justify-between bg-[#141418]">
          <button
            onClick={() => {
              if (confirm(`Remove skill "${skill.title}"?`)) {
                onDeleteSkill(skill);
              }
            }}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 p-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Skill</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
