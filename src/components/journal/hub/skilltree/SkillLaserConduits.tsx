import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { SkillNodeItem, ELEMENTAL_THEMES } from './types';

interface SkillLaserConduitsProps {
  skills: SkillNodeItem[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeLineageIds: Set<string>;
  showParticles?: boolean;
}

interface ConduitLine {
  id: string;
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  isMastered: boolean;
  isLearning: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
}

export function SkillLaserConduits({
  skills,
  containerRef,
  activeLineageIds,
  showParticles = true,
}: SkillLaserConduitsProps) {
  const [conduits, setConduits] = useState<ConduitLine[]>([]);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  const calculateConduits = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft || 0;
    const scrollTop = containerRef.current.scrollTop || 0;

    const fullWidth = containerRef.current.scrollWidth || containerRect.width;
    const fullHeight = containerRef.current.scrollHeight || containerRect.height;
    setSvgDimensions({ width: fullWidth, height: fullHeight });

    const lines: ConduitLine[] = [];
    const skillMap = new Map<string, SkillNodeItem>();
    skills.forEach((s) => skillMap.set(s.id, s));

    skills.forEach((child) => {
      (child.parent_ids || []).forEach((parentId) => {
        const parent = skillMap.get(parentId);
        if (!parent) return;

        const parentEl = containerRef.current?.querySelector(`[data-skill-id="${parent.id}"]`);
        const childEl = containerRef.current?.querySelector(`[data-skill-id="${child.id}"]`);

        if (parentEl && childEl) {
          const pRect = parentEl.getBoundingClientRect();
          const cRect = childEl.getBoundingClientRect();

          // Coordinates relative to the scrollable container's content space
          const x1 = pRect.left - containerRect.left + scrollLeft + pRect.width / 2;
          const y1 = pRect.top - containerRect.top + scrollTop + pRect.height / 2;
          const x2 = cRect.left - containerRect.left + scrollLeft + cRect.width / 2;
          const y2 = cRect.top - containerRect.top + scrollTop + cRect.height / 2;

          const isChildMastered = child.rank >= child.maxRank || child.status === 'mastered';
          const isLearning = child.status === 'learning' || child.rank > 0;
          const isHighlighted =
            activeLineageIds.size > 0 &&
            activeLineageIds.has(parent.id) &&
            activeLineageIds.has(child.id);
          const isDimmed = activeLineageIds.size > 0 && !isHighlighted;

          // Resolve conduit laser color from 24 themes
          const c = child.color || parent.color || 'sky';
          const themeDef = ELEMENTAL_THEMES.find((t) => t.id === c);
          const colorHex = isChildMastered
            ? '#f59e0b'
            : themeDef?.glow || '#38bdf8';

          lines.push({
            id: `conduit-${parent.id}-${child.id}`,
            sourceId: parent.id,
            targetId: child.id,
            x1,
            y1,
            x2,
            y2,
            color: colorHex,
            isMastered: isChildMastered,
            isLearning,
            isHighlighted,
            isDimmed,
          });
        }
      });
    });

    setConduits(lines);
  };

  useLayoutEffect(() => {
    calculateConduits();
    const handleResize = () => calculateConduits();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [skills, activeLineageIds]);

  useEffect(() => {
    // Recalculate on DOM mutation or image load
    const timer = setTimeout(calculateConduits, 100);
    return () => clearTimeout(timer);
  }, [skills]);

  if (conduits.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        width: svgDimensions.width || '100%',
        height: svgDimensions.height || '100%',
      }}
    >
      <defs>
        {/* Glow Filters */}
        <filter id="laser-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="intense-laser-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur1" />
          <feGaussianBlur stdDeviation="2" result="blur2" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {conduits.map((c) => {
        // Compute smooth vertical S-curve bezier path
        const dy = c.y2 - c.y1;
        const cy1 = c.y1 + dy * 0.5;
        const cy2 = c.y2 - dy * 0.5;
        const pathData = `M ${c.x1} ${c.y1} C ${c.x1} ${cy1}, ${c.x2} ${cy2}, ${c.x2} ${c.y2}`;

        const strokeOpacity = c.isDimmed ? 0.15 : c.isHighlighted ? 1 : 0.65;
        const strokeWidth = c.isHighlighted ? 3.5 : c.isMastered ? 2.5 : 2;

        return (
          <g key={c.id} className="transition-all duration-300">
            {/* Outer Diffuse Neon Halo */}
            <path
              d={pathData}
              fill="none"
              stroke={c.color}
              strokeWidth={strokeWidth + 4}
              strokeOpacity={strokeOpacity * 0.35}
              filter="url(#intense-laser-glow)"
            />

            {/* Core Laser Filament */}
            <path
              d={pathData}
              fill="none"
              stroke={c.isMastered || c.isHighlighted ? '#ffffff' : c.color}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              filter="url(#laser-glow)"
              strokeDasharray={c.isLearning || c.isHighlighted ? '8 6' : undefined}
              className={c.isLearning || c.isHighlighted ? 'animate-pulse' : ''}
            />

            {/* Animated Travelling Energy Photons (Particle pulses flowing down the conduit) */}
            {showParticles && (c.isLearning || c.isMastered || c.isHighlighted) && !c.isDimmed && (
              <circle r={c.isHighlighted ? 4 : 3} fill={c.color} filter="url(#laser-glow)">
                <animateMotion
                  path={pathData}
                  dur={c.isHighlighted ? '1.8s' : '3s'}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
