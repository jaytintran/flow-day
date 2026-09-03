import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import {
  X,
  Zap,
  Clock,
  Check,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Trash2,
} from 'lucide-react';
import { SkillNodeItem, ELEMENTAL_THEMES } from './types';

interface SkillTomeDrawerProps {
  skill: SkillNodeItem | null;
  availableSp: number;
  onClose: () => void;
  onAllocateSp: (skill: SkillNodeItem) => void;
  onToggleDrill: (skill: SkillNodeItem, drillIndex: number) => void;
  onAddDrill: (skill: SkillNodeItem, drillTitle: string) => void;
  onDeleteSkill: (skill: SkillNodeItem) => void;
  onUpdateNotes: (skill: SkillNodeItem, notes: string) => void;
  onUpdateColor: (skill: SkillNodeItem, color: string) => void;
}

export function SkillTomeDrawer({
  skill,
  availableSp,
  onClose,
  onAllocateSp,
  onToggleDrill,
  onAddDrill,
  onDeleteSkill,
  onUpdateNotes,
  onUpdateColor,
}: SkillTomeDrawerProps) {
  const [newDrillText, setNewDrillText] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState(skill?.content || '');

  if (!skill) return null;

  const IconComponent = (Icons as any)[skill.icon || 'Sparkles'] || Icons.Sparkles;
  const isMastered = skill.rank >= skill.maxRank || skill.status === 'mastered';
  const hoursSpent = Math.round((skill.time_spent / 3600000) * 10) / 10;
  const activeColor = skill.color || (isMastered ? 'amber' : 'sky');

  const handleAddDrillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrillText.trim()) return;
    onAddDrill(skill, newDrillText.trim());
    setNewDrillText('');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#0c0c0e]/95 backdrop-blur-2xl border-l border-stone-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-250">
      {/* Drawer Header: Runic Crest */}
      <div className="p-5 border-b border-stone-800 flex items-start justify-between bg-gradient-to-b from-stone-900/60 to-transparent">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-all ${
              activeColor === 'amber'
                ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : activeColor === 'sky'
                  ? 'border-sky-400 bg-sky-500/15 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                  : activeColor === 'emerald'
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : activeColor === 'violet'
                      ? 'border-violet-400 bg-violet-500/15 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                      : activeColor === 'rose'
                        ? 'border-rose-400 bg-rose-500/15 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                        : 'border-indigo-400 bg-indigo-500/15 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
            }`}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-400">
                Tier {skill.tier}
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-[10px] font-mono uppercase text-stone-400">
                Rank {skill.rank}/{skill.maxRank}
              </span>
            </div>
            <h2 className="text-base font-mono font-bold text-stone-100">{skill.title}</h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Elemental Theme Picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-bold tracking-wider uppercase text-stone-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Elemental Theme ({ELEMENTAL_THEMES.find((t) => t.id === activeColor)?.name || 'Custom'})
            </label>
          </div>
          <div className="grid grid-cols-6 gap-2 p-2.5 bg-[#121215] border border-stone-800 rounded-xl">
            {ELEMENTAL_THEMES.map((theme) => {
              const isCurrent = activeColor === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateColor(skill, theme.id)}
                  className={`w-full h-7 rounded-lg ${theme.bgClass} flex items-center justify-center transition-all cursor-pointer relative group ${
                    isCurrent
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121215] scale-110 shadow-lg z-10'
                      : 'opacity-50 hover:opacity-100 hover:scale-105'
                  }`}
                  title={theme.name}
                >
                  {isCurrent && <Check className="w-3.5 h-3.5 text-stone-950 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>
        {/* Level & SP Action Card */}
        <div className="bg-[#121215] border border-stone-800/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-stone-400">Mastery Progress</span>
            <span className="text-amber-400 font-bold">
              {isMastered ? 'MAX LEVEL' : `${skill.rank} / ${skill.maxRank}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
            <div
              className={`h-full transition-all duration-500 ${
                isMastered ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-sky-400'
              }`}
              style={{ width: `${(skill.rank / skill.maxRank) * 100}%` }}
            />
          </div>

          {/* Spend SP Button */}
          {!isMastered && (
            <button
              onClick={() => onAllocateSp(skill)}
              disabled={availableSp <= 0}
              className={`w-full py-2.5 px-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                availableSp > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-98'
                  : 'bg-stone-800/60 text-stone-500 cursor-not-allowed border border-stone-800'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Level Up (Cost: 1 SP)</span>
            </button>
          )}

          <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {hoursSpent} hrs practiced
            </span>
            <span>{availableSp} SP available</span>
          </div>
        </div>

        {/* Drills & Kata Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-stone-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Drills & Practice Kata ({skill.drills.filter((d) => d.completed).length}/
              {skill.drills.length})
            </h3>
          </div>

          {/* Drill items */}
          <div className="space-y-1.5">
            {skill.drills.map((drill, idx) => (
              <div
                key={drill.id}
                onClick={() => onToggleDrill(skill, idx)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  drill.completed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-[#121215] border-stone-800/80 text-stone-300 hover:border-stone-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    drill.completed
                      ? 'bg-emerald-500 border-emerald-400 text-stone-950'
                      : 'border-stone-700 bg-transparent'
                  }`}
                >
                  {drill.completed && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className={`text-xs font-mono flex-1 ${drill.completed ? 'line-through opacity-80' : ''}`}>
                  {drill.title}
                </span>
              </div>
            ))}
          </div>

          {/* Add Drill Form */}
          <form onSubmit={handleAddDrillSubmit} className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="+ Add drill or checkpoint..."
              value={newDrillText}
              onChange={(e) => setNewDrillText(e.target.value)}
              className="flex-1 bg-[#121215] border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-stone-850 hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              Add
            </button>
          </form>
        </div>

        {/* Study Notes & Grimoire Lore */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-stone-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              Skill Notes & Strategy
            </h3>
            <button
              onClick={() => {
                if (isEditingNotes) {
                  onUpdateNotes(skill, draftNotes);
                }
                setIsEditingNotes(!isEditingNotes);
              }}
              className="text-[11px] font-mono text-amber-400 hover:underline cursor-pointer"
            >
              {isEditingNotes ? 'Save Notes' : 'Edit'}
            </button>
          </div>

          {isEditingNotes ? (
            <textarea
              rows={4}
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="Record drill instructions, key insights, or markdown references..."
              className="w-full bg-[#121215] border border-stone-800 rounded-xl p-3 text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-500/50"
            />
          ) : (
            <div className="bg-[#121215] border border-stone-800/80 rounded-xl p-3 text-xs font-mono text-stone-400 min-h-[60px] whitespace-pre-wrap">
              {skill.content ? skill.content : <span className="text-stone-600 italic">No notes recorded yet.</span>}
            </div>
          )}
        </div>
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-stone-800/80 flex items-center justify-between bg-[#101012]">
        <button
          onClick={() => {
            if (confirm(`Remove skill "${skill.title}"?`)) {
              onDeleteSkill(skill);
            }
          }}
          className="flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300 p-2 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Skill</span>
        </button>

        <button
          onClick={onClose}
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
