import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Target,
  CheckCircle2,
  Repeat2,
  Compass,
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Clock,
  Sparkles,
  Smile,
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
} from 'lucide-react';
import { formatDuration } from '../../../utils';

// Lucide Icon mapping dictionary
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
};

export const renderLucideIcon = (
  iconName?: string,
  defaultName = 'Target',
  className = 'w-4 h-4',
) => {
  const IconComponent =
    (iconName && LUCIDE_ICONS[iconName]) ||
    LUCIDE_ICONS[defaultName] ||
    Target;
  return <IconComponent className={className} />;
};

export interface CanvasNodeData {
  id: string;
  title: string;
  type: string; // supports built-in and custom entity types
  typeName?: string; // Human label, e.g. "Project", "Skill"
  rawEntry: any;
  icon?: string;
  status?: string;
  time_spent?: number;
  color?: string;
  description?: string;
  linkedCount?: number;
  isSelected?: boolean;
  isCollapsed?: boolean;
  hasChildren?: boolean;
  isDimmed?: boolean;
  hasStatus?: boolean;
  hasTimeTracking?: boolean;
  tier?: 1 | 2 | 3; // Dynamic graph depth tier: 1 = Nucleus (0 parents), 2 = Pillar (1 parent), 3 = Satellite (2+ depth)
  masteryXp?: number; // Accumulated focus minutes / XP
  masteryLevel?: number; // 1 to 5 level
  onInspect?: (data: CanvasNodeData) => void;
  onToggleCollapse?: (id: string, e: React.MouseEvent) => void;
  onQuickRename?: (id: string, newTitle: string) => Promise<void>;
  onChangeIcon?: (id: string, newIcon: string) => Promise<void>;
  onQuickUpdateDescription?: (newDescription: string) => Promise<void>;
}

