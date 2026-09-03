import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sparkles,
  Zap,
  Clock,
  Trophy,
  Plus,
  Compass,
  ChevronDown,
  Layers,
  Flame,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
  Eye,
  Activity,
  Check,
  Orbit,
  GitGraph,
} from 'lucide-react';
import { db } from '../../../../db';
import { UnifiedEntity } from '../../../../types';
import { SkillGlyph } from './SkillGlyph';
import { SkillLaserConduits } from './SkillLaserConduits';
import { SkillSortableTier } from './SkillSortableTier';
import { SkillGlobeCanvas } from './SkillGlobeCanvas';
import { SkillTomeDrawer } from './SkillTomeDrawer';
import {
  SkillNodeItem,
  ELEMENTAL_THEMES,
  SkillLayoutMode,
  SkillViewSettings,
  DEFAULT_VIEW_SETTINGS,
  STORAGE_LAYOUT_MODE_KEY,
  STORAGE_VIEW_SETTINGS_KEY,
  STORAGE_SP_KEY,
  STORAGE_ACTIVE_TREE_KEY,
} from './types';
import {
  parseSkillDrills,
  serializeSkillDrills,
  calculateTreeStats,
} from './utils';

interface SkillTreeCanvasProps {
  onSwitchToMindmap?: () => void;
}

