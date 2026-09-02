/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Target,
  CheckCircle2,
  Repeat2,
  Compass,
  Layers,
  Sparkles,
  Flame,
  Rocket,
  Star,
  Zap,
  BookOpen,
  Trophy,
  Brain,
  Cpu,
  Heart,
  Globe,
  Dumbbell,
  Briefcase,
  DollarSign,
  TrendingUp,
  Award,
  Sun,
  Shield,
  Palette,
  Crown,
  Anchor,
  Flag,
  Lightbulb,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { formatDuration } from '../../../utils';
import { EntityColor } from '../../../types';

export const LUCIDE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Compass,
  Layers,
  Target,
  CheckCircle2,
  Repeat2,
  Sparkles,
  Flame,
  Rocket,
  Star,
  Zap,
  BookOpen,
  Trophy,
  Brain,
  Cpu,
  Heart,
  Globe,
  Dumbbell,
  Briefcase,
  DollarSign,
  TrendingUp,
  Award,
  Sun,
  Shield,
  Palette,
  Crown,
  Anchor,
  Flag,
  Lightbulb,
};

export const DEFAULT_ICONS: Record<string, string> = {
  purpose: 'Compass',
  domain: 'Layers',
  goal: 'Target',
  objective: 'CheckCircle2',
  habit: 'Repeat2',
  skill: 'Brain',
  project: 'Rocket',
  topic: 'BookOpen',
};

export const renderLucideIcon = (iconName?: string, defaultName = 'Target', className = 'w-4 h-4') => {
  const IconComponent = (iconName && LUCIDE_ICONS[iconName]) || LUCIDE_ICONS[defaultName] || Target;
  return <IconComponent className={className} />;
};

export interface UniversalNodeData {
  id: string;
  title: string;
  type: string;
  typeName?: string;
  rawEntity: any;
  icon?: string;
  status?: string;
  time_spent?: number;
  color?: EntityColor;
  description?: string;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  isDimmed?: boolean;
  tier: 1 | 2 | 3 | 4 | 5;
  onInspect?: (data: UniversalNodeData) => void;
  onToggleCollapse?: (id: string, e: React.MouseEvent) => void;
  onQuickRename?: (id: string, newTitle: string) => Promise<void>;
  onChangeStatus?: (id: string, newStatus: string) => Promise<void>;
}

export const COLOR_THEMES: Record<
  string,
  {
    border: string;
    glow: string;
    bgGradient: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    handleBg: string;
    iconBg: string;
    iconBorder: string;
    iconText: string;
    accentColor: string;
  }