// ─── 🔮 MASTERY XP RING HELPER ───────────────────────────────────────────────
export const MasteryRing = ({
  level = 1,
  progress = 0,
  size = 36,
  strokeWidth = 2.5,
  colorClass = '#f59e0b',
}: {
  level?: number;
  progress?: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="absolute -top-0 -left-0 pointer-events-none -rotate-90"
    >
      {/* Background Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Active Animated XP Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colorClass}
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
  },
  sky: {
    border: 'border-sky-500/50 hover:border-sky-400',
    glow: 'shadow-[0_0_15px_rgba(56,189,248,0.2)]',
    bgGradient: 'from-[#0e1927] to-[#0a121d]',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-400',
    badgeBorder: 'border-sky-500/30',
    handleBg: '!bg-sky-400',
    iconBg: 'bg-sky-500/20',
    iconBorder: 'border-sky-500/40',
    iconText: 'text-sky-400',
  },
  amber: {
    border: 'border-amber-500/50 hover:border-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]',
    bgGradient: 'from-[#1a160d] to-[#120f08]',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
    handleBg: '!bg-amber-400',
    iconBg: 'bg-amber-500/20',
    iconBorder: 'border-amber-500/40',
    iconText: 'text-amber-400',
  },
  emerald: {
    border: 'border-emerald-500/50 hover:border-emerald-400',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    bgGradient: 'from-[#0f1d17] to-[#09130f]',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    handleBg: '!bg-emerald-400',
    iconBg: 'bg-emerald-500/20',
    iconBorder: 'border-emerald-500/40',
    iconText: 'text-emerald-400',
  },
  rose: {
    border: 'border-rose-500/50 hover:border-rose-400',
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.2)]',
    bgGradient: 'from-[#201219] to-[#140b10]',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/30',
    handleBg: '!bg-rose-400',
    iconBg: 'bg-rose-500/20',
    iconBorder: 'border-rose-500/40',
    iconText: 'text-rose-400',
  },
  violet: {
    border: 'border-purple-500/50 hover:border-purple-400',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
    bgGradient: 'from-[#1a1128] to-[#110b1a]',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/30',
    handleBg: '!bg-purple-400',
    iconBg: 'bg-purple-500/20',
    iconBorder: 'border-purple-500/40',
    iconText: 'text-purple-400',
  },
  teal: {
    border: 'border-teal-500/50 hover:border-teal-400',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.2)]',
    bgGradient: 'from-[#0b1c1b] to-[#071312]',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-400',
    badgeBorder: 'border-teal-500/30',
    handleBg: '!bg-teal-400',
    iconBg: 'bg-teal-500/20',
    iconBorder: 'border-teal-500/40',
    iconText: 'text-teal-400',
  },
  orange: {
    border: 'border-orange-500/50 hover:border-orange-400',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)]',
    bgGradient: 'from-[#1f150c] to-[#140d07]',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-400',
    badgeBorder: 'border-orange-500/30',
    handleBg: '!bg-orange-400',
    iconBg: 'bg-orange-500/20',
    iconBorder: 'border-orange-500/40',
    iconText: 'text-orange-400',
  },
  cyan: {
    border: 'border-cyan-500/50 hover:border-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.2)]',
    bgGradient: 'from-[#0a1921] to-[#061015]',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/30',
    handleBg: '!bg-cyan-400',
    iconBg: 'bg-cyan-500/20',
    iconBorder: 'border-cyan-500/40',
    iconText: 'text-cyan-400',
  },
  fuchsia: {
    border: 'border-fuchsia-500/50 hover:border-fuchsia-400',
    glow: 'shadow-[0_0_20px_rgba(217,70,239,0.2)]',
    bgGradient: 'from-[#1e1022] to-[#130a16]',
    badgeBg: 'bg-fuchsia-500/20',
    badgeText: 'text-fuchsia-400',
    badgeBorder: 'border-fuchsia-500/30',
    handleBg: '!bg-fuchsia-400',
    iconBg: 'bg-fuchsia-500/20',
    iconBorder: 'border-fuchsia-500/40',
    iconText: 'text-fuchsia-400',
  },
};

// ─── 📝 INLINE COLLAPSIBLE NODE MARKDOWN SECTION ────────────────────────────
const NodeMarkdownSection = ({
  description,
  onSave,
  themeColor = 'indigo',
}: {
  description?: string;
  onSave?: (newDesc: string) => Promise<void>;
  themeColor?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(description || '');

  useEffect(() => {
    setText(description || '');
  }, [description]);

  const hasContent = Boolean(description && description.trim().length > 0);

  const commitDesc = async () => {
    setIsEditing(false);
    if (text !== description) {
      await onSave?.(text);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full mt-2 pt-2 border-t border-white/10 select-text"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="flex items-center gap-1 text-[9px] font-mono text-stone-400 hover:text-stone-200 transition-colors cursor-pointer select-none font-bold uppercase tracking-wider"
        >
          <ChevronRight
            className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-90 text-amber-400' : ''}`}
          />
          <span>Notes</span>
        </button>

        {isOpen && isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              commitDesc();
            }}
            className="text-[8px] font-mono text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider cursor-pointer"
          >
            Done
          </button>
        )}
      </div>

      {isOpen && (
        <div className="w-full mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {isEditing ? (
            <textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditing(false);
              }}
              placeholder="Type markdown notes here..."
              className="w-full bg-[#0a0a0c] border border-amber-500/50 rounded-lg p-2 text-[11px] text-stone-200 font-mono focus:outline-none resize-none leading-relaxed shadow-inner"
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="w-full bg-[#0a0a0c]/80 hover:bg-[#0a0a0c] border border-white/10 hover:border-amber-500/40 rounded-lg p-2 min-h-[2.5rem] max-h-48 overflow-y-auto cursor-pointer transition-colors"
              title="Click anywhere to edit notes"
            >
              {hasContent ? (
                <div className="space-y-1 text-stone-300 text-[11px] font-sans leading-relaxed">
                  {text.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) {
                      return (
                        <h4 key={i} className="font-bold text-amber-400 text-xs mt-1">
                          {line.replace('# ', '')}
                        </h4>
                      );
                    }
                    if (line.startsWith('## ') || line.startsWith('### ')) {
                      return (
                        <h5 key={i} className="font-bold text-amber-300 text-[11px] mt-0.5">
                          {line.replace(/^#{2,3} /, '')}
                        </h5>
                      );
                    }
                    if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-stone-400 line-through">
                          <span className="text-emerald-400">✓</span>
                          <span>{line.replace(/- \[[xX]\] /, '')}</span>
                        </div>
                      );
                    }
                    if (line.startsWith('- [ ] ')) {
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-stone-200">
                          <span className="w-2.5 h-2.5 border border-stone-600 rounded inline-block" />
                          <span>{line.replace('- [ ] ', '')}</span>
                        </div>
                      );
                    }
                    if (line.startsWith('- ') || line.startsWith('* ')) {
                      return (
                        <div key={i} className="flex items-center gap-1.5 pl-0.5">
                          <span className="text-amber-400 text-[9px]">•</span>
                          <span>{line.replace(/^[-*] /, '')}</span>
                        </div>
                      );
                    }
                    if (line.trim() === '') return <div key={i} className="h-1" />;
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              ) : (
                <span className="text-[10px] font-mono text-stone-500 italic block py-1">
                  Click to add notes...
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 🌐 DYNAMIC GENERIC CANVAS NODE (TIER 1 NUCLEUS | TIER 2 PILLAR | TIER 3 SATELLITE) ───
export const GenericCanvasNode = memo(({ data }: NodeProps<any>) => {
  const isCompleted =
    data.status === 'done' || data.status === 'achieved' || data.status === 'completed';
  const isArchived = data.status === 'archived';
  const timeSpentStr = data.time_spent ? formatDuration(data.time_spent) : null;
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

  const colorKey = data.color || 'indigo';
  const theme = COLOR_THEMES[colorKey] || COLOR_THEMES.indigo;
  const tier: 1 | 2 | 3 = data.tier || 2; // Default to Tier 2 if unset

  // Calculate dynamic Mastery Progress (0-100%) and Level
  const totalMinutes = data.time_spent ? Math.round(data.time_spent / 60) : 0;
  const masteryLevel = Math.min(5, Math.max(1, Math.floor(totalMinutes / 120) + 1));
  const masteryProgress = Math.min(100, (totalMinutes % 120) * (100 / 120));

  // ─── TIER 3: SATELLITE / PEBBLE ORB (Compact Leaf Sub-Skill / Concept) ─────
  if (tier === 3) {
    return (
      <div
        onClick={() => data.onInspect?.(data)}
        className={`group relative px-3 py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-2 select-none shadow-sm ${
          isArchived
            ? 'bg-[#141416] border-stone-800 text-stone-500 opacity-60'
            : isCompleted
              ? 'bg-[#0d1a13] border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : 'bg-[#111114] border-stone-800 hover:border-amber-500/60 text-stone-200 hover:text-white'
        } ${data.isDimmed ? 'opacity-30' : 'opacity-100'}`}
      >
        <ConnectionHandles
          colorClass={isArchived ? '!bg-stone-600' : isCompleted ? '!bg-emerald-400' : theme.handleBg}
        />

        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400'
              : `${theme.iconBg} ${theme.iconText}`
          }`}
        >
          {renderLucideIcon(data.icon, 'Target', 'w-3 h-3')}
        </div>

        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            onBlur={commitTitle}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="bg-[#0a0a0a] border border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-stone-100 focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className={`text-[11px] font-mono font-medium truncate max-w-[140px] ${
              isCompleted ? 'line-through text-stone-400' : 'text-stone-200'
            }`}
            title="Double click to rename"
          >
            {data.title || data.typeName || 'Sub-Item'}
          </span>
        )}

        {totalMinutes > 0 && (
          <span className="text-[9px] font-mono font-bold text-amber-400/80 bg-amber-500/10 px-1.5 py-0.2 rounded-full">
            {formatDuration(data.time_spent!)}
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
          ? 'p-4 min-w-[240px] max-w-[360px] shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]'
          : 'p-3.5 min-w-[200px] max-w-[320px] shadow-[0_0_15px_rgba(0,0,0,0.5)]'
      } ${
        isArchived
          ? 'from-[#141416] to-[#0c0c0e] border-stone-700/60 opacity-60 hover:opacity-100 shadow-none'
          : isCompleted
            ? 'from-[#0c1a14]/90 to-[#08120e]/90 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : isTier1
              ? `${theme.bgGradient} ${theme.border} ${theme.glow}`
              : `${theme.bgGradient} border-stone-800 hover:${theme.border}`
      } ${data.isDimmed ? 'opacity-35 hover:opacity-100' : 'opacity-100'}`}
    >
      <ConnectionHandles
        colorClass={isArchived ? '!bg-stone-500' : isCompleted ? '!bg-emerald-400' : theme.handleBg}
      />

      <div className="flex items-start gap-3">
        {/* Node Icon with Optional Mastery XP Ring */}
        <div className="relative shrink-0 mt-0.5">
          {totalMinutes > 0 && (
            <MasteryRing
              level={masteryLevel}
              progress={masteryProgress}
              size={isTier1 ? 40 : 34}
              colorClass={isCompleted ? '#10b981' : isTier1 ? '#f59e0b' : '#818cf8'}
            />
          )}
          <div
            className={`rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${
              isTier1 ? 'w-10 h-10' : 'w-8 h-8'
            } ${
              isArchived
                ? 'bg-stone-800/60 border-stone-700 text-stone-400'
                : isCompleted
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
                } ${
                  isArchived ? 'text-stone-400' : isCompleted ? 'text-emerald-400' : theme.badgeText
                }`}
              >
                {data.typeName || data.type}
              </span>
              {isTier1 && (
                <span className="text-[7.5px] font-mono uppercase px-1 py-0.2 rounded font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                  Core
                </span>
              )}
              {isCompleted && (
                <span className="text-[7px] font-mono font-bold uppercase text-emerald-300 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/40">
                  ✓ Done
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {timeSpentStr && (
                <span
                  className={`text-[8px] font-mono px-1 py-0.5 rounded border ${
                    isArchived
                      ? 'text-stone-400 bg-stone-800/40 border-stone-700/40'
                      : isCompleted
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : `${theme.badgeText} ${theme.badgeBg} ${theme.badgeBorder}`
                  }`}
                >
                  ⚡ {timeSpentStr}
                </span>
              )}
            </div>
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
              className={`w-full bg-[#0a0a0a] border rounded px-1.5 py-1 text-xs font-semibold text-stone-100 focus:outline-none resize-none ${
                isCompleted ? 'border-emerald-500/50' : 'border-amber-500/50'
              }`}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={`font-bold block leading-relaxed break-words whitespace-normal ${
                isTier1 ? 'text-sm font-sans text-stone-100' : 'text-xs text-stone-200'
              } ${
                isArchived
                  ? 'text-stone-400 italic group-hover:text-stone-300'
                  : isCompleted
                    ? 'text-stone-300 line-through group-hover:text-emerald-200'
                    : 'group-hover:text-amber-200'
              }`}
              title="Double click to edit title"
            >
              {data.title || `Untitled ${data.typeName || data.type}`}
            </span>
          )}
        </div>
      </div>

      {/* Full-width Collapsible Inline Markdown Notes */}
      <NodeMarkdownSection
        description={data.description}
        onSave={data.onQuickUpdateDescription}
        themeColor={colorKey}
      />

      {/* Collapse/Expand toggle handle */}
      {data.hasChildren && (
        <button
          onClick={(e) => data.onToggleCollapse?.(data.id, e)}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer z-30 ${
            isCompleted
              ? 'bg-[#0a1510] border-emerald-500/60 text-emerald-400'
              : 'bg-[#121212] border-stone-700 text-stone-300'
          }`}
          title={data.isCollapsed ? 'Expand branches' : 'Collapse branches'}
        >
          {data.isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
});

// 4 Enlarged Connection Ports for X and Y axis (Top, Bottom, Left, Right)
const ConnectionHandles = ({ colorClass = '!bg-amber-400' }: { colorClass?: string }) => (
  <>
    <Handle
      type="target"
      position={Position.Top}
      id="top-target"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-top-1.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Top}
      id="top-source"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-top-1.5 opacity-0 hover:opacity-100 z-20`}
    />

    <Handle
      type="target"
      position={Position.Bottom}
      id="bottom-target"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-bottom-1.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Bottom}
      id="bottom-source"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-bottom-1.5 opacity-0 hover:opacity-100 z-20`}
    />

    <Handle
      type="target"
      position={Position.Left}
      id="left-target"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-left-1.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Left}
      id="left-source"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-left-1.5 opacity-0 hover:opacity-100 z-20`}
    />

    <Handle
      type="target"
      position={Position.Right}
      id="right-target"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-right-1.5 shadow-[0_0_8px_rgba(255,255,255,0.4)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Right}
      id="right-source"
      className={`!w-3.5 !h-3.5 ${colorClass} !border-2 !border-[#0d0d0d] !-right-1.5 opacity-0 hover:opacity-100 z-20`}
    />
  </>
);

