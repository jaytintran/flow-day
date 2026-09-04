import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { SkillNodeItem, SkillViewSettings, ELEMENTAL_THEMES } from './types';
import { SkillGlyph } from './SkillGlyph';

interface SkillGlobeCanvasProps {
  skills: SkillNodeItem[];
  selectedSkill: SkillNodeItem | null;
  activeLineageIds: Set<string>;
  viewSettings: SkillViewSettings;
  onSelect: (skill: SkillNodeItem) => void;
  onHover: (skill: SkillNodeItem | null) => void;
  onContextMenu?: (skill: SkillNodeItem, e: React.MouseEvent) => void;
  onIconClick?: (skill: SkillNodeItem, e: React.MouseEvent) => void;
}

interface PositionedGlobeNode {
  skill: SkillNodeItem;
  x: number;
  y: number;
  angle: number;
  tier: number;
  systemCenter: { x: number; y: number };
  systemColor: string;
}

interface SolarSystemData {
  core: SkillNodeItem;
  systemIndex: number;
  centerX: number;
  centerY: number;
  nodes: PositionedGlobeNode[];
  colorHex: string;
  dynamicRadii?: Record<number, number>;
}

// Radii for concentric planetary orbits from system center
const ORBIT_RADII: Record<number, number> = {
  1: 0,    // Core Sun (Exact Center 0, 0)
  2: 175,  // Tier 2 Major Clusters (Inner Planet Ring)
  3: 310,  // Tier 3 Topics (Habitable Zone Orbit)
  4: 435,  // Tier 4 Micro-Abilities (Outer Satellite Belt)
  5: 540,  // Tier 5 Drills / Katas (Celestial Kuiper Belt)
};

// Keplerian Orbital Revolution Speeds (seconds per full 360 deg turn)
const ORBIT_SPEEDS: Record<number, number> = {
  2: 120, // Inner orbit: 1 full turn per 120s
  3: 200, // Middle orbit: 1 full turn per 200s
  4: 300, // Outer orbit: 1 full turn per 300s
  5: 420, // Kuiper belt: 1 full turn per 420s
};

