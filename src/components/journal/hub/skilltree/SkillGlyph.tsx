import React from 'react';
import * as Icons from 'lucide-react';
import { Lock, Sparkles, Check, Flame, ShieldCheck, Zap } from 'lucide-react';
import { SkillNodeItem, ELEMENTAL_THEMES } from './types';

interface SkillGlyphProps {
  skill: SkillNodeItem;
  isSelected: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  showRankBadges?: boolean;
  isWiringSource?: boolean;
  isWiringTarget?: boolean;
  isWiringInvalid?: boolean;
  onSelect: (skill: SkillNodeItem) => void;
  onHover?: (skill: SkillNodeItem | null) => void;
  onContextMenu?: (skill: SkillNodeItem, e: React.MouseEvent) => void;
  onIconClick?: (skill: SkillNodeItem, e: React.MouseEvent) => void;
  onNodePointerDown?: (skill: SkillNodeItem, e: React.PointerEvent) => void;
}

export function SkillGlyph({
  skill,
  isSelected,
  isHighlighted,
  isDimmed,
  showRankBadges = true,
  isWiringSource,
  isWiringTarget,
  isWiringInvalid,
  onSelect,
  onHover,
  onContextMenu,
  onIconClick,
  onNodePointerDown,
}: SkillGlyphProps) {
  // Dynamically resolve lucide icon
  const IconComponent = (Icons as any)[skill.icon || 'Sparkles'] || Icons.Sparkles;

  const isMastered = skill.rank >= skill.maxRank || skill.status === 'mastered';
  const isLocked = skill.status === 'locked';
  const isAvailable = skill.status === 'available';
  const isLearning = skill.status === 'learning';

  // Sizing by Tier
  // Tier 1: Core Keystone (68px)
  // Tier 2: Major Cluster (56px)
  // Tier 3: Topic / Library (48px)
  // Tier 4: Micro-concept / Ability (40px)
  // Tier 5: Drill / Kata (34px)
  const sizeClass =
    skill.tier === 1
      ? 'w-18 h-18 text-2xl'
      : skill.tier === 2
        ? 'w-15 h-15 text-xl'
        : skill.tier === 3
          ? 'w-13 h-13 text-lg'
          : skill.tier === 4
            ? 'w-11 h-11 text-base'
            : 'w-9 h-9 text-sm';

  // Dynamic Theme Colors
  const c = skill.color || (isMastered ? 'amber' : isLearning ? 'sky' : 'emerald');
  const themeDef = ELEMENTAL_THEMES.find((t) => t.id === c) || ELEMENTAL_THEMES[0];
  const colorHex = isMastered ? '#f59e0b' : themeDef.glow;

  return (
    <div
      data-skill-id={skill.id}
      onClick={() => onSelect(skill)}
      onPointerDown={(e) => {
        if (onNodePointerDown) {
          onNodePointerDown(skill, e);
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(skill, e);
        }
      }}
      onMouseEnter={() => onHover?.(skill)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative flex items-center justify-center cursor-pointer select-none transition-transform duration-200 transform hover:scale-105 ${
        isDimmed ? 'opacity-30 scale-95' : isHighlighted ? 'scale-105 z-10' : ''
      } ${isWiringTarget ? 'scale-115 z-30' : ''} ${isWiringSource ? 'scale-110 z-20' : ''}`}
    >
      {/* Outer Socket Medallion (Centered, Clean High-Contrast Borders) */}
      <div
        className={`relative ${sizeClass} rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          isLocked
            ? 'border-stone-800 bg-[#101012] opacity-40 grayscale'
            : isMastered
              ? 'border-amber-400 bg-[#161410]'
              : 'bg-[#121216]'
        } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105' : ''} ${
          isHighlighted ? 'ring-1 ring-amber-400/60 ring-offset-1 ring-offset-black' : ''
        } ${
          isWiringTarget
            ? isWiringInvalid
              ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-black animate-pulse'
              : 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black scale-110'
            : isWiringSource
              ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black'
              : ''
        }`}
        style={{
          borderColor: isLocked
            ? undefined
            : isWiringTarget
              ? isWiringInvalid
                ? '#f43f5e'
                : '#10b981'
              : isWiringSource
                ? '#f59e0b'
                : isMastered
                  ? '#f59e0b'
                  : colorHex,
        }}
      >
        {/* Tier 1 Subtle Accent Ring */}
        {skill.tier === 1 && (
          <div
            className="absolute -inset-1.5 rounded-full border border-dashed pointer-events-none opacity-50"
            style={{ borderColor: isMastered ? '#f59e0b' : colorHex }}
          />
        )}

        {/* Icon or Lock */}
        {isLocked ? (
          <Lock className="w-4 h-4 text-stone-600 pointer-events-none" />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center pointer-events-none">
            <IconComponent
              className={`${
                skill.tier <= 2 ? 'w-7 h-7' : skill.tier === 3 ? 'w-5 h-5' : 'w-4 h-4'
              }`}
              style={{
                color: isMastered ? '#fbbf24' : colorHex,
              }}
            />
          </div>
        )}

        {/* Mastered Crown/Sparkle Badge */}
        {showRankBadges && isMastered && (
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-stone-950 rounded-full flex items-center justify-center shadow-md pointer-events-none">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        )}

        {/* Rank Pip Badge for In-Progress Skills */}
        {showRankBadges && !isLocked && !isMastered && (
          <div className="absolute -bottom-1.5 bg-[#121214] border border-stone-700 px-1 py-0.2 rounded-full text-[9px] font-mono font-bold text-stone-300 shadow-sm">
            {skill.rank}/{skill.maxRank}
          </div>
        )}
      </div>

      {/* Skill Title & Rank Label Positioned Absolutely Below the Medallion Center */}
      <div className="absolute top-full pt-1.5 left-1/2 -translate-x-1/2 text-center w-32 pointer-events-none">
        <p
          className={`text-[11px] font-mono font-semibold tracking-wide truncate ${
            isMastered
              ? 'text-amber-300 font-bold'
              : isLearning
                ? 'text-sky-200'
                : isAvailable
                  ? 'text-stone-300'
                  : 'text-stone-600'
          }`}
        >
          {skill.title}
        </p>

        {/* Mini status indicator */}
        <p className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">
          {isMastered ? (
            <span className="text-amber-400 font-bold">★ MASTERED</span>
          ) : isLocked ? (
            <span>Locked</span>
          ) : (
            <span>
              {skill.tier === 1
                ? 'Core'
                : skill.tier === 2
                  ? 'Cluster'
                  : skill.tier === 3
                    ? 'Topic'
                    : skill.tier === 4
                      ? 'Ability'
                      : 'Drill'}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
