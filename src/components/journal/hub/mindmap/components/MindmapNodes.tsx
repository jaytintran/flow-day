import React, { memo, useState, useRef, useEffect, useContext } from 'react';
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
  FileText,
  X,
} from 'lucide-react';
import { formatDuration } from '../../../../../utils';
import { MindmapActionContext, MindmapNodeData } from '../types';

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

// ─── Multi-Directional Handles ────────────────────────────────────────────────
const UniversalHandles = ({ colorClass = '!bg-amber-400' }: { colorClass?: string }) => (
  <>
    {/* Top */}
    <Handle
      type="target"
      position={Position.Top}
      id="top-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-top-1.5 shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Top}
      id="top-source"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-top-1.5 opacity-0 hover:opacity-100 z-20`}
    />

    {/* Bottom */}
    <Handle
      type="target"
      position={Position.Bottom}
      id="bottom-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-bottom-1.5 shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Bottom}
      id="bottom-source"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-bottom-1.5 opacity-0 hover:opacity-100 z-20`}
    />

    {/* Left */}
    <Handle
      type="target"
      position={Position.Left}
      id="left-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-left-1.5 shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Left}
      id="left-source"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-left-1.5 opacity-0 hover:opacity-100 z-20`}
    />

    {/* Right */}
    <Handle
      type="target"
      position={Position.Right}
      id="right-target"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-right-1.5 shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:scale-125 transition-transform cursor-crosshair z-20`}
    />
    <Handle
      type="source"
      position={Position.Right}
      id="right-source"
      className={`!w-3 !h-3 ${colorClass} !border-2 !border-[#0d0d0d] !-right-1.5 opacity-0 hover:opacity-100 z-20`}
    />
  </>
);