export function SkillGlobeCanvas({
  skills,
  selectedSkill,
  activeLineageIds,
  viewSettings,
  onSelect,
  onHover,
  onContextMenu,
  onIconClick,
}: SkillGlobeCanvasProps) {
  // Keplerian Orbital Revolution time tracking
  const [isOrbiting, setIsOrbiting] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const lastTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-pause revolution when inspecting a skill in Grimoire
  const isPaused = !isOrbiting || !!selectedSkill;

  useEffect(() => {
    const updateOrbit = (time: number) => {
      if (lastTimeRef.current !== null && !isPaused) {
        const delta = (time - lastTimeRef.current) / 1000;
        setElapsedTime((prev) => prev + delta);
      }
      lastTimeRef.current = time;
      animationFrameRef.current = requestAnimationFrame(updateOrbit);
    };

    animationFrameRef.current = requestAnimationFrame(updateOrbit);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPaused]);

  // Identify Core Keystones (Tier 1 nodes) or fallback to root nodes
  const systemsData = useMemo<SolarSystemData[]>(() => {
    const coreNodes = skills.filter((s) => s.tier === 1);
    const effectiveCores =
      coreNodes.length > 0 ? coreNodes : skills.filter((s) => s.parent_ids.length === 0);

    if (effectiveCores.length === 0 && skills.length > 0) {
      effectiveCores.push(skills[0]);
    }

    if (effectiveCores.length === 0) return [];

    const systemSpacing = 1100;
    const totalSystems = effectiveCores.length;

    return effectiveCores.map((core, sysIdx) => {
      const centerX = totalSystems === 1 ? 0 : (sysIdx - (totalSystems - 1) / 2) * systemSpacing;
      const centerY = 0;

      // Find all descendant skills belonging to this core system
      const systemSkillIds = new Set<string>([core.id]);
      let added = true;
      while (added) {
        added = false;
        skills.forEach((s) => {
          if (!systemSkillIds.has(s.id)) {
            const hasParentInSys = (s.parent_ids || []).some((pid) => systemSkillIds.has(pid));
            if (hasParentInSys) {
              systemSkillIds.add(s.id);
              added = true;
            }
          }
        });
      }

      const systemSkills = skills.filter((s) => systemSkillIds.has(s.id));
      const tierGroups: Record<number, SkillNodeItem[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      systemSkills.forEach((s) => {
        if (s.id === core.id) {
          tierGroups[1].push(s);
        } else {
          const t = Math.min(5, Math.max(2, s.tier));
          tierGroups[t].push(s);
        }
      });

      const t2Count = tierGroups[2].length;
      const t3Count = tierGroups[3].length;
      const t4Count = tierGroups[4].length;
      const t5Count = tierGroups[5].length;

      const minRadiusT2 = Math.max(175, Math.round((t2Count * 85) / (2 * Math.PI)));
      const minRadiusT3 = Math.max(minRadiusT2 + 130, Math.round((t3Count * 75) / (2 * Math.PI)));
      const minRadiusT4 = Math.max(minRadiusT3 + 125, Math.round((t4Count * 65) / (2 * Math.PI)));
      const minRadiusT5 = Math.max(minRadiusT4 + 115, Math.round((t5Count * 55) / (2 * Math.PI)));

      const dynamicRadii: Record<number, number> = {
        1: 0,
        2: minRadiusT2,
        3: minRadiusT3,
        4: minRadiusT4,
        5: minRadiusT5,
      };

      const baseNodeAngles = new Map<string, number>();

      const t2Nodes = tierGroups[2];
      t2Nodes.forEach((node, idx) => {
        const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / (t2Count || 1);
        baseNodeAngles.set(node.id, angle);
      });

      const distributeTier = (tierNum: number) => {
        const nodes = tierGroups[tierNum];
        const byParent = new Map<string, SkillNodeItem[]>();
        nodes.forEach((n) => {
          const pId = n.parent_ids.find((pid) => systemSkillIds.has(pid)) || core.id;
          const list = byParent.get(pId) || [];
          list.push(n);
          byParent.set(pId, list);
        });

        byParent.forEach((children, pId) => {
          const parentAngle = baseNodeAngles.get(pId) ?? -Math.PI / 2;
          const count = children.length;

          if (count === 1) {
            baseNodeAngles.set(children[0].id, parentAngle);
          } else {
            const maxSpread = Math.min(Math.PI * 0.55, ((2 * Math.PI) / (t2Count || 1)) * 0.9);
            const step = maxSpread / (count - 1);
            children.forEach((child, cIdx) => {
              const angle = parentAngle - maxSpread / 2 + cIdx * step;
              baseNodeAngles.set(child.id, angle);
            });
          }
        });
      };

      distributeTier(3);
      distributeTier(4);
      distributeTier(5);

      const positionedNodes: PositionedGlobeNode[] = [];

      positionedNodes.push({
        skill: core,
        x: centerX,
        y: centerY,
        angle: 0,
        tier: 1,
        systemCenter: { x: centerX, y: centerY },
        systemColor: core.color || 'amber',
      });

      [2, 3, 4, 5].forEach((tier) => {
        const nodes = tierGroups[tier];
        const baseRadius = dynamicRadii[tier];
        const speed = ORBIT_SPEEDS[tier] || 180;
        const rotationOffset = (elapsedTime * (2 * Math.PI)) / speed;
        const shouldStagger = nodes.length > (tier === 2 ? 6 : 8);

        nodes.forEach((node, nodeIdx) => {
          let baseAngle = baseNodeAngles.get(node.id);
          if (baseAngle === undefined) {
            baseAngle = -Math.PI / 2 + (nodeIdx * 2 * Math.PI) / (nodes.length || 1);
          }

          const currentAngle = baseAngle + rotationOffset;
          const staggerOffset = shouldStagger ? (nodeIdx % 2 === 0 ? -16 : 16) : 0;
          const radius = baseRadius + staggerOffset;

          const nx = centerX + Math.cos(currentAngle) * radius;
          const ny = centerY + Math.sin(currentAngle) * radius;

          positionedNodes.push({
            skill: node,
            x: nx,
            y: ny,
            angle: currentAngle,
            tier,
            systemCenter: { x: centerX, y: centerY },
            systemColor: node.color || core.color || 'sky',
          });
        });
      });

      const themeDef = ELEMENTAL_THEMES.find((t) => t.id === core.color) || ELEMENTAL_THEMES[0];

      return {
        core,
        systemIndex: sysIdx,
        centerX,
        centerY,
        dynamicRadii,
        nodes: positionedNodes,
        colorHex: themeDef.glow,
      };
    });
  }, [skills, elapsedTime]);

  const totalSystems = systemsData.length || 1;
  const systemSpacing = 1100;
  const galaxyWidth = Math.max(1400, totalSystems * systemSpacing + 400);
  const galaxyHeight = 1400;

  const stardustParticles = useMemo(() => {
    const particles: Array<{ x: number; y: number; r: number; opacity: number; orbit: number; angle: number }> = [];
    [2, 3, 4, 5].forEach((tier) => {
      const radius = ORBIT_RADII[tier];
      const count = tier * 10;
      for (let i = 0; i < count; i++) {
        const angle = (i * 2 * Math.PI) / count + (i % 3) * 0.1;
        const rOffset = (Math.sin(i * 99) * 6);
        const r = radius + rOffset;
        particles.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          r: 0.7 + (i % 3) * 0.5,
          opacity: 0.2 + (i % 4) * 0.1,
          orbit: tier,
          angle,
        });
      }
    });
    return particles;
  }, []);

  return (
    <div
      className="relative flex items-center justify-center pointer-events-auto select-none"
      style={{
        width: `${galaxyWidth}px`,
        height: `${galaxyHeight}px`,
      }}
    >
      {/* Orbital Orbit/Pause HUD Floating Pill */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3 py-1.5 bg-[#0e0e12]/90 border border-stone-800 backdrop-blur-xl rounded-xl text-xs font-mono shadow-xl">
        <button
          onClick={() => setIsOrbiting((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
            isOrbiting
              ? 'text-sky-300 bg-sky-500/15 border border-sky-500/30'
              : 'text-amber-300 bg-amber-500/15 border border-amber-500/30'
          }`}
          title={isOrbiting ? 'Pause Orbital Motion' : 'Resume Planetary Revolution'}
        >
          {isOrbiting ? (
            <>
              <Pause className="w-3 h-3 text-sky-400" />
              <span>Orbiting</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Paused</span>
            </>
          )}
        </button>
        <span className="text-[10px] text-stone-500 font-sans">• Keplerian Revolution</span>
      </div>

      <svg
        className="w-full h-full overflow-visible"
        viewBox={`-${galaxyWidth / 2} -${galaxyHeight / 2} ${galaxyWidth} ${galaxyHeight}`}
        style={{ width: `${galaxyWidth}px`, height: `${galaxyHeight}px` }}
      >
        {systemsData.map((sys) => (
          <g key={`sys-${sys.core.id}`}>
            {/* Center Keystone Accent Ring */}
            <circle
              cx={sys.centerX}
              cy={sys.centerY}
              r={56}
              fill="none"
              stroke={sys.colorHex}
              strokeWidth="1"
              strokeDasharray="4 4"
              strokeOpacity="0.25"
            />

            {/* Concentric Planetary Orbital Rings */}
            {[2, 3, 4, 5].map((tier) => {
              const r = sys.dynamicRadii?.[tier] || ORBIT_RADII[tier];
              const nodesInTier = sys.nodes.filter((n) => n.tier === tier);
              const isCrowded = nodesInTier.length > (tier === 2 ? 6 : 8);

              return (
                <g key={`orbit-${sys.core.id}-t${tier}`}>
                  {isCrowded ? (
                    <>
                      <circle
                        cx={sys.centerX}
                        cy={sys.centerY}
                        r={r - 16}
                        fill="none"
                        stroke={sys.colorHex}
                        strokeWidth="1"
                        strokeDasharray="3 6"
                        strokeOpacity="0.15"
                      />
                      <circle
                        cx={sys.centerX}
                        cy={sys.centerY}
                        r={r + 16}
                        fill="none"
                        stroke={sys.colorHex}
                        strokeWidth="1"
                        strokeDasharray="3 6"
                        strokeOpacity="0.15"
                      />
                    </>
                  ) : (
                    <circle
                      cx={sys.centerX}
                      cy={sys.centerY}
                      r={r}
                      fill="none"
                      stroke={sys.colorHex}
                      strokeWidth="1"
                      strokeDasharray="4 8"
                      strokeOpacity="0.2"
                    />
                  )}

                  {/* Radial Crosshairs */}
                  <line
                    x1={sys.centerX - r}
                    y1={sys.centerY}
                    x2={sys.centerX + r}
                    y2={sys.centerY}
                    stroke={sys.colorHex}
                    strokeWidth="0.5"
                    strokeOpacity="0.06"
                    strokeDasharray="2 6"
                  />
                  <line
                    x1={sys.centerX}
                    y1={sys.centerY - r}
                    x2={sys.centerX}
                    y2={sys.centerY + r}
                    stroke={sys.colorHex}
                    strokeWidth="0.5"
                    strokeOpacity="0.06"
                    strokeDasharray="2 6"
                  />

                  {/* Orbit Label in ring gutter */}
                  {viewSettings.showTierBanners && (
                    <text
                      x={sys.centerX}
                      y={sys.centerY - (isCrowded ? r + 24 : r + 8)}
                      fill={sys.colorHex}
                      fillOpacity="0.4"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="select-none tracking-widest uppercase"
                    >
                      {tier === 2
                        ? `Orbit II • Clusters (${nodesInTier.length})`
                        : tier === 3
                          ? `Orbit III • Topics (${nodesInTier.length})`
                          : tier === 4
                            ? `Orbit IV • Abilities (${nodesInTier.length})`
                            : `Orbit V • Katas (${nodesInTier.length})`}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Drifting Stardust Streams */}
            {stardustParticles.map((pt, pIdx) => {
              const r = sys.dynamicRadii?.[pt.orbit] || ORBIT_RADII[pt.orbit];
              const speed = ORBIT_SPEEDS[pt.orbit] || 180;
              const rot = (elapsedTime * (2 * Math.PI)) / speed;
              const px = sys.centerX + Math.cos(pt.angle + rot) * r;
              const py = sys.centerY + Math.sin(pt.angle + rot) * r;
              return (
                <circle
                  key={`stardust-${sys.core.id}-${pIdx}`}
                  cx={px}
                  cy={py}
                  r={pt.r}
                  fill={sys.colorHex}
                  opacity={pt.opacity}
                />
              );
            })}

            {/* Clean Curved Laser Filaments */}
            {viewSettings.showConduits &&
              sys.nodes.map((nodeItem) => {
                const child = nodeItem.skill;
                return (child.parent_ids || []).map((parentId) => {
                  const parentItem = sys.nodes.find((n) => n.skill.id === parentId);
                  if (!parentItem) return null;

                  const isChildMastered = child.rank >= child.maxRank || child.status === 'mastered';
                  const isLearning = child.status === 'learning' || child.rank > 0;
                  const isHighlighted =
                    activeLineageIds.size > 0 &&
                    activeLineageIds.has(parentItem.skill.id) &&
                    activeLineageIds.has(child.id);
                  const isDimmed = activeLineageIds.size > 0 && !isHighlighted;

                  const themeDef =
                    ELEMENTAL_THEMES.find((t) => t.id === (child.color || parentItem.skill.color)) ||
                    ELEMENTAL_THEMES[0];
                  const filamentColor = isChildMastered ? '#f59e0b' : themeDef.glow;

                  const midX = (parentItem.x + nodeItem.x) / 2;
                  const midY = (parentItem.y + nodeItem.y) / 2;
                  const pullFactor = 0.18;
                  const ctrlX = midX + (sys.centerX - midX) * pullFactor;
                  const ctrlY = midY + (sys.centerY - midY) * pullFactor;

                  const pathData = `M ${parentItem.x} ${parentItem.y} Q ${ctrlX} ${ctrlY} ${nodeItem.x} ${nodeItem.y}`;
                  const strokeOpacity = isDimmed ? 0.15 : isHighlighted ? 0.95 : 0.6;
                  const strokeWidth = isHighlighted ? 2.5 : isChildMastered ? 2 : 1.5;

                  return (
                    <g key={`filament-${parentItem.skill.id}-${child.id}`}>
                      {/* Clean Laser Filament */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isChildMastered ? '#f59e0b' : isHighlighted ? '#38bdf8' : filamentColor}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        strokeDasharray={isLearning || isHighlighted ? '6 4' : undefined}
                      />
                      {/* Animated Photons */}
                      {viewSettings.showParticles &&
                        (isLearning || isChildMastered || isHighlighted) &&
                        !isDimmed && (
                          <circle
                            r={isHighlighted ? 3 : 2}
                            fill={isChildMastered ? '#fbbf24' : filamentColor}
                          >
                            <animateMotion
                              path={pathData}
                              dur={isHighlighted ? '1.2s' : '2.2s'}
                              repeatCount="indefinite"
                            />
                          </circle>
                        )}
                    </g>
                  );
                });
              })}

            {/* Render Node Medallions via SVG ForeignObject */}
            {sys.nodes.map((n) => (
              <foreignObject
                key={`node-fo-${n.skill.id}`}
                x={n.x - 70}
                y={n.y - 70}
                width={140}
                height={140}
                className="overflow-visible"
              >
                <div className="w-full h-full flex items-center justify-center pointer-events-auto">
                  <SkillGlyph
                    skill={n.skill}
                    isSelected={selectedSkill?.id === n.skill.id}
                    isHighlighted={activeLineageIds.has(n.skill.id)}
                    isDimmed={activeLineageIds.size > 0 && !activeLineageIds.has(n.skill.id)}
                    showRankBadges={viewSettings.showRankBadges}
                    onSelect={onSelect}
                    onHover={onHover}
                    onContextMenu={onContextMenu}
                    onIconClick={onIconClick}
                  />
                </div>
              </foreignObject>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
