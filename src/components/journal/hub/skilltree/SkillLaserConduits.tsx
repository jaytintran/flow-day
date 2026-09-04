import React, { useState, useEffect, useLayoutEffect } from 'react';
import { SkillNodeItem, ELEMENTAL_THEMES } from './types';
import { TreeConduitLine } from './treeLayout';

interface SkillLaserConduitsProps {
  skills?: SkillNodeItem[];
  conduits?: TreeConduitLine[];
  containerRef?: React.RefObject<HTMLDivElement | null>;
  activeLineageIds?: Set<string>;
  showParticles?: boolean;
}

export function SkillLaserConduits({
  skills = [],
  conduits: directConduits,
  containerRef,
  activeLineageIds = new Set(),
  showParticles = true,
}: SkillLaserConduitsProps) {
  const [measuredConduits, setMeasuredConduits] = useState<TreeConduitLine[]>([]);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  const conduits = directConduits || measuredConduits;

  const calculateConduits = () => {
    if (directConduits || !containerRef?.current) return;
    const containerEl = containerRef.current;
    const containerRect = containerEl.getBoundingClientRect();

    const fullWidth = containerEl.offsetWidth || containerRect.width;
    const fullHeight = containerEl.offsetHeight || containerRect.height;
    setSvgDimensions({ width: fullWidth, height: fullHeight });

    const lines: TreeConduitLine[] = [];
    const skillMap = new Map<string, SkillNodeItem>();
    skills.forEach((s) => skillMap.set(s.id, s));

    skills.forEach((child) => {
      (child.parent_ids || []).forEach((parentId) => {
        const parent = skillMap.get(parentId);
        if (!parent) return;

        const parentEl = containerEl.querySelector(`[data-skill-id="${parent.id}"]`);
        const childEl = containerEl.querySelector(`[data-skill-id="${child.id}"]`);

        if (parentEl && childEl) {
          const pRect = parentEl.getBoundingClientRect();
          const cRect = childEl.getBoundingClientRect();

          const scale = containerEl.offsetWidth > 0 ? containerRect.width / containerEl.offsetWidth : 1;
          const currentScale = scale > 0 ? scale : 1;

          const x1 = (pRect.left + pRect.width / 2 - containerRect.left) / currentScale;
          const y1 = (pRect.top + pRect.height / 2 - containerRect.top) / currentScale;
          const x2 = (cRect.left + cRect.width / 2 - containerRect.left) / currentScale;
          const y2 = (cRect.top + cRect.height / 2 - containerRect.top) / currentScale;

          const isChildMastered = child.rank >= child.maxRank || child.status === 'mastered';
          const isLearning = child.status === 'learning' || child.rank > 0;
          const isHighlighted =
            activeLineageIds.size > 0 &&
            activeLineageIds.has(parent.id) &&
            activeLineageIds.has(child.id);
          const isDimmed = activeLineageIds.size > 0 && !isHighlighted;

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

    setMeasuredConduits(lines);
  };

  useLayoutEffect(() => {
    if (directConduits) return;
    calculateConduits();
    const handleResize = () => calculateConduits();
    window.addEventListener('resize', handleResize);

    let ro: ResizeObserver | null = null;
    if (containerRef?.current) {
      ro = new ResizeObserver(() => calculateConduits());
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      ro?.disconnect();
    };
  }, [skills, activeLineageIds, directConduits]);

  if (conduits.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0 overflow-visible"
      style={{
        width: directConduits ? '100%' : svgDimensions.width || '100%',
        height: directConduits ? '100%' : svgDimensions.height || '100%',
      }}
    >
      {conduits.map((c) => {
        // Compute smooth vertical S-curve bezier path
        const dy = c.y2 - c.y1;
        const cy1 = c.y1 + dy * 0.5;
        const cy2 = c.y2 - dy * 0.5;
        const pathData = `M ${c.x1} ${c.y1} C ${c.x1} ${cy1}, ${c.x2} ${cy2}, ${c.x2} ${c.y2}`;

        const strokeOpacity = c.isDimmed ? 0.15 : c.isHighlighted ? 0.95 : 0.6;
        const strokeWidth = c.isHighlighted ? 2.5 : c.isMastered ? 2 : 1.5;

        return (
          <g key={c.id} className="transition-all duration-200">
            {/* Clean Crisp Laser Filament */}
            <path
              d={pathData}
              fill="none"
              stroke={c.isMastered ? '#f59e0b' : c.isHighlighted ? '#38bdf8' : c.color}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              strokeDasharray={c.isLearning || c.isHighlighted ? '6 4' : undefined}
            />

            {/* Clean Travelling Energy Photons */}
            {showParticles && (c.isLearning || c.isMastered || c.isHighlighted) && !c.isDimmed && (
              <circle
                r={c.isHighlighted ? 3 : 2}
                fill={c.isMastered ? '#fbbf24' : c.color}
              >
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