// ─── External Note Badge & Tooltip ──────────────────────────────────────────
const NoteBadgeButton = ({
  rawId,
  description,
  onSave,
}: {
  rawId: string;
  description?: string;
  onSave?: (id: string, notes: string) => Promise<void>;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(description || '');

  useEffect(() => {
    setText(description || '');
  }, [description]);

  const hasNotes = Boolean(description && description.trim().length > 0);

  const commitDesc = async () => {
    setIsEditing(false);
    if (text !== description) {
      await onSave?.(rawId, text);
    }
  };

  return (
    <div
      className="absolute -bottom-3 right-3 z-30"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => {
        if (!isEditing) setShowTooltip(false);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(true);
          setIsEditing(true);
        }}
        className={`w-6 h-6 rounded-full border flex items-center justify-center shadow-lg transition-all cursor-pointer hover:scale-110 active:scale-95 ${
          hasNotes
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
            : 'bg-[#141416] border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-500'
        }`}
        title={hasNotes ? 'Hover to view notes, click to edit' : 'Click to add notes'}
      >
        <FileText className="w-3 h-3" />
      </button>

      {showTooltip && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-7 w-64 p-3 bg-[#121215]/98 backdrop-blur-xl border border-stone-750 rounded-2xl shadow-2xl z-50 text-left animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-stone-800">
            <span className="text-[10px] font-mono uppercase font-bold text-amber-400 flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Notes & Context
            </span>
            <div className="flex items-center gap-1.5">
              {isEditing ? (
                <button
                  type="button"
                  onClick={commitDesc}
                  className="text-[9px] font-mono text-amber-400 hover:text-amber-300 font-bold uppercase cursor-pointer"
                >
                  Save
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-[9px] font-mono text-stone-400 hover:text-stone-200 uppercase cursor-pointer"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowTooltip(false);
                  setIsEditing(false);
                }}
                className="text-stone-500 hover:text-stone-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {isEditing ? (
            <textarea
              autoFocus
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setShowTooltip(false);
                }
              }}
              placeholder="Add thoughts, strategy, or links..."
              className="w-full bg-[#0a0a0c] border border-amber-500/50 rounded-xl p-2 text-xs text-stone-200 font-mono focus:outline-none resize-none leading-relaxed shadow-inner"
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-xs text-stone-300 font-sans leading-relaxed max-h-40 overflow-y-auto cursor-pointer"
            >
              {hasNotes ? (
                text.split('\n').map((line, i) => (
                  <p key={i} className="mb-1 last:mb-0">
                    {line}
                  </p>
                ))
              ) : (
                <span className="text-stone-500 italic text-[11px]">
                  No notes yet. Click to write...
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Unified High-Performance Mindmap Node ───────────────────────────────────
export const MindmapNode = memo(({ data }: NodeProps<any>) => {
  const {
    onInspectNode,
    onQuickRename,
    onQuickUpdateNotes,
    onQuickChangeIcon,
    onToggleCollapse,
    onAddChild,
    onToggleComplete,
    onOpenContextMenu,
  } = useContext(MindmapActionContext);

  const [isEditing, setIsEditing] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [title, setTitle] = useState(data.title || '');

  useEffect(() => {
    setTitle(data.title || '');
  }, [data.title]);

  const commitTitle = async () => {
    setIsEditing(false);
    if (title.trim() && title !== data.title) {
      await onQuickRename?.(data.rawId, title.trim());
    }
  };

  const handleSelectIcon = async (iconName: string) => {
    setShowIconPicker(false);
    await onQuickChangeIcon?.(data.rawId, iconName);
  };

  const tier = data.tier !== undefined ? Math.min(Math.max(data.tier, 0), 4) : 0;
  const isCompleted =
    data.status === 'done' || data.status === 'achieved' || data.status === 'completed';
  const isArchived = data.status === 'archived';
  const timeSpentStr = data.time_spent ? formatDuration(data.time_spent) : null;

  const colorKey = data.color || 'indigo';
  const theme = COLOR_THEMES[colorKey] || COLOR_THEMES.indigo;

  let tierContainerClasses = '';
  let tierTitleClasses = '';
  let iconSizeClasses = '';
  let iconBoxClasses = '';

  switch (tier) {
    case 0:
      tierContainerClasses =
        'px-5 py-3.5 rounded-3xl min-w-[250px] max-w-[380px] border-2 ring-4 ring-amber-500/20 shadow-2xl';
      tierTitleClasses = 'text-sm font-extrabold';
      iconSizeClasses = 'w-5 h-5';
      iconBoxClasses = 'w-9 h-9 rounded-xl';
      break;
    case 1:
      tierContainerClasses =
        'px-4 py-3 rounded-2xl min-w-[220px] max-w-[340px] border-2 shadow-xl';
      tierTitleClasses = 'text-xs font-bold';
      iconSizeClasses = 'w-4 h-4';
      iconBoxClasses = 'w-8 h-8 rounded-xl';
      break;
    case 2:
      tierContainerClasses =
        'px-3.5 py-2.5 rounded-xl min-w-[200px] max-w-[300px] border shadow-lg';
      tierTitleClasses = 'text-xs font-semibold';
      iconSizeClasses = 'w-3.5 h-3.5';
      iconBoxClasses = 'w-7 h-7 rounded-lg';
      break;
    case 3:
      tierContainerClasses =
        'px-3 py-2 rounded-xl min-w-[170px] max-w-[260px] border shadow-md';
      tierTitleClasses = 'text-[11px] font-medium';
      iconSizeClasses = 'w-3 h-3';
      iconBoxClasses = 'w-6 h-6 rounded-md';
      break;
    case 4:
    default:
      tierContainerClasses =
        'px-2.5 py-1.5 rounded-lg min-w-[140px] max-w-[220px] border shadow-sm';
      tierTitleClasses = 'text-[10px] font-medium';
      iconSizeClasses = 'w-2.5 h-2.5';
      iconBoxClasses = 'w-5 h-5 rounded';
      break;
  }

  return (
    <div
      onClick={() => onInspectNode?.(data.rawId)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenContextMenu?.(e, data.rawId);
      }}
      className={`group relative transition-all cursor-pointer select-none ${tierContainerClasses} ${
        isArchived
          ? 'bg-gradient-to-br from-[#141416] to-[#0c0c0e] border-stone-700/60 opacity-60 shadow-none'
          : isCompleted
            ? 'bg-gradient-to-br from-[#0c1a14]/90 to-[#08120e]/90 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : `${theme.bgGradient} ${theme.border} ${tier === 0 ? theme.glow : ''}`
      } ${data.isDimmed ? 'opacity-35 hover:opacity-100' : 'opacity-100'}`}
    >
      <UniversalHandles
        colorClass={
          isArchived ? '!bg-stone-500' : isCompleted ? '!bg-emerald-400' : theme.handleBg
        }
      />

      <div className={`flex items-start ${tier >= 3 ? 'gap-2' : 'gap-2.5'}`}>
        <div className="relative">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowIconPicker((prev) => !prev);
            }}
            className={`${iconBoxClasses} border flex items-center justify-center shrink-0 shadow-sm mt-0.5 transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
              isArchived
                ? 'bg-stone-800/60 border-stone-700 text-stone-400'
                : isCompleted
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : `${theme.iconBg} ${theme.iconBorder} ${theme.iconText}`
            }`}
            title="Click to select a different icon"
          >
            {isCompleted ? (
              <CheckCircle2 className={`${iconSizeClasses} text-emerald-400`} />
            ) : (
              renderLucideIcon(data.icon, tier === 0 ? 'Compass' : 'Target', iconSizeClasses)
            )}
          </div>

          {showIconPicker && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-10 w-56 p-2 bg-[#141418]/98 backdrop-blur-2xl border border-stone-750 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-stone-800">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-300">
                  Select Icon
                </span>
                <button
                  type="button"
                  onClick={() => setShowIconPicker(false)}
                  className="text-stone-400 hover:text-stone-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto p-1 scrollbar-none">
                {Object.keys(LUCIDE_ICONS).map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => handleSelectIcon(iconName)}
                    className={`p-1.5 rounded-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-125 ${
                      data.icon === iconName
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
                    }`}
                    title={iconName}
                  >
                    {renderLucideIcon(iconName, 'Target', 'w-4 h-4')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-mono uppercase tracking-wider font-bold leading-tight ${
                  tier >= 3 ? 'text-[8px]' : 'text-[9px]'
                } ${
                  isArchived ? 'text-stone-400' : isCompleted ? 'text-emerald-400' : theme.badgeText
                }`}
              >
                {data.typeName || data.type}
              </span>
              {isCompleted && (
                <span className="text-[7px] font-mono font-bold uppercase text-emerald-300 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/40">
                  ✓ Done
                </span>
              )}
            </div>

            {timeSpentStr && tier < 4 && (
              <span
                className={`text-[8px] font-mono px-1 py-0.5 rounded border shrink-0 ${
                  isArchived
                    ? 'text-stone-400 bg-stone-800/40 border-stone-700/40'
                    : isCompleted
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : `${theme.badgeText} ${theme.badgeBg} ${theme.badgeBorder}`
                }`}
              >
                ⏳ {timeSpentStr}
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
              className={`w-full bg-[#0a0a0a] border rounded px-1.5 py-0.5 text-xs font-semibold text-stone-100 focus:outline-none resize-none ${
                isCompleted ? 'border-emerald-500/50' : 'border-amber-500/50'
              }`}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={`${tierTitleClasses} block leading-snug break-words whitespace-normal ${
                isArchived
                  ? 'text-stone-400 italic'
                  : isCompleted
                    ? 'text-stone-300 line-through'
                    : 'text-stone-100 group-hover:text-stone-200'
              }`}
              title="Double click to edit title"
            >
              {data.title || `Untitled ${data.typeName || data.type}`}
            </span>
          )}
        </div>
      </div>

      <NoteBadgeButton
        rawId={data.rawId}
        description={data.description}
        onSave={onQuickUpdateNotes}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddChild?.(data.rawId);
        }}
        className="opacity-0 group-hover:opacity-100 absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer z-30 font-bold"
        title="Quick add child branch (or press Tab)"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

export const mindmapNodeTypes = {
  mindmap: MindmapNode,
  purpose: MindmapNode,
  domain: MindmapNode,
  goal: MindmapNode,
  objective: MindmapNode,
  habit: MindmapNode,
  generic: MindmapNode,
  custom: MindmapNode,
};