> = {
  indigo: {
    border: 'border-indigo-500/60 hover:border-indigo-400',
    glow: 'shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:shadow-[0_0_35px_rgba(99,102,241,0.4)]',
    bgGradient: 'from-[#181424] to-[#100e19]',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/40',
    handleBg: '!bg-indigo-400',
    iconBg: 'bg-indigo-500/20',
    iconBorder: 'border-indigo-500/50',
    iconText: 'text-indigo-400',
    accentColor: '#818cf8',
  },
  sky: {
    border: 'border-sky-500/60 hover:border-sky-400',
    glow: 'shadow-[0_0_20px_rgba(14,165,233,0.25)] hover:shadow-[0_0_30px_rgba(14,165,233,0.35)]',
    bgGradient: 'from-[#0e1a24] to-[#091118]',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-400',
    badgeBorder: 'border-sky-500/40',
    handleBg: '!bg-sky-400',
    iconBg: 'bg-sky-500/20',
    iconBorder: 'border-sky-500/50',
    iconText: 'text-sky-400',
    accentColor: '#38bdf8',
  },
  amber: {
    border: 'border-amber-500/60 hover:border-amber-400',
    glow: 'shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)]',
    bgGradient: 'from-[#1e170c] to-[#120e06]',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/40',
    handleBg: '!bg-amber-400',
    iconBg: 'bg-amber-500/20',
    iconBorder: 'border-amber-500/50',
    iconText: 'text-amber-400',
    accentColor: '#f59e0b',
  },
  emerald: {
    border: 'border-emerald-500/60 hover:border-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    bgGradient: 'from-[#0f1d17] to-[#09130f]',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/40',
    handleBg: '!bg-emerald-400',
    iconBg: 'bg-emerald-500/20',
    iconBorder: 'border-emerald-500/50',
    iconText: 'text-emerald-400',
    accentColor: '#10b981',
  },
  rose: {
    border: 'border-rose-500/60 hover:border-rose-400',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.25)]',
    bgGradient: 'from-[#22121a] to-[#140b10]',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/40',
    handleBg: '!bg-rose-400',
    iconBg: 'bg-rose-500/20',
    iconBorder: 'border-rose-500/50',
    iconText: 'text-rose-400',
    accentColor: '#fb7185',
  },
  violet: {
    border: 'border-purple-500/60 hover:border-purple-400',
    glow: 'shadow-[0_0_25px_rgba(168,85,247,0.25)]',
    bgGradient: 'from-[#1c1228] to-[#110b1a]',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/40',
    handleBg: '!bg-purple-400',
    iconBg: 'bg-purple-500/20',
    iconBorder: 'border-purple-500/50',
    iconText: 'text-purple-400',
    accentColor: '#c084fc',
  },
  teal: {
    border: 'border-teal-500/60 hover:border-teal-400',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.25)]',
    bgGradient: 'from-[#0b1c1b] to-[#071312]',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-400',
    badgeBorder: 'border-teal-500/40',
    handleBg: '!bg-teal-400',
    iconBg: 'bg-teal-500/20',
    iconBorder: 'border-teal-500/50',
    iconText: 'text-teal-400',
    accentColor: '#2dd4bf',
  },
  orange: {
    border: 'border-orange-500/60 hover:border-orange-400',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.25)]',
    bgGradient: 'from-[#20150c] to-[#140d07]',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-400',
    badgeBorder: 'border-orange-500/40',
    handleBg: '!bg-orange-400',
    iconBg: 'bg-orange-500/20',
    iconBorder: 'border-orange-500/50',
    iconText: 'text-orange-400',
    accentColor: '#fb923c',
  },
  cyan: {
    border: 'border-cyan-500/60 hover:border-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.25)]',
    bgGradient: 'from-[#0a1921] to-[#061015]',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/40',
    handleBg: '!bg-cyan-400',
    iconBg: 'bg-cyan-500/20',
    iconBorder: 'border-cyan-500/50',
    iconText: 'text-cyan-400',
    accentColor: '#22d3ee',
  },
  fuchsia: {
    border: 'border-fuchsia-500/60 hover:border-fuchsia-400',
    glow: 'shadow-[0_0_20px_rgba(217,70,239,0.25)]',
    bgGradient: 'from-[#1e1022] to-[#130a16]',
    badgeBg: 'bg-fuchsia-500/20',
    badgeText: 'text-fuchsia-400',
    badgeBorder: 'border-fuchsia-500/40',
    handleBg: '!bg-fuchsia-400',
    iconBg: 'bg-fuchsia-500/20',
    iconBorder: 'border-fuchsia-500/50',
    iconText: 'text-fuchsia-400',
    accentColor: '#e879f9',
  },
};