// ─── 🌌 PURPOSE NODE ────────────────────────────────────────────────────────
export const PurposeNode = memo(({ data }: NodeProps<any>) => {
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

  return (
    <div
      onClick={() => data.onInspect?.(data)}
      className="group relative px-4 py-3 rounded-2xl bg-gradient-to-br from-[#181424] to-[#100e19] border-2 border-indigo-500/60 hover:border-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:shadow-[0_0_35px_rgba(99,102,241,0.4)] transition-all cursor-pointer min-w-[220px] max-w-[340px]"
    >
      <ConnectionHandles colorClass="!bg-indigo-400" />

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.35)] mt-0.5">
          {renderLucideIcon(data.icon, 'Compass', 'w-4 h-4')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-400 font-bold leading-tight">
              PURPOSE
            </span>
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
              className="w-full bg-[#0a0a0a] border border-indigo-500/50 rounded px-1.5 py-1 text-xs font-semibold text-stone-100 focus:outline-none resize-none"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="text-xs font-bold text-stone-100 group-hover:text-indigo-200 block leading-relaxed break-words whitespace-normal"
              title="Double click to edit title"
            >
              {data.title || 'Untitled Purpose'}
            </span>
          )}
        </div>
      </div>

      {/* Full-width Collapsible Inline Markdown Notes */}
      <NodeMarkdownSection
        description={data.description}
        onSave={data.onQuickUpdateDescription}
        themeColor="indigo"
      />

      {/* Collapse/Expand toggle handle */}
      {data.hasChildren && (
        <button
          onClick={(e) => data.onToggleCollapse?.(data.id, e)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#13111c] border border-indigo-500/60 text-indigo-400 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer z-30"
          title={data.isCollapsed ? 'Expand branches' : 'Collapse branches'}
        >
          {data.isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
});

// ─── 🏷️ DOMAIN NODE ─────────────────────────────────────────────────────────
export const DomainNode = memo(({ data }: NodeProps<any>) => {
  return (
    <div
      onClick={() => data.onInspect?.(data)}
      className="group relative px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-[#0e1927] to-[#0a121d] border border-sky-500/50 hover:border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)] transition-all cursor-pointer min-w-[190px] max-w-[320px]"
    >
      <ConnectionHandles colorClass="!bg-sky-400" />

      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          {renderLucideIcon(data.icon, 'Layers', 'w-3.5 h-3.5')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[8px] font-mono uppercase tracking-wider text-sky-400 font-semibold block leading-tight">
              DOMAIN
            </span>
          </div>
          <span className="text-xs font-semibold text-stone-200 group-hover:text-sky-200 block leading-relaxed break-words whitespace-normal">
            {data.title || 'Untitled Domain'}
          </span>
        </div>
      </div>

      {/* Full-width Collapsible Inline Markdown Notes */}
      <NodeMarkdownSection
        description={data.description}
        onSave={data.onQuickUpdateDescription}
        themeColor="sky"
      />
    </div>
  );
});

// ─── 🎯 GOAL NODE ───────────────────────────────────────────────────────────
export const GoalNode = memo(({ data }: NodeProps<any>) => {
  const isAchieved = data.status === 'achieved';
  const isArchived = data.status === 'archived';
  const timeSpentStr = data.time_spent ? formatDuration(data.time_spent) : null;
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

  return (
    <div
      onClick={() => data.onInspect?.(data)}
      className={`group relative px-4 py-3 rounded-xl border transition-all cursor-pointer min-w-[230px] max-w-[340px] ${
        data.isDimmed ? 'opacity-35 hover:opacity-100' : 'opacity-100'
      } ${
        isArchived
          ? 'bg-gradient-to-br from-[#141416] to-[#0c0c0e] border-stone-700/60 opacity-60 hover:opacity-100 shadow-none'
          : isAchieved
            ? 'bg-gradient-to-br from-[#0c1a14]/90 to-[#08120e]/90 border-emerald-500/60 shadow-[0_0_22px_rgba(16,185,129,0.22)] hover:border-emerald-400'
            : 'bg-gradient-to-br from-[#1a160d] to-[#120f08] border-amber-500/50 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]'
      }`}
    >
      <ConnectionHandles
        colorClass={isArchived ? '!bg-stone-500' : isAchieved ? '!bg-emerald-400' : '!bg-amber-400'}
      />

      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
            isArchived
              ? 'bg-stone-800/60 border-stone-700 text-stone-400'
              : isAchieved
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-sm'
          }`}
        >
          {renderLucideIcon(data.icon, 'Target', 'w-4 h-4')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[9px] font-mono uppercase tracking-widest font-bold ${
                  isArchived
                    ? 'text-stone-400'
                    : isAchieved
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                }`}
              >
                GOAL
              </span>
              {isAchieved && (
                <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/40 shadow-xs">
                  ✓ Achieved
                </span>
              )}
              {isArchived && (
                <span className="text-[7px] font-mono font-bold uppercase text-stone-400 bg-stone-800 px-1 py-0.2 rounded border border-stone-700">
                  Archived
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {timeSpentStr && (
                <span
                  className={`text-[8px] font-mono px-1 py-0.5 rounded border ${
                    isArchived
                      ? 'text-stone-400 bg-stone-800/40 border-stone-700/40'
                      : isAchieved
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-amber-400/90 bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  ⏳ {timeSpentStr}
                </span>
              )}
            </div>
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
              className={`w-full bg-[#0a0a0a] border rounded px-1.5 py-1 text-xs font-semibold text-stone-100 focus:outline-none resize-none ${
                isAchieved ? 'border-emerald-500/50' : 'border-amber-500/50'
              }`}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={`text-xs font-bold block leading-relaxed break-words whitespace-normal ${
                isArchived
                  ? 'text-stone-400 italic group-hover:text-stone-300'
                  : isAchieved
                    ? 'text-stone-300 line-through group-hover:text-emerald-200'
                    : 'text-stone-100 group-hover:text-amber-200'
              }`}
              title="Double click to edit title"
            >
              {data.title || 'Untitled Goal'}
            </span>
          )}
        </div>
      </div>

      {/* Full-width Collapsible Inline Markdown Notes */}
      <NodeMarkdownSection
        description={data.description}
        onSave={data.onQuickUpdateDescription}
        themeColor="amber"
      />

      {/* Collapse/Expand toggle handle */}
      {data.hasChildren && (
        <button
          onClick={(e) => data.onToggleCollapse?.(data.id, e)}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer z-30 ${
            isAchieved
              ? 'bg-[#0a1510] border-emerald-500/60 text-emerald-400'
              : 'bg-[#16130b] border-amber-500/60 text-amber-400'
          }`}
          title={data.isCollapsed ? 'Expand objectives' : 'Collapse objectives'}
        >
          {data.isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
});

// ─── 📌 OBJECTIVE NODE ──────────────────────────────────────────────────────
export const ObjectiveNode = memo(({ data }: NodeProps<any>) => {
  const isDone = data.status === 'done';
  const isArchived = data.status === 'archived';
  const timeSpentStr = data.time_spent ? formatDuration(data.time_spent) : null;
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

  return (
    <div
      onClick={() => data.onInspect?.(data)}
      className={`group relative px-3.5 py-2.5 rounded-lg border transition-all cursor-pointer min-w-[190px] max-w-[320px] ${
        data.isDimmed ? 'opacity-35 hover:opacity-100' : 'opacity-100'
      } ${
        isArchived
          ? 'bg-gradient-to-br from-[#141416] to-[#0c0c0e] border-stone-700/60 opacity-60 hover:opacity-100 shadow-none'
          : isDone
            ? 'bg-gradient-to-br from-[#0c1b14]/85 to-[#07110d]/85 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.18)]'
            : 'bg-gradient-to-br from-[#0f1d17] to-[#09130f] border-emerald-500/50 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
      }`}
    >
      <ConnectionHandles colorClass={isArchived ? '!bg-stone-500' : '!bg-emerald-400'} />

      <div className="flex items-start gap-2.5">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
            isArchived
              ? 'bg-stone-800/60 border-stone-700 text-stone-400'
              : isDone
                ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'bg-stone-900 border-stone-800 text-stone-400'
          }`}
        >
          {renderLucideIcon(data.icon, 'CheckCircle2', 'w-3.5 h-3.5')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1">
              <span
                className={`text-[8px] font-mono uppercase tracking-wider font-semibold block leading-tight ${
                  isArchived ? 'text-stone-400' : 'text-emerald-400'
                }`}
              >
                OBJECTIVE
              </span>
              {isDone && (
                <span className="text-[7px] font-mono font-bold uppercase text-emerald-300 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/30">
                  Done
                </span>
              )}
              {isArchived && (
                <span className="text-[7px] font-mono font-bold uppercase text-stone-400 bg-stone-800 px-1 py-0.2 rounded border border-stone-700">
                  Archived
                </span>
              )}
            </div>
            {timeSpentStr && (
              <span
                className={`text-[8px] font-mono px-1 py-0.5 rounded shrink-0 ${
                  isArchived
                    ? 'text-stone-400 bg-stone-800/40 border border-stone-700/40'
                    : 'text-emerald-400 bg-emerald-500/10'
                }`}
              >
                {timeSpentStr}
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
              className={`w-full bg-[#0a0a0a] border rounded px-1.5 py-1 text-xs text-stone-100 focus:outline-none resize-none ${
                isDone ? 'border-emerald-500/50' : 'border-stone-700'
              }`}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={`text-xs font-medium block leading-relaxed break-words whitespace-normal ${
                isArchived
                  ? 'text-stone-400 italic group-hover:text-stone-300'
                  : isDone
                    ? 'text-stone-400 line-through group-hover:text-emerald-300'
                    : 'text-stone-200 group-hover:text-emerald-300'
              }`}
              title="Double click to edit title"
            >
              {data.title || 'Untitled Objective'}
            </span>
          )}
        </div>
      </div>

      {/* Full-width Collapsible Inline Markdown Notes */}
      <NodeMarkdownSection
        description={data.description}
        onSave={data.onQuickUpdateDescription}
        themeColor="emerald"
      />
    </div>
  );
});

// ─── ⚡ HABIT NODE ──────────────────────────────────────────────────────────
export const HabitNode = memo(({ data }: NodeProps<any>) => {
  const isArchived = data.status === 'archived';

  return (
    <div
      onClick={() => data.onInspect?.(data)}
      className={`group relative px-3 py-2 rounded-xl border transition-all cursor-pointer min-w-[170px] max-w-[300px] ${
        isArchived
          ? 'bg-gradient-to-br from-[#141416] to-[#0c0c0e] border-stone-700/60 opacity-60 hover:opacity-100 shadow-none'
          : 'bg-gradient-to-br from-[#201219] to-[#140b10] border-rose-500/50 hover:border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
      }`}
    >
      <ConnectionHandles colorClass={isArchived ? '!bg-stone-500' : '!bg-rose-400'} />

      <div className="flex items-start gap-2.5">
        <div
          className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 shadow-sm mt-0.5 ${
            isArchived
              ? 'bg-stone-800/60 border-stone-700 text-stone-400'
              : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
          }`}
        >
          {renderLucideIcon(data.icon, 'Repeat2', 'w-3.5 h-3.5')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`text-[8px] font-mono uppercase tracking-wider font-semibold block leading-tight ${
                isArchived ? 'text-stone-400' : 'text-rose-400'
              }`}
            >
              HABIT
            </span>
            {isArchived && (
              <span className="text-[7px] font-mono font-bold uppercase text-stone-400 bg-stone-800 px-1 py-0.2 rounded border border-stone-700">
                Archived
              </span>
            )}
          </div>
          <span
            className={`text-xs font-medium block leading-relaxed break-words whitespace-normal ${
              isArchived
                ? 'text-stone-400 italic group-hover:text-stone-300'
                : 'text-stone-200 group-hover:text-rose-200'
            }`}
          >
            {data.title || 'Untitled Habit'}
          </span>
        </div>
      </div>

      {/* Full-width Collapsible Inline Markdown Notes */}
      <NodeMarkdownSection
        description={data.description}
        onSave={data.onQuickUpdateDescription}
        themeColor="rose"
      />
    </div>
  );
});