export function SkillTreeCanvas({ onSwitchToMindmap }: SkillTreeCanvasProps) {
  const [selectedSkill, setSelectedSkill] = useState<SkillNodeItem | null>(null);
  const [activeTreeId, setActiveTreeId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_ACTIVE_TREE_KEY) || 'all';
    } catch {
      return 'all';
    }
  });

  // Layout Mode: "tree" (Vertical Cascading Tiers) vs "orbit" (Celestial Globe Planetary Orbits)
  const [layoutMode, setLayoutMode] = useState<SkillLayoutMode>(() => {
    try {
      return (localStorage.getItem(STORAGE_LAYOUT_MODE_KEY) as SkillLayoutMode) || 'tree';
    } catch {
      return 'tree';
    }
  });

  const handleSetLayoutMode = (mode: SkillLayoutMode) => {
    setLayoutMode(mode);
    try {
      localStorage.setItem(STORAGE_LAYOUT_MODE_KEY, mode);
    } catch {}
  };

  // Hovered Skill for dynamic lineage glow & conduit lighting
  const [hoveredSkill, setHoveredSkill] = useState<SkillNodeItem | null>(null);

  // Zoom Level (0.3x to 2.5x) & Pan Offset (x, y)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(null);

  // View Settings State
  const [viewSettings, setViewSettings] = useState<SkillViewSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_VIEW_SETTINGS_KEY);
      return raw ? { ...DEFAULT_VIEW_SETTINGS, ...JSON.parse(raw) } : DEFAULT_VIEW_SETTINGS;
    } catch {
      return DEFAULT_VIEW_SETTINGS;
    }
  });
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);

  const toggleViewSetting = (key: keyof SkillViewSettings) => {
    setViewSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_VIEW_SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Zoom & Pan helpers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.3, Math.round((z - 0.15) * 100) / 100));
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse wheel zoom + trackpad pan handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // If ctrlKey or metaKey (or pinch zoom), zoom in/out
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoomLevel((prev) => Math.min(2.5, Math.max(0.3, Math.round(prev * zoomFactor * 100) / 100)));
    } else {
      // Default wheel zooms directly on canvas like ReactFlow/Mindmap
      e.preventDefault();
      const zoomDelta = -e.deltaY * 0.0015;
      setZoomLevel((prev) => Math.min(2.5, Math.max(0.3, Math.round((prev + zoomDelta) * 100) / 100)));
    }
  }, []);

  // Background Canvas Pan Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only pan if clicking on canvas backdrop or middle click, not when dragging a skill node
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-skill-id]') ||
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input') ||
      target.closest('form')
    ) {
      return;
    }

    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startPanX: panOffset.x,
        startPanY: panOffset.y,
      };
    }
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanOffset({
      x: panStartRef.current.startPanX + dx,
      y: panStartRef.current.startPanY + dy,
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  // Reorder nodes within tier horizontally
  const handleReorderTier = useCallback(
    async (tier: number, orderedIds: string[]) => {
      // Update each entity's sort_order in Dexie
      const updates = orderedIds.map((id, index) =>
        db.entities.update(id, { sort_order: index }),
      );
      await Promise.all(updates);
    },
    [],
  );

  // New Skill Modal
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);
  const [newSkillTitle, setNewSkillTitle] = useState('');
  const [newSkillTier, setNewSkillTier] = useState<number>(2);
  const [newSkillParentId, setNewSkillParentId] = useState<string>('');
  const [newSkillColor, setNewSkillColor] = useState<string>('sky');

  // Live query for entities
  const allEntities = useLiveQuery(() => db.entities.toArray()) || [];

  // Filter skills: entity_type === 'skill' (or fallback to purposes/domains as root trees if no skills exist yet)
  const rawSkills = useMemo(() => {
    return allEntities.filter((e) => e.entity_type === 'skill');
  }, [allEntities]);

  // Load SP spent map from localStorage
  const [spMap, setSpMap] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Assemble SkillNodeItems with generational tier, rank, and status
  const skillNodes = useMemo<SkillNodeItem[]>(() => {
    const parentMap = new Map<string, string[]>();
    rawSkills.forEach((s) => parentMap.set(s.id, s.parent_ids || []));

    // Calculate depth tier
    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 1;
      visited.add(id);
      const parents = parentMap.get(id) || [];
      if (parents.length === 0) return 1;
      let maxParentDepth = 1;
      parents.forEach((pid) => {
        if (parentMap.has(pid)) {
          maxParentDepth = Math.max(maxParentDepth, getDepth(pid, visited) + 1);
        }
      });
      return Math.min(5, maxParentDepth);
    };

    return rawSkills
      .map((entity) => {
        const tier = getDepth(entity.id);
        const drills = parseSkillDrills(entity.content);
        const spSpent = spMap[entity.id] || 0;

        // Rank calculation: 0 to 5 based on SP spent + drills completed
        const drillPoints = drills.filter((d) => d.completed).length;
        const rank = Math.min(5, spSpent + drillPoints);

        let status: 'locked' | 'available' | 'learning' | 'mastered' = 'available';
        if (rank >= 5 || entity.status === 'done' || entity.status === 'achieved') {
          status = 'mastered';
        } else if (rank > 0) {
          status = 'learning';
        }

        return {
          id: entity.id,
          title: entity.title,
          icon: entity.icon || 'Sparkles',
          color: entity.color || (tier === 1 ? 'amber' : tier === 2 ? 'sky' : 'emerald'),
          time_spent: entity.time_spent || 0,
          content: entity.content || '',
          parent_ids: entity.parent_ids || [],
          tier,
          status,
          rank,
          maxRank: 5,
          drills,
          spSpent,
          sort_order: entity.sort_order ?? 9999,
        };
      })
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
  }, [rawSkills, spMap]);

  // Lineage calculation for active/hovered node
  const activeLineageIds = useMemo(() => {
    const target = hoveredSkill || selectedSkill;
    if (!target) return new Set<string>();

    const lineage = new Set<string>([target.id]);

    // Upstream (parents and ancestors)
    const queue = [...target.parent_ids];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (!lineage.has(currentId)) {
        lineage.add(currentId);
        const node = skillNodes.find((s) => s.id === currentId);
        if (node && node.parent_ids) {
          queue.push(...node.parent_ids);
        }
      }
    }

    // Downstream (children and descendants)
    let added = true;
    while (added) {
      added = false;
      skillNodes.forEach((s) => {
        if (!lineage.has(s.id)) {
          const hasParentInLineage = (s.parent_ids || []).some((pid) => lineage.has(pid));
          if (hasParentInLineage) {
            lineage.add(s.id);
            added = true;
          }
        }
      });
    }

    return lineage;
  }, [hoveredSkill, selectedSkill, skillNodes]);

  // Distinct Core Keystone trees (Tier 1 nodes)
  const coreTrees = useMemo(() => {
    return skillNodes.filter((s) => s.tier === 1);
  }, [skillNodes]);

  // Filter skills by selected Core Tree and viewSettings
  const displayedSkills = useMemo(() => {
    let filtered = skillNodes;
    if (activeTreeId !== 'all' && coreTrees.length > 0) {
      const allowed = new Set<string>([activeTreeId]);
      let added = true;
      while (added) {
        added = false;
        skillNodes.forEach((s) => {
          if (!allowed.has(s.id)) {
            const hasParentInAllowed = (s.parent_ids || []).some((pid) => allowed.has(pid));
            if (hasParentInAllowed) {
              allowed.add(s.id);
              added = true;
            }
          }
        });
      }
      filtered = filtered.filter((s) => allowed.has(s.id));
    }

    if (!viewSettings.showLockedNodes) {
      filtered = filtered.filter((s) => s.status !== 'locked');
    }

    return filtered;
  }, [skillNodes, activeTreeId, coreTrees, viewSettings.showLockedNodes]);

  // Tree stats
  const stats = useMemo(() => calculateTreeStats(displayedSkills), [displayedSkills]);

  // Tier grouping (Tier 1 -> Tier 5)
  const tierGroups = useMemo(() => {
    const groups: Record<number, SkillNodeItem[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    displayedSkills.forEach((s) => {
      const t = Math.min(5, Math.max(1, s.tier));
      groups[t].push(s);
    });
    return groups;
  }, [displayedSkills]);

  // Spend SP to Level Up
  const handleAllocateSp = useCallback(
    (skill: SkillNodeItem) => {
      if (stats.availableSp <= 0 || skill.rank >= skill.maxRank) return;

      const nextSp = (spMap[skill.id] || 0) + 1;
      const nextMap = { ...spMap, [skill.id]: nextSp };
      setSpMap(nextMap);
      try {
        localStorage.setItem(STORAGE_SP_KEY, JSON.stringify(nextMap));
      } catch {}

      if (selectedSkill?.id === skill.id) {
        setSelectedSkill({
          ...skill,
          rank: Math.min(5, skill.rank + 1),
          spSpent: nextSp,
        });
      }
    },
    [stats.availableSp, spMap, selectedSkill],
  );

  // Toggle drill
  const handleToggleDrill = useCallback(
    async (skill: SkillNodeItem, drillIndex: number) => {
      const updatedDrills = [...skill.drills];
      if (updatedDrills[drillIndex]) {
        updatedDrills[drillIndex].completed = !updatedDrills[drillIndex].completed;
        const serialized = serializeSkillDrills(skill.content, updatedDrills);
        await db.entities.update(skill.id, { content: serialized });

        if (selectedSkill?.id === skill.id) {
          setSelectedSkill({
            ...skill,
            drills: updatedDrills,
            content: serialized,
          });
        }
      }
    },
    [selectedSkill],
  );

  // Add drill
  const handleAddDrill = useCallback(
    async (skill: SkillNodeItem, drillTitle: string) => {
      const updatedDrills = [
        ...skill.drills,
        { id: `drill-${Date.now()}`, title: drillTitle, completed: false },
      ];
      const serialized = serializeSkillDrills(skill.content, updatedDrills);
      await db.entities.update(skill.id, { content: serialized });

      if (selectedSkill?.id === skill.id) {
        setSelectedSkill({
          ...skill,
          drills: updatedDrills,
          content: serialized,
        });
      }
    },
    [selectedSkill],
  );

  // Update Notes
  const handleUpdateNotes = useCallback(async (skill: SkillNodeItem, notes: string) => {
    await db.entities.update(skill.id, { content: notes });
  }, []);

  // Update Color
  const handleUpdateColor = useCallback(
    async (skill: SkillNodeItem, color: string) => {
      await db.entities.update(skill.id, { color });
      if (selectedSkill?.id === skill.id) {
        setSelectedSkill({
          ...skill,
          color,
        });
      }
    },
    [selectedSkill],
  );

  // Delete Skill
  const handleDeleteSkill = useCallback(async (skill: SkillNodeItem) => {
    await db.entities.delete(skill.id);
    setSelectedSkill(null);
  }, []);

  // Create New Skill Submission
  const handleCreateSkillSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSkillTitle.trim()) return;

      const newId = crypto.randomUUID();
      const parent_ids = newSkillParentId ? [newSkillParentId] : [];

      await db.entities.add({
        id: newId,
        entity_type: 'skill',
        title: newSkillTitle.trim(),
        icon: newSkillTier === 1 ? 'Globe' : newSkillTier === 2 ? 'Layers' : 'Sparkles',
        color: newSkillColor,
        status: 'todo',
        time_spent: 0,
        parent_ids,
        content: `- [ ] Mastery Drill 1: Fundamentals\n- [ ] Mastery Drill 2: Implementation`,
        created_at: new Date(),
        sort_order: 9999,
      });

      setNewSkillTitle('');
      setIsCreatingModalOpen(false);
    },
    [newSkillTitle, newSkillTier, newSkillParentId, newSkillColor],
  );

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#07070a] text-stone-200 overflow-hidden select-none">
      {/* Background Cosmic Particle Canvas Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e1e28_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40" />
      <div className="absolute -top-40 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-sky-900/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP RPG HUD BAR */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 bg-[#0e0e12]/90 backdrop-blur-xl border-b border-stone-850 shadow-2xl">
        {/* Left: View Switcher & Active Tree Selector */}
        <div className="flex items-center gap-3">
          {/* Segmented Switcher back to Mindmap */}
          <div className="flex items-center p-0.5 bg-[#141418] border border-stone-800 rounded-xl shadow-inner">
            <button
              onClick={onSwitchToMindmap}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-all cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Mindmap</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)] cursor-default">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>RPG Skill Tree</span>
            </button>
          </div>

          {/* Layout Mode Switcher: Tree vs Celestial Orbit */}
          <div className="flex items-center p-0.5 bg-[#141418] border border-stone-800 rounded-xl shadow-inner">
            <button
              onClick={() => handleSetLayoutMode('tree')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                layoutMode === 'tree'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Cascading Tiered Talent Tree View"
            >
              <GitGraph className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tree</span>
            </button>
            <button
              onClick={() => handleSetLayoutMode('orbit')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                layoutMode === 'orbit'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Celestial Planetary Globe Orbit View"
            >
              <Orbit className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Celestial Orbit</span>
            </button>
          </div>

          {/* Active Tree Selector */}
          {coreTrees.length > 0 && (
            <div className="relative">
              <select
                value={activeTreeId}
                onChange={(e) => {
                  setActiveTreeId(e.target.value);
                  try {
                    localStorage.setItem(STORAGE_ACTIVE_TREE_KEY, e.target.value);
                  } catch {}
                }}
                className="bg-[#141418] border border-stone-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-stone-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="all">🌟 All Constellations</option>
                {coreTrees.map((c) => (
                  <option key={c.id} value={c.id}>
                    🌐 {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Center: Character Level & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-mono font-extrabold text-stone-950 text-sm shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            {stats.level}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-amber-300">
                Level {stats.level}
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-xs font-mono text-stone-400">{stats.levelTitle}</span>
            </div>
            {/* XP Bar */}
            <div className="w-36 h-1.5 bg-stone-900 rounded-full overflow-hidden border border-stone-800 mt-1">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${(stats.totalXp % 500) / 5}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Zoom, Display Controls, Stats Counters & Spawner */}
        <div className="flex items-center gap-3">
          {/* Zoom Controller */}
          <div className="flex items-center bg-[#141418] border border-stone-800 rounded-xl p-0.5 shadow-inner">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out (Min 50%)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="px-2 py-1 text-[11px] font-mono font-bold text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Reset Zoom & Pan to Default"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 rounded-lg transition-colors cursor-pointer"
              title="Zoom In (Max 150%)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Elements Controller Popover */}
          <div className="relative">
            <button
              onClick={() => setIsViewSettingsOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                isViewSettingsOpen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#141418] border-stone-800 text-stone-300 hover:text-stone-100'
              }`}
              title="Configure Visual Display Options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Display</span>
            </button>

            {isViewSettingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#121215] border border-stone-800 rounded-2xl shadow-2xl z-50 p-2.5 space-y-1.5 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-stone-500 border-b border-stone-800/60 flex items-center justify-between">
                  <span>Display Elements</span>
                  <Eye className="w-3 h-3 text-stone-400" />
                </div>

                {[
                  { key: 'showConduits', label: 'Laser Conduits', desc: 'Connective neon filaments' },
                  { key: 'showParticles', label: 'Flowing Photons', desc: 'Active energy currents' },
                  { key: 'showAuras', label: 'Elemental Auras', desc: 'Glowing radial halation' },
                  { key: 'showRankBadges', label: 'Rank Badges', desc: 'Progress & crown icons' },
                  { key: 'showTierBanners', label: 'Tier Banners', desc: 'Section header ribbons' },
                  { key: 'showLockedNodes', label: 'Locked Nodes', desc: 'Unreached future skills' },
                ].map((item) => {
                  const isActive = viewSettings[item.key as keyof SkillViewSettings];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleViewSetting(item.key as keyof SkillViewSettings)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer text-left ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200 border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold leading-tight">{item.label}</span>
                        <span className="text-[9px] text-stone-500 font-normal leading-tight">
                          {item.desc}
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                          isActive
                            ? 'bg-amber-500 border-amber-400 text-stone-950'
                            : 'border-stone-700 bg-stone-900'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats Badges */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141418] border border-stone-800 rounded-lg text-amber-400">
              <Zap className="w-3.5 h-3.5" />
              <span>{stats.availableSp} SP</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141418] border border-stone-800 rounded-lg text-stone-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{stats.totalHours} hrs</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141418] border border-stone-800 rounded-lg text-emerald-400">
              <Trophy className="w-3.5 h-3.5" />
              <span>{stats.masteryPercentage}%</span>
            </div>
          </div>

          <button
            onClick={() => setIsCreatingModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ Skill Node</span>
          </button>
        </div>
      </header>

      {/* MAIN TALENT TREE MASTERY SCREEN */}
      <main
        ref={canvasContainerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 overflow-hidden relative flex items-center justify-center select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Transformable Canvas Surface */}
        <div
          className="relative w-full h-full flex flex-col items-center justify-center p-12 transition-transform duration-75 origin-center"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          }}
        >
          {/* Laser Energy Conduits SVG Layer (for Tree Mode) */}
          {layoutMode === 'tree' && viewSettings.showConduits && displayedSkills.length > 0 && (
            <SkillLaserConduits
              skills={displayedSkills}
              containerRef={canvasContainerRef}
              activeLineageIds={activeLineageIds}
              showParticles={viewSettings.showParticles}
            />
          )}

          {displayedSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center max-w-md space-y-4 z-10">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-500/40 flex items-center justify-center text-amber-400/60">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-base font-mono font-bold text-stone-200">No Skill Nodes Forged Yet</h3>
              <p className="text-xs font-mono text-stone-500">
                Begin your RPG progression path. Forging skills here lets you master competencies, complete
                drills, and syncs seamlessly with your Mindmap!
              </p>
              <button
                onClick={() => setIsCreatingModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer"
              >
                + Forge Tier 1 Core Skill
              </button>
            </div>
          ) : layoutMode === 'orbit' ? (
            /* CELESTIAL PLANETARY GLOBE ORBIT VIEW */
            <SkillGlobeCanvas
              skills={displayedSkills}
              selectedSkill={selectedSkill}
              activeLineageIds={activeLineageIds}
              viewSettings={viewSettings}
              onSelect={setSelectedSkill}
              onHover={setHoveredSkill}
            />
          ) : (
            /* CASCADING TIERED TALENT TREE VIEW */
            <div className="w-full max-w-5xl space-y-16 py-6 z-10">
              {/* TIER 1: CORE ANCESTRAL KEYSTONES */}
              <SkillSortableTier
                tier={1}
                label="Tier 1 • Core Origin Keystones"
                badgeClass="text-amber-400/80 bg-amber-500/10 border-amber-500/20"
                skills={tierGroups[1]}
                selectedSkill={selectedSkill}
                activeLineageIds={activeLineageIds}
                showTierBanners={viewSettings.showTierBanners}
                showRankBadges={viewSettings.showRankBadges}
                showAuras={viewSettings.showAuras}
                onReorder={handleReorderTier}
                onSelect={setSelectedSkill}
                onHover={setHoveredSkill}
              />

              {/* TIER 2: MAJOR CLUSTER PILLARS */}
              <SkillSortableTier
                tier={2}
                label="Tier 2 • Major Clusters"
                badgeClass="text-sky-400/80 bg-sky-500/10 border-sky-500/20"
                skills={tierGroups[2]}
                selectedSkill={selectedSkill}
                activeLineageIds={activeLineageIds}
                showTierBanners={viewSettings.showTierBanners}
                showRankBadges={viewSettings.showRankBadges}
                showAuras={viewSettings.showAuras}
                onReorder={handleReorderTier}
                onSelect={setSelectedSkill}
                onHover={setHoveredSkill}
              />

              {/* TIER 3: TOPICS & TECH RUNES */}
              <SkillSortableTier
                tier={3}
                label="Tier 3 • Topic Sockets"
                badgeClass="text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20"
                skills={tierGroups[3]}
                selectedSkill={selectedSkill}
                activeLineageIds={activeLineageIds}
                showTierBanners={viewSettings.showTierBanners}
                showRankBadges={viewSettings.showRankBadges}
                showAuras={viewSettings.showAuras}
                onReorder={handleReorderTier}
                onSelect={setSelectedSkill}
                onHover={setHoveredSkill}
              />

              {/* TIER 4: MICRO-CONCEPTS & ABILITIES */}
              <SkillSortableTier
                tier={4}
                label="Tier 4 • Micro-Concepts & Abilities"
                badgeClass="text-violet-400/80 bg-violet-500/10 border-violet-500/20"
                skills={tierGroups[4]}
                selectedSkill={selectedSkill}
                activeLineageIds={activeLineageIds}
                showTierBanners={viewSettings.showTierBanners}
                showRankBadges={viewSettings.showRankBadges}
                showAuras={viewSettings.showAuras}
                onReorder={handleReorderTier}
                onSelect={setSelectedSkill}
                onHover={setHoveredSkill}
              />

              {/* TIER 5: DRILLS & KATA CHECKPOINTS */}
              <SkillSortableTier
                tier={5}
                label="Tier 5 • Drills & Kata"
                badgeClass="text-rose-400/80 bg-rose-500/10 border-rose-500/20"
                skills={tierGroups[5]}
                selectedSkill={selectedSkill}
                activeLineageIds={activeLineageIds}
                showTierBanners={viewSettings.showTierBanners}
                showRankBadges={viewSettings.showRankBadges}
                showAuras={viewSettings.showAuras}
                onReorder={handleReorderTier}
                onSelect={setSelectedSkill}
                onHover={setHoveredSkill}
              />
            </div>
          )}
        </div>
      </main>

      {/* RPG TOME INSPECT DRAWER */}
      <SkillTomeDrawer
        skill={selectedSkill}
        availableSp={stats.availableSp}
        onClose={() => setSelectedSkill(null)}
        onAllocateSp={handleAllocateSp}
        onToggleDrill={handleToggleDrill}
        onAddDrill={handleAddDrill}
        onDeleteSkill={handleDeleteSkill}
        onUpdateNotes={handleUpdateNotes}
        onUpdateColor={handleUpdateColor}
      />

      {/* CREATE NEW SKILL MODAL */}
      {isCreatingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSkillSubmit}
            className="w-full max-w-md bg-[#121215] border border-stone-800 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <h3 className="text-base font-mono font-bold text-stone-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Forge New Skill Node
            </h3>

            <div>
              <label className="text-[11px] font-mono uppercase text-stone-400">Skill Title</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. React Hooks, System Design, CSS Grid..."
                value={newSkillTitle}
                onChange={(e) => setNewSkillTitle(e.target.value)}
                className="w-full mt-1 bg-[#18181c] border border-stone-700 rounded-xl px-3 py-2 text-sm font-mono text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-stone-400">Skill Tier</label>
              <div className="grid grid-cols-5 gap-1.5 mt-1">
                {[
                  { tier: 1, label: 'T1 Core' },
                  { tier: 2, label: 'T2 Cluster' },
                  { tier: 3, label: 'T3 Topic' },
                  { tier: 4, label: 'T4 Micro' },
                  { tier: 5, label: 'T5 Drill' },
                ].map((item) => (
                  <button
                    key={item.tier}
                    type="button"
                    onClick={() => {
                      setNewSkillTier(item.tier);
                      if (item.tier === 1) setNewSkillColor('amber');
                    }}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                      newSkillTier === item.tier
                        ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
                        : 'bg-stone-800/80 text-stone-400 hover:bg-stone-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Elemental Theme Palette Picker */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase text-stone-400">
                  Elemental Theme ({ELEMENTAL_THEMES.find((t) => t.id === newSkillColor)?.name || 'Custom'})
                </label>
              </div>
              <div className="grid grid-cols-6 gap-1.5 mt-1 p-2 bg-[#18181c] border border-stone-700 rounded-xl">
                {ELEMENTAL_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewSkillColor(t.id)}
                    className={`h-6 rounded-lg ${t.bgClass} flex items-center justify-center transition-all cursor-pointer ${
                      newSkillColor === t.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181c] scale-110 shadow-md'
                        : 'opacity-50 hover:opacity-100 hover:scale-105'
                    }`}
                    title={t.name}
                  >
                    {newSkillColor === t.id && <Check className="w-3.5 h-3.5 text-stone-950 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Parent dependency selector */}
            {newSkillTier > 1 && skillNodes.length > 0 && (
              <div>
                <label className="text-[11px] font-mono uppercase text-stone-400">
                  Prerequisite Parent Skill
                </label>
                <select
                  value={newSkillParentId}
                  onChange={(e) => setNewSkillParentId(e.target.value)}
                  className="w-full mt-1 bg-[#18181c] border border-stone-700 rounded-xl px-3 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">-- Independent Root --</option>
                  {skillNodes
                    .filter((s) => s.tier < newSkillTier)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Tier {s.tier}: {s.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingModalOpen(false)}
                className="px-4 py-2 text-xs font-mono text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-mono text-xs font-bold transition-colors cursor-pointer"
              >
                Forge Skill
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