export const MasteryRing = ({
  progress = 0,
  size = 36,
  strokeWidth = 2.5,
  color = '#f59e0b',
}: {
  progress?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <svg width={size} height={size} className="absolute -top-0 -left-0 pointer-events-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255, 255, 255, 0.08)" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        fill="none"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
};

const ConnectionHandles = ({ colorClass = '!bg-amber-400' }: { colorClass?: string }) => (
  <>
    <Handle
      type="target"
      position={Position.Top}
      id="top-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-top-1.5 shadow-md hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle type="source" position={Position.Top} id="top-source" className="!opacity-0 !w-3 !h-3 !-top-1.5 z-20" />
    <Handle
      type="target"
      position={Position.Bottom}
      id="bottom-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-bottom-1.5 shadow-md hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle type="source" position={Position.Bottom} id="bottom-source" className="!opacity-0 !w-3 !h-3 !-bottom-1.5 z-20" />
    <Handle
      type="target"
      position={Position.Left}
      id="left-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-left-1.5 shadow-md hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle type="source" position={Position.Left} id="left-source" className="!opacity-0 !w-3 !h-3 !-left-1.5 z-20" />
    <Handle
      type="target"
      position={Position.Right}
      id="right-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-right-1.5 shadow-md hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle type="source" position={Position.Right} id="right-source" className="!opacity-0 !w-3 !h-3 !-right-1.5 z-20" />
  </>
);

// ─── UNIVERSAL CANVAS NODE (5 TIERS) ─────────────────────────────────────────
export const UniversalCanvasNode = memo(({ data }: NodeProps<any>) => {
  const isDone = data.status === 'done' || data.status === 'achieved' || data.status === 'completed';
  const isArchived = data.status === 'archived';
  const totalMinutes = data.time_spent ? Math.round(data.time_spent / 60) : 0;
  const timeSpentStr = data.time_spent ? formatDuration(data.time_spent) : null;
  const tier: 1 | 2 | 3 | 4 | 5 = data.tier || 2;

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.title);

  useEffect(() => {
    setTitle(data.title);
  }, [data.title]);

  const commitTitle = async () => {
    setIsEditing(false);
    if (title.trim() && title !== data.title) {
      await data.onQuickRename?.(data.id, title.trim());
    }
  };

  const theme = COLOR_THEMES[data.color || 'indigo'] || COLOR_THEMES.indigo;
  const masteryLevel = Math.min(5, Math.max(1, Math.floor(totalMinutes / 120) + 1));
  const masteryProgress = Math.min(100, (totalMinutes % 120) * (100 / 120));

  // ─── TIER 5: ATOMIC LEAF / PINPOINT BADGE ──────────────────────────────────
  if (tier === 5) {
    return (
      <div
        onClick={() => data.onInspect?.(data)}
        className={`group relative px-2 py-0.5 rounded-md border text-[10px] font-mono flex items-center gap-1.5 select-none transition-all cursor-pointer ${
          isDone
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
            : 'bg-[#121214] border-stone-800 hover:border-amber-500/50 text-stone-300'
        } ${data.isDimmed ? 'opacity-30' : 'opacity-100'}`}
      >
        <ConnectionHandles colorClass={isDone ? '!bg-emerald-400' : theme.handleBg} />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
        <span className={`truncate max-w-[100px] ${isDone ? 'line-through text-stone-400' : ''}`}>
          {data.title}
        </span>
      </div>
    );
  }

  // ─── TIER 4: MICRO-SKILL / PEBBLE CAPSULE ──────────────────────────────────
  if (tier === 4) {
    return (
      <div
        onClick={() => data.onInspect?.(data)}
        className={`group relative px-2.5 py-1 rounded-full border text-[11px] font-mono flex items-center gap-2 select-none shadow-sm transition-all cursor-pointer ${
          isDone
            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
            : 'bg-[#121215] border-stone-800 hover:border-amber-400/60 text-stone-200'
        } ${data.isDimmed ? 'opacity-30' : 'opacity-100'}`}
      >
        <ConnectionHandles colorClass={isDone ? '!bg-emerald-400' : theme.handleBg} />
        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${theme.iconBg} ${theme.iconText}`}>
          {renderLucideIcon(data.icon, 'Target', 'w-2.5 h-2.5')}
        </div>
        <span className={`truncate max-w-[120px] font-medium ${isDone ? 'line-through text-stone-400' : ''}`}>
          {data.title}
        </span>
        {totalMinutes > 0 && (
          <span className="text-[8.5px] font-bold text-amber-400 bg-amber-500/10 px-1 rounded-full">
            {totalMinutes}m
          </span>
        )}
      </div>
    );
  }

  // ─── TIER 3: TOPIC / SATELLITE PILL ────────────────────────────────────────
  if (tier === 3) {
    return (
      <div
        onClick={() => data.onInspect?.(data)}
        className={`group relative px-3 py-1.5 rounded-xl border flex items-center gap-2.5 select-none shadow-md transition-all cursor-pointer ${
          isDone
            ? 'bg-[#0d1a13] border-emerald-500/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            : 'bg-[#141418] border-stone-800 hover:border-amber-500/60 text-stone-200'
        } ${data.isDimmed ? 'opacity-35' : 'opacity-100'}`}
      >
        <ConnectionHandles colorClass={isDone ? '!bg-emerald-400' : theme.handleBg} />
        <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${theme.iconBg} ${theme.iconText}`}>
          {renderLucideIcon(data.icon, 'Target', 'w-3 h-3')}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-mono font-semibold block truncate max-w-[140px] ${isDone ? 'line-through text-stone-400' : 'text-stone-100'}`}>
            {data.title}
          </span>
        </div>
        {timeSpentStr && (
          <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.2 rounded-md">
            ⚡ {timeSpentStr}
          </span>
        )}
      </div>
    );
  }

  // ─── TIER 1 & TIER 2: NUCLEUS & PILLAR CARDS ──────────────────────────────
  const isTier1 = tier === 1;

  return (
    <div
      onClick={() => data.onInspect?.(data)}
      className={`group relative rounded-2xl bg-gradient-to-br border-2 transition-all cursor-pointer select-none ${
        isTier1
          ? 'p-4 min-w-[260px] max-w-[360px] shadow-[0_0_35px_rgba(245,158,11,0.25)] hover:shadow-[0_0_45px_rgba(245,158,11,0.4)]'
          : 'p-3.5 min-w-[210px] max-w-[320px] shadow-xl'
      } ${
        isArchived
          ? 'from-[#141416] to-[#0c0c0e] border-stone-700/60 opacity-60'
          : isDone
            ? 'from-[#0c1a14] to-[#08120e] border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
            : isTier1
              ? `${theme.bgGradient} ${theme.border} ${theme.glow}`
              : `${theme.bgGradient} border-stone-800 hover:${theme.border}`
      } ${data.isDimmed ? 'opacity-35' : 'opacity-100'}`}
    >
      <ConnectionHandles colorClass={isDone ? '!bg-emerald-400' : theme.handleBg} />

      <div className="flex items-start gap-3">
        {/* Node Icon with Mastery XP Ring */}
        <div className="relative shrink-0 mt-0.5">
          {totalMinutes > 0 && (
            <MasteryRing
              progress={masteryProgress}
              size={isTier1 ? 42 : 36}
              color={isDone ? '#10b981' : isTier1 ? '#f59e0b' : theme.accentColor}
            />
          )}
          <div
            className={`rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${
              isTier1 ? 'w-10 h-10' : 'w-8 h-8'
            } ${
              isDone
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : `${theme.iconBg} ${theme.iconBorder} ${theme.iconText}`
            }`}
          >
            {renderLucideIcon(data.icon, 'Target', isTier1 ? 'w-5 h-5' : 'w-4 h-4')}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-mono uppercase tracking-widest font-bold leading-tight ${
                  isTier1 ? 'text-[10px]' : 'text-[8.5px]'
                } ${isDone ? 'text-emerald-400' : theme.badgeText}`}
              >
                {data.typeName || data.type}
              </span>
              {isTier1 && (
                <span className="text-[7.5px] font-mono uppercase px-1.5 py-0.2 rounded font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                  Core
                </span>
              )}
              {isDone && (
                <span className="text-[7px] font-mono font-bold uppercase text-emerald-300 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/40">
                  ✓ Done
                </span>
              )}
            </div>

            {timeSpentStr && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border text-amber-300 bg-amber-500/10 border-amber-500/25">
                ⚡ {timeSpentStr} {masteryLevel > 1 ? `· Lvl ${masteryLevel}` : ''}
              </span>
            )}
          </div>

          {isEditing ? (
            <textarea
              rows={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitTitle();
                }
                if (e.key === 'Escape') setIsEditing(false);
              }}
              onBlur={commitTitle}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="w-full bg-[#0a0a0a] border border-amber-500/50 rounded px-1.5 py-1 text-xs font-semibold text-stone-100 focus:outline-none resize-none"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={`font-bold block leading-relaxed break-words whitespace-normal ${
                isTier1 ? 'text-sm font-sans text-stone-100' : 'text-xs text-stone-200'
              } ${isDone ? 'text-stone-400 line-through' : 'group-hover:text-amber-200'}`}
              title="Double click to edit title"
            >
              {data.title || `Untitled ${data.typeName || data.type}`}
            </span>
          )}
        </div>
      </div>

      {/* Branch Collapse/Expand Button */}
      {data.hasChildren && (
        <button
          onClick={(e) => data.onToggleCollapse?.(data.id, e)}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer z-30 ${
            isDone
              ? 'bg-[#0a1510] border-emerald-500/60 text-emerald-400'
              : 'bg-[#121212] border-stone-700 text-stone-300'
          }`}
          title={data.isCollapsed ? 'Expand branches' : 'Collapse branches'}
        >
          {data.isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
});
