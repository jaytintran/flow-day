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
  showAuras?: boolean;
  onSelect: (skill: SkillNodeItem) => void;
  onHover?: (skill: SkillNodeItem | null) => void;
  onQuickLevelUp?: (skill: SkillNodeItem) => void;
}

export function SkillGlyph({
  skill,
  isSelected,
  isHighlighted,
  isDimmed,
  showRankBadges = true,
  showAuras = true,
  onSelect,
  onHover,
  onQuickLevelUp,
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

  // Dynamic Border & Glow based on custom color & status
  const c = skill.color || (isMastered ? 'amber' : isLearning ? 'sky' : 'emerald');
  const themeDef = ELEMENTAL_THEMES.find((t) => t.id === c) || ELEMENTAL_THEMES[0];
  const glowHex = isMastered ? '#f59e0b' : themeDef.glow;

  return (
    <div
      data-skill-id={skill.id}
      onClick={() => onSelect(skill)}
      onMouseEnter={() => onHover?.(skill)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative flex flex-col items-center cursor-pointer select-none transition-all duration-300 transform hover:scale-110 ${
        isDimmed ? 'opacity-25 blur-[0.5px] scale-95' : isHighlighted ? 'scale-105 z-10' : ''
      }`}
    >
      {/* Halo for Mastered, Selected, or Highlighted Lineage */}
      {showAuras && (isMastered || isSelected || isHighlighted) && (
        <div
          className="absolute -inset-2 rounded-full blur-md opacity-70 animate-pulse pointer-events-none"
          style={{ backgroundColor: glowHex }}
        />
      )}

      {/* Outer Socket Medallion */}
      <div
        className={`relative ${sizeClass} rounded-full border-2 flex items-center justify-center transition-all ${
          isLocked ? 'border-stone-800 bg-[#101012] opacity-40 grayscale' : 'bg-[#101014]'
        } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
        style={{
          borderColor: isLocked ? undefined : glowHex,
          boxShadow: isLocked
            ? undefined
            : isMastered
              ? `0 0 25px ${glowHex}80, inset 0 0 15px ${glowHex}40`
              : `0 0 16px ${glowHex}40`,
        }}
      >
        {/* Tier 1 Orbital Ring */}
        {skill.tier === 1 && (
          <div
            className="absolute -inset-2 rounded-full border border-dashed animate-spin-slow pointer-events-none"
            style={{ borderColor: `${glowHex}80` }}
          />
        )}

        {/* Icon or Lock */}
        {isLocked ? (
          <Lock className="w-4 h-4 text-stone-600" />
        ) : (
          <IconComponent
            className={`${
              skill.tier <= 2 ? 'w-7 h-7' : skill.tier === 3 ? 'w-5 h-5' : 'w-4 h-4'
            }`}
            style={{
              color: glowHex,
              filter: `drop-shadow(0 0 6px ${glowHex})`,
            }}
          />
        )}

        {/* Mastered Crown/Sparkle Badge */}
        {showRankBadges && isMastered && (
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-stone-950 rounded-full flex items-center justify-center shadow-md">
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

      {/* Skill Title & Rank Underneath */}
      <div className="mt-2 text-center max-w-[120px]">
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
            <span>{skill.tier === 1 ? 'Core' : skill.tier === 2 ? 'Cluster' : skill.tier === 3 ? 'Topic' : skill.tier === 4 ? 'Ability' : 'Drill'}</span>
          )}
        </p>
      </div>
    </div>
  );
}
