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

      const baseNodeAngles = new Map<string, number>();

      // 1. Distribute Tier 2 Clusters evenly around 360 degrees
      const t2Nodes = tierGroups[2];
      const t2Count = t2Nodes.length;
      t2Nodes.forEach((node, idx) => {
        const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / (t2Count || 1);
        baseNodeAngles.set(node.id, angle);
      });

      // 2. Distribute Tier 3, 4, 5 radiating out from their parent angles
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
            const maxSpread = Math.min(Math.PI * 0.45, ((2 * Math.PI) / (t2Count || 1)) * 0.85);
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

      // Compute live coordinates with Keplerian orbital rotation
      const positionedNodes: PositionedGlobeNode[] = [];

      // Add Core Sun at EXACT Center (0, 0)
      positionedNodes.push({
        skill: core,
        x: centerX,
        y: centerY,
        angle: 0,
        tier: 1,
        systemCenter: { x: centerX, y: centerY },
        systemColor: core.color || 'amber',
      });

      // Add orbiting satellites with live rotation delta
      [2, 3, 4, 5].forEach((tier) => {
        const nodes = tierGroups[tier];
        const radius = ORBIT_RADII[tier];
        const speed = ORBIT_SPEEDS[tier] || 180;
        // Rotation offset in radians based on elapsed orbital time
        const rotationOffset = (elapsedTime * (2 * Math.PI)) / speed;

        nodes.forEach((node, nodeIdx) => {
          let baseAngle = baseNodeAngles.get(node.id);
          if (baseAngle === undefined) {
            baseAngle = -Math.PI / 2 + (nodeIdx * 2 * Math.PI) / (nodes.length || 1);
          }

          const currentAngle = baseAngle + rotationOffset;
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
        nodes: positionedNodes,
        colorHex: themeDef.glow,
      };
    });
  }, [skills, elapsedTime]);

  const totalSystems = systemsData.length || 1;
  const systemSpacing = 1100;
  const galaxyWidth = Math.max(1400, totalSystems * systemSpacing + 400);
  const galaxyHeight = 1400;

  // Stardust Particle Belt along orbital paths
  const stardustParticles = useMemo(() => {
    const particles: Array<{ x: number; y: number; r: number; opacity: number; orbit: number; angle: number }> = [];
    [2, 3, 4, 5].forEach((tier) => {
      const radius = ORBIT_RADII[tier];
      const count = tier * 12; // 24 to 60 stardust specks per orbit
      for (let i = 0; i < count; i++) {
        const angle = (i * 2 * Math.PI) / count + (i % 3) * 0.1;
        const rOffset = (Math.sin(i * 99) * 8); // slight drift from center line
        const r = radius + rOffset;
        particles.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          r: 0.8 + (i % 3) * 0.6,
          opacity: 0.15 + (i % 5) * 0.1,
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
        <defs>
          <filter id="globe-laser-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur1" />
            <feGaussianBlur stdDeviation="1.5" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Living Pulsing Solar Flare Shaders */}
          <radialGradient id="sun-core-pulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
            <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#d97706" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sun-outer-flare" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {systemsData.map((sys) => (
          <g key={`sys-${sys.core.id}`}>
            {/* Living Solar Flare Corona Layers */}
            <circle
              cx={sys.centerX}
              cy={sys.centerY}
              r={130}
              fill="url(#sun-outer-flare)"
              className="animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            <circle
              cx={sys.centerX}
              cy={sys.centerY}
              r={85}
              fill="url(#sun-core-pulse)"
              className="animate-pulse"
              style={{ animationDuration: '2.5s' }}
            />

            {/* Concentric Planetary Orbital Rings */}
            {[2, 3, 4, 5].map((tier) => {
              const r = ORBIT_RADII[tier];
              return (
                <g key={`orbit-${sys.core.id}-t${tier}`}>
                  {/* Glowing orbital guide ring */}
                  <circle
                    cx={sys.centerX}
                    cy={sys.centerY}
                    r={r}
                    fill="none"
                    stroke={sys.colorHex}
                    strokeWidth="1.2"
                    strokeDasharray="4 8"
                    strokeOpacity="0.22"
                  />

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
                      y={sys.centerY - r - 8}
                      fill={sys.colorHex}
                      fillOpacity="0.45"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="select-none tracking-widest uppercase"
                    >
                      {tier === 2
                        ? 'Orbit II • Clusters'
                        : tier === 3
                          ? 'Orbit III • Topics'
                          : tier === 4
                            ? 'Orbit IV • Abilities'
                            : 'Orbit V • Drills & Katas'}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Drifting Stardust Streams along the planetary orbits */}
            {stardustParticles.map((pt, pIdx) => {
              const speed = ORBIT_SPEEDS[pt.orbit] || 180;
              const rot = (elapsedTime * (2 * Math.PI)) / speed;
              const px = sys.centerX + Math.cos(pt.angle + rot) * ORBIT_RADII[pt.orbit];
              const py = sys.centerY + Math.sin(pt.angle + rot) * ORBIT_RADII[pt.orbit];
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

            {/* Gravitational Curved Laser Conduits & Synaptic Pulses */}
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

                  // Dynamic Gravitational Arc (Curves slightly towards system center)
                  const midX = (parentItem.x + nodeItem.x) / 2;
                  const midY = (parentItem.y + nodeItem.y) / 2;
                  // Pull control point slightly towards Sun center for a realistic orbital arc
                  const pullFactor = 0.18;
                  const ctrlX = midX + (sys.centerX - midX) * pullFactor;
                  const ctrlY = midY + (sys.centerY - midY) * pullFactor;

                  const pathData = `M ${parentItem.x} ${parentItem.y} Q ${ctrlX} ${ctrlY} ${nodeItem.x} ${nodeItem.y}`;
                  const strokeOpacity = isDimmed ? 0.12 : isHighlighted ? 1 : 0.65;
                  const strokeWidth = isHighlighted ? 3.5 : isChildMastered ? 2.5 : 1.5;

                  return (
                    <g key={`filament-${parentItem.skill.id}-${child.id}`}>
                      {/* Outer Glow Halo Beam */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={filamentColor}
                        strokeWidth={strokeWidth + 3}
                        strokeOpacity={strokeOpacity * 0.35}
                        filter="url(#globe-laser-glow)"
                      />
                      {/* Core Laser Filament */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isChildMastered || isHighlighted ? '#ffffff' : filamentColor}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        strokeDasharray={isLearning || isHighlighted ? '6 4' : undefined}
                      />
                      {/* Animated Photons */}
                      {viewSettings.showParticles &&
                        (isLearning || isChildMastered || isHighlighted) &&
                        !isDimmed && (
                          <circle r={isHighlighted ? 4.5 : 2.5} fill={filamentColor} filter="url(#globe-laser-glow)">
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

            {/* Render Node Medallions via SVG ForeignObject (100% Locked Coordinates) */}
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
                    showAuras={viewSettings.showAuras}
                    onSelect={onSelect}
                    onHover={onHover}
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
