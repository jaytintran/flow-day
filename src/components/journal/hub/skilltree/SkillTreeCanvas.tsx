import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sparkles,
  Zap,
  Clock,
  Trophy,
  Plus,
  Compass,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Eye,
  Check,
  Orbit,
  GitGraph,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { db } from '../../../../db';
import { UnifiedEntity } from '../../../../types';
import { SkillGlyph } from './SkillGlyph';
import { SkillLaserConduits } from './SkillLaserConduits';
import { SkillSortableTier } from './SkillSortableTier';
import { SkillGlobeCanvas } from './SkillGlobeCanvas';
import { SkillTomeModal } from './SkillTomeModal';
import { SkillContextMenu } from './SkillContextMenu';
import IconPickerModal from '../../../IconPickerModal';
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
  combineSkillNotesAndDrills,
  calculateTreeStats,
} from './utils';
import { computeHierarchicalTreeLayout } from './treeLayout';
import { playCompleteSound } from '../../../../services/audio';

interface ActiveWiring {
  sourceSkill: SkillNodeItem;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
  targetSkill: SkillNodeItem | null;
  targetPos: { x: number; y: number } | null;
  isValid: boolean;
}

const TIER_BANNERS: Record<number, { label: string; badgeClass: string }> = {
  1: { label: 'Tier 1 • Core Origin Keystones', badgeClass: 'text-amber-400/80 bg-amber-500/10 border-amber-500/20' },
  2: { label: 'Tier 2 • Major Clusters', badgeClass: 'text-sky-400/80 bg-sky-500/10 border-sky-500/20' },
  3: { label: 'Tier 3 • Topic Sockets', badgeClass: 'text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20' },
  4: { label: 'Tier 4 • Micro-Concepts & Abilities', badgeClass: 'text-violet-400/80 bg-violet-500/10 border-violet-500/20' },
  5: { label: 'Tier 5 • Drills & Kata', badgeClass: 'text-rose-400/80 bg-rose-500/10 border-rose-500/20' },
};

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

  // Active Wiring Drag State & Refs
  const [activeWiring, setActiveWiring] = useState<ActiveWiring | null>(null);
  const wiringStartRef = useRef<{
    startX: number;
    startY: number;
    sourceSkill: SkillNodeItem;
    sourceX: number;
    sourceY: number;
    hasStartedDrag: boolean;
  } | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    skill: SkillNodeItem;
  } | null>(null);

  // Icon Picker Modal State
  const [iconPickerSkill, setIconPickerSkill] = useState<SkillNodeItem | null>(null);

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

  const updateSpacingSetting = (horizontalSpacing: number, verticalSpacing: number) => {
    setViewSettings((prev) => {
      const next = { ...prev, horizontalSpacing, verticalSpacing };
      try {
        localStorage.setItem(STORAGE_VIEW_SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const updateSingleSpacing = (key: 'horizontalSpacing' | 'verticalSpacing', val: number) => {
    setViewSettings((prev) => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem(STORAGE_VIEW_SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const viewSettingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewSettingsRef.current && !viewSettingsRef.current.contains(e.target as Node)) {
        setIsViewSettingsOpen(false);
      }
    };
    if (isViewSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isViewSettingsOpen]);

  // Zoom & Pan helpers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.3, Math.round((z - 0.15) * 100) / 100));
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse wheel zoom + trackpad pan handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoomLevel((prev) => Math.min(2.5, Math.max(0.3, Math.round(prev * zoomFactor * 100) / 100)));
    } else {
      e.preventDefault();
      const zoomDelta = -e.deltaY * 0.0015;
      setZoomLevel((prev) => Math.min(2.5, Math.max(0.3, Math.round((prev + zoomDelta) * 100) / 100)));
    }
  }, []);

  // Background Canvas Pan Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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

  // Selection handler (guards against opening Tome if a drag-wiring gesture just finished)
  const handleSelectSkill = useCallback((skill: SkillNodeItem) => {
    if (wiringStartRef.current?.hasStartedDrag) return;
    setSelectedSkill(skill);
  }, []);

  // Reorder nodes within tier horizontally
  const handleReorderTier = useCallback(
    async (tier: number, orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        db.entities.update(id, { sort_order: index }),
      );
      await Promise.all(updates);
    },
    [],
  );

  // New Skill Modal State
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);
  const [newSkillTitle, setNewSkillTitle] = useState('');
  const [newSkillTier, setNewSkillTier] = useState<number>(2);
  const [newSkillParentId, setNewSkillParentId] = useState<string>('');
  const [newSkillColor, setNewSkillColor] = useState<string>('sky');

  // Live query for entities
  const allEntities = useLiveQuery(() => db.entities.toArray()) || [];

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

  const coreTrees = useMemo(() => {
    return skillNodes.filter((s) => s.tier === 1);
  }, [skillNodes]);

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

  const treeLayout = useMemo(() => {
    return computeHierarchicalTreeLayout(displayedSkills, activeLineageIds, {
      horizontalSpacing: viewSettings.horizontalSpacing,
      verticalSpacing: viewSettings.verticalSpacing,
    });
  }, [
    displayedSkills,
    activeLineageIds,
    viewSettings.horizontalSpacing,
    viewSettings.verticalSpacing,
  ]);

  const stats = useMemo(() => calculateTreeStats(displayedSkills), [displayedSkills]);

  const tierGroups = useMemo(() => {
    const groups: Record<number, SkillNodeItem[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    displayedSkills.forEach((s) => {
      const t = Math.min(5, Math.max(1, s.tier));
      groups[t].push(s);
    });
    return groups;
  }, [displayedSkills]);

  // SP allocation
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

  // Drill Toggle
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

  // Add Drill
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

  // Edit Drill Title Inline
  const handleEditDrill = useCallback(
    async (skill: SkillNodeItem, drillIndex: number, newTitle: string) => {
      const updatedDrills = [...skill.drills];
      if (updatedDrills[drillIndex]) {
        updatedDrills[drillIndex].title = newTitle;
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

  // Delete Drill
  const handleDeleteDrill = useCallback(
    async (skill: SkillNodeItem, drillIndex: number) => {
      const updatedDrills = skill.drills.filter((_, idx) => idx !== drillIndex);
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

  // Update Title
  const handleUpdateTitle = useCallback(
    async (skill: SkillNodeItem, newTitle: string) => {
      await db.entities.update(skill.id, { title: newTitle });
      if (selectedSkill?.id === skill.id) {
        setSelectedSkill({
          ...skill,
          title: newTitle,
        });
      }
    },
    [selectedSkill],
  );

  // Update Notes
  const handleUpdateNotes = useCallback(
    async (skill: SkillNodeItem, notes: string) => {
      const combined = combineSkillNotesAndDrills(notes, skill.drills);
      await db.entities.update(skill.id, { content: combined });
      if (selectedSkill?.id === skill.id) {
        setSelectedSkill({
          ...skill,
          content: combined,
        });
      }
    },
    [selectedSkill],
  );

  // Update Color
  const handleUpdateColor = useCallback(
    async (skill: SkillNodeItem, color: string) => {
      await db.entities.update(skill.id, { color: color as any });
      if (selectedSkill?.id === skill.id) {
        setSelectedSkill({
          ...skill,
          color,
        });
      }
    },
    [selectedSkill],
  );

  // Toggle Mastered status
  const handleToggleMastered = useCallback(
    async (skill: SkillNodeItem) => {
      const isCurrentlyMastered = skill.rank >= skill.maxRank || skill.status === 'mastered';
      const newStatus = isCurrentlyMastered ? 'todo' : 'done';
      await db.entities.update(skill.id, { status: newStatus });
    },
    [],
  );

  // Delete Skill
  const handleDeleteSkill = useCallback(async (skill: SkillNodeItem) => {
    await db.entities.delete(skill.id);
    setSelectedSkill(null);
    setContextMenu(null);
  }, []);

  // Helper to check if ancestorId is already an ancestor of targetId (prevents circular cycles)
  const isAncestor = useCallback((ancestorId: string, targetId: string, skillList: SkillNodeItem[]): boolean => {
    if (ancestorId === targetId) return true;
    const targetNode = skillList.find((s) => s.id === targetId);
    if (!targetNode || !targetNode.parent_ids || targetNode.parent_ids.length === 0) return false;

    const visited = new Set<string>();
    const queue = [...targetNode.parent_ids];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === ancestorId) return true;
      if (!visited.has(curr)) {
        visited.add(curr);
        const pNode = skillList.find((s) => s.id === curr);
        if (pNode?.parent_ids) {
          queue.push(...pNode.parent_ids);
        }
      }
    }
    return false;
  }, []);

  // Node Pointer Down - initializes potential hold-and-drag wiring
  const handleNodePointerDown = useCallback(
    (skill: SkillNodeItem, e: React.PointerEvent) => {
      if (e.button !== 0) return; // Only primary mouse / touch button
      const layoutNode = treeLayout.nodes.find((n) => n.skill.id === skill.id);
      if (!layoutNode) return;

      wiringStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        sourceSkill: skill,
        sourceX: layoutNode.x,
        sourceY: layoutNode.y,
        hasStartedDrag: false,
      };
    },
    [treeLayout.nodes],
  );

  // Global Pointer Listeners for Live Wiring Drag & Drop
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!wiringStartRef.current) return;
      const { startX, startY, sourceSkill, sourceX, sourceY, hasStartedDrag } = wiringStartRef.current;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);

      if (!hasStartedDrag) {
        if (dist < 8) return;
        wiringStartRef.current.hasStartedDrag = true;
      }

      if (!treeContainerRef.current) return;
      const rect = treeContainerRef.current.getBoundingClientRect();
      const currentLayoutX = (e.clientX - (rect.left + rect.width / 2)) / zoomLevel;
      const currentLayoutY = (e.clientY - rect.top) / zoomLevel;

      // Find closest node within snap radius
      let targetSkill: SkillNodeItem | null = null;
      let targetPos: { x: number; y: number } | null = null;
      let isValid = false;

      let closestDist = 55; // 55px snapping radius
      for (const node of treeLayout.nodes) {
        if (node.skill.id === sourceSkill.id) continue;
        const d = Math.hypot(node.x - currentLayoutX, node.y - currentLayoutY);
        if (d < closestDist) {
          closestDist = d;
          targetSkill = node.skill;
          targetPos = { x: node.x, y: node.y };
        }
      }

      if (targetSkill && targetPos) {
        // Determine wiring direction based on relative vertical positions:
        // Drag down: Source node becomes Parent of Target node
        // Drag up: Target node becomes Parent of Source node
        const isDraggingDown = targetPos.y > sourceY;
        if (isDraggingDown) {
          const isAlreadyParent = (targetSkill.parent_ids || []).includes(sourceSkill.id);
          const causesCycle = isAncestor(targetSkill.id, sourceSkill.id, displayedSkills);
          isValid = !isAlreadyParent && !causesCycle;
        } else {
          const isAlreadyParent = (sourceSkill.parent_ids || []).includes(targetSkill.id);
          const causesCycle = isAncestor(sourceSkill.id, targetSkill.id, displayedSkills);
          isValid = !isAlreadyParent && !causesCycle;
        }
      }

      setActiveWiring({
        sourceSkill,
        sourceX,
        sourceY,
        currentX: currentLayoutX,
        currentY: currentLayoutY,
        targetSkill,
        targetPos,
        isValid,
      });
    };

    const handlePointerUp = async () => {
      if (!wiringStartRef.current) return;
      const { hasStartedDrag } = wiringStartRef.current;

      if (hasStartedDrag && activeWiring && activeWiring.targetSkill && activeWiring.isValid) {
        const { sourceSkill, targetSkill, sourceY, targetPos } = activeWiring;
        const isDraggingDown = targetPos ? targetPos.y > sourceY : false;

        if (isDraggingDown) {
          // Source becomes parent of target
          const existingParents = targetSkill.parent_ids || [];
          if (!existingParents.includes(sourceSkill.id)) {
            const nextParents = [...existingParents, sourceSkill.id];
            await db.entities.update(targetSkill.id, { parent_ids: nextParents });
            playCompleteSound();
          }
        } else {
          // Target becomes parent of source
          const existingParents = sourceSkill.parent_ids || [];
          if (!existingParents.includes(targetSkill.id)) {
            const nextParents = [...existingParents, targetSkill.id];
            await db.entities.update(sourceSkill.id, { parent_ids: nextParents });
            playCompleteSound();
          }
        }
      }

      // Small delay to ensure click events don't fire selection
      setTimeout(() => {
        wiringStartRef.current = null;
      }, 50);
      setActiveWiring(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [zoomLevel, treeLayout.nodes, activeWiring, isAncestor, displayedSkills]);

  // Context Menu opener
  const handleOpenContextMenu = useCallback((skill: SkillNodeItem, e: React.MouseEvent) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      skill,
    });
  }, []);

  // Icon Picker opener
  const handleOpenIconPicker = useCallback((skill: SkillNodeItem) => {
    setIconPickerSkill(skill);
  }, []);

  const handleIconSelect = useCallback(
    async (iconName: string) => {
      if (iconPickerSkill) {
        await db.entities.update(iconPickerSkill.id, { icon: iconName });
        if (selectedSkill?.id === iconPickerSkill.id) {
          setSelectedSkill({
            ...selectedSkill,
            icon: iconName,
          });
        }
        setIconPickerSkill(null);
      }
    },
    [iconPickerSkill, selectedSkill],
  );

  // Create Child Skill (from context menu)
  const handleCreateChildFromSkill = useCallback((parentSkill: SkillNodeItem) => {
    setNewSkillParentId(parentSkill.id);
    setNewSkillTier(Math.min(5, parentSkill.tier + 1));
    setNewSkillColor(parentSkill.color || 'sky');
    setNewSkillTitle('');
    setIsCreatingModalOpen(true);
  }, []);

  // Create New Skill Submission (clean initial state, NO default drills)
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
        color: newSkillColor as any,
        status: 'todo',
        time_spent: 0,
        parent_ids,
        content: '', // Clean initial state without default mock drills
        created_at: new Date(),
        sort_order: 9999,
      });

      setNewSkillTitle('');
      setIsCreatingModalOpen(false);
    },
    [newSkillTitle, newSkillTier, newSkillParentId, newSkillColor],
  );

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const transformSurfaceRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#07070a] text-stone-200 overflow-hidden select-none font-mono">
      {/* Background Subtle Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e1e28_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-25" />

      {/* TOP RPG HUD BAR */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-[#0e0e12] border-b border-stone-800 shadow-lg">
        {/* Left: View Switcher & Layout Switcher */}
        <div className="flex items-center gap-3">
          {/* Segmented Switcher back to Mindmap */}
          <div className="flex items-center p-0.5 bg-[#141418] border border-stone-800 rounded-xl">
            <button
              onClick={onSwitchToMindmap}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-all cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Mindmap</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-default">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>RPG Skill Tree</span>
            </button>
          </div>

          {/* Layout Mode Switcher: Tree vs Celestial Orbit */}
          <div className="flex items-center p-0.5 bg-[#141418] border border-stone-800 rounded-xl">
            <button
              onClick={() => handleSetLayoutMode('tree')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                layoutMode === 'orbit'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
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
                className="bg-[#141418] border border-stone-800 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
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
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center font-extrabold text-stone-950 text-xs shadow-sm">
            {stats.level}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest uppercase text-amber-300">
                Level {stats.level}
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-xs text-stone-400">{stats.levelTitle}</span>
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

        {/* Right: Zoom, Display Controls, Stats & Spawner */}
        <div className="flex items-center gap-3">
          {/* Zoom Controller */}
          <div className="flex items-center bg-[#141418] border border-stone-800 rounded-xl p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="px-2 py-1 text-[11px] font-bold text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Reset Zoom & Pan"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 rounded-lg transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Elements Controller Popover */}
          <div className="relative" ref={viewSettingsRef}>
            <button
              onClick={() => setIsViewSettingsOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isViewSettingsOpen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#141418] border-stone-800 text-stone-300 hover:text-stone-100'
              }`}
              title="Configure Visual Display & Tree Spacing"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Display</span>
            </button>

            {isViewSettingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#121215] border border-stone-800 rounded-2xl shadow-2xl z-50 p-3 space-y-3.5 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100 font-mono">
                {/* Spacing & Density Configuration (for Tree Mode) */}
                <div className="space-y-2.5">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-widest text-stone-500 border-b border-stone-800/60 pb-1 flex items-center justify-between">
                    <span>Node Spacing & Density</span>
                    <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Tight', h: 120, v: 120 },
                      { label: 'Normal', h: 155, v: 150 },
                      { label: 'Spacious', h: 190, v: 175 },
                      { label: 'Wide', h: 235, v: 210 },
                    ].map((preset) => {
                      const isSelected =
                        viewSettings.horizontalSpacing === preset.h &&
                        viewSettings.verticalSpacing === preset.v;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => updateSpacingSetting(preset.h, preset.v)}
                          className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-amber-500 text-stone-950 border-amber-400 font-extrabold shadow-sm'
                              : 'bg-[#18181c] border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Horizontal Spacing Slider */}
                  <div className="space-y-1 bg-[#16161b] p-2 rounded-xl border border-stone-800/80">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-stone-400 font-bold">Horizontal Spacing</span>
                      <span className="text-amber-400 font-extrabold">
                        {viewSettings.horizontalSpacing}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={320}
                      step={5}
                      value={viewSettings.horizontalSpacing}
                      onChange={(e) =>
                        updateSingleSpacing('horizontalSpacing', parseInt(e.target.value, 10))
                      }
                      className="w-full h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Vertical Tier Spacing Slider */}
                  <div className="space-y-1 bg-[#16161b] p-2 rounded-xl border border-stone-800/80">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-stone-400 font-bold">Vertical Tier Spacing</span>
                      <span className="text-amber-400 font-extrabold">
                        {viewSettings.verticalSpacing}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={90}
                      max={280}
                      step={5}
                      value={viewSettings.verticalSpacing}
                      onChange={(e) =>
                        updateSingleSpacing('verticalSpacing', parseInt(e.target.value, 10))
                      }
                      className="w-full h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>

                {/* Display Elements Toggles */}
                <div className="space-y-1 pt-1 border-t border-stone-800/60">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-widest text-stone-500 pb-1 flex items-center justify-between">
                    <span>Display Elements</span>
                    <Eye className="w-3 h-3 text-stone-400" />
                  </div>

                  {[
                    { key: 'showConduits', label: 'Laser Lines', desc: 'Connecting conduit lines' },
                    { key: 'showParticles', label: 'Flowing Photons', desc: 'Active energy currents' },
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
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-xs transition-all cursor-pointer text-left ${
                          isActive
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200 border border-transparent'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px] leading-tight">{item.label}</span>
                          <span className="text-[9px] text-stone-500 font-normal leading-tight">
                            {item.desc}
                          </span>
                        </div>
                        <div
                          className={`w-3.5 h-3.5 rounded-md flex items-center justify-center shrink-0 border ${
                            isActive
                              ? 'bg-amber-500 border-amber-400 text-stone-950'
                              : 'border-stone-700 bg-stone-900'
                          }`}
                        >
                          {isActive && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Stats Badges */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
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
            onClick={() => {
              setNewSkillParentId('');
              setNewSkillTier(2);
              setNewSkillTitle('');
              setIsCreatingModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ Skill Node</span>
          </button>
        </div>
      </header>

      {/* MAIN TALENT TREE CANVAS VIEWPORT */}
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
        <div
          ref={transformSurfaceRef}
          className="relative w-full h-full flex flex-col items-center justify-center p-12 transition-transform duration-75 origin-center"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          }}
        >
          {displayedSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center max-w-md space-y-4 z-10">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-500/40 flex items-center justify-center text-amber-400/60">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-stone-200">No Skill Nodes Forged Yet</h3>
              <p className="text-xs text-stone-500">
                Begin your RPG progression path. Forge skills to master competencies, complete drills, and track progress!
              </p>
              <button
                onClick={() => {
                  setNewSkillParentId('');
                  setNewSkillTier(1);
                  setNewSkillTitle('');
                  setIsCreatingModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
              onContextMenu={handleOpenContextMenu}
              onIconClick={handleOpenIconPicker}
            />
          ) : (
            /* HIERARCHICAL SUBTREE TALENT TREE VIEW */
            <div
              ref={treeContainerRef}
              className="relative select-none pointer-events-auto"
              style={{
                width: `${treeLayout.width}px`,
                height: `${treeLayout.height}px`,
                minWidth: '800px',
              }}
            >
              {/* Tier Level Background Guidelines & Ribbons */}
              {viewSettings.showTierBanners &&
                treeLayout.activeTiers.map((tier) => {
                  const bannerInfo = TIER_BANNERS[tier] || {
                    label: `Tier ${tier}`,
                    badgeClass: 'text-stone-400 bg-stone-800 border-stone-700',
                  };
                  const yPos = treeLayout.tierYPositions[tier];
                  return (
                    <div
                      key={`tier-banner-${tier}`}
                      className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-0"
                      style={{ top: `${yPos - 44}px` }}
                    >
                      <div className="w-full border-t border-dashed border-stone-800/60 absolute" />
                      <span
                        className={`relative z-10 text-[10px] font-mono tracking-widest uppercase font-bold px-3 py-0.5 rounded-full border ${bannerInfo.badgeClass} bg-[#07070a]`}
                      >
                        {bannerInfo.label}
                      </span>
                    </div>
                  );
                })}

              {/* Laser Conduits Layer */}
              {viewSettings.showConduits && (
                <SkillLaserConduits
                  conduits={treeLayout.conduits}
                  showParticles={viewSettings.showParticles}
                />
              )}

              {/* Live Wiring Elastic Preview Laser */}
              {activeWiring && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-30">
                  {(() => {
                    const sx = treeLayout.width / 2 + activeWiring.sourceX;
                    const sy = activeWiring.sourceY;
                    const tx =
                      treeLayout.width / 2 +
                      (activeWiring.targetPos ? activeWiring.targetPos.x : activeWiring.currentX);
                    const ty = activeWiring.targetPos ? activeWiring.targetPos.y : activeWiring.currentY;
                    const dy = ty - sy;
                    const cy1 = sy + dy * 0.5;
                    const cy2 = ty - dy * 0.5;
                    const d = `M ${sx} ${sy} C ${sx} ${cy1}, ${tx} ${cy2}, ${tx} ${ty}`;
                    const color = !activeWiring.targetSkill
                      ? '#fbbf24'
                      : activeWiring.isValid
                        ? '#38bdf8'
                        : '#ef4444';

                    return (
                      <g>
                        <path
                          d={d}
                          fill="none"
                          stroke={color}
                          strokeWidth={activeWiring.targetSkill ? 4 : 2.5}
                          strokeDasharray={activeWiring.targetSkill ? undefined : '6 4'}
                          strokeLinecap="round"
                          className="transition-colors duration-150"
                        />
                        <circle
                          cx={tx}
                          cy={ty}
                          r={activeWiring.targetSkill ? 10 : 5}
                          fill={color}
                          fillOpacity={0.8}
                          stroke="#ffffff"
                          strokeWidth={activeWiring.targetSkill ? 2 : 1}
                          className="animate-pulse"
                        />
                      </g>
                    );
                  })()}
                </svg>
              )}

              {/* Positioned Node Medallions */}
              {treeLayout.nodes.map((n) => (
                <div
                  key={n.skill.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{
                    left: `calc(50% + ${n.x}px)`,
                    top: `${n.y}px`,
                  }}
                >
                  <SkillGlyph
                    skill={n.skill}
                    isSelected={selectedSkill?.id === n.skill.id}
                    isHighlighted={activeLineageIds.has(n.skill.id)}
                    isDimmed={activeLineageIds.size > 0 && !activeLineageIds.has(n.skill.id)}
                    showRankBadges={viewSettings.showRankBadges}
                    isWiringSource={activeWiring?.sourceSkill.id === n.skill.id}
                    isWiringTarget={activeWiring?.targetSkill?.id === n.skill.id}
                    isWiringInvalid={activeWiring?.targetSkill?.id === n.skill.id && !activeWiring.isValid}
                    onSelect={handleSelectSkill}
                    onHover={setHoveredSkill}
                    onContextMenu={handleOpenContextMenu}
                    onIconClick={handleOpenIconPicker}
                    onNodePointerDown={handleNodePointerDown}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* RIGHT-CLICK NODE CONTEXT MENU */}
      {contextMenu && (
        <SkillContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          skill={contextMenu.skill}
          availableSp={stats.availableSp}
          onClose={() => setContextMenu(null)}
          onInspect={(skill) => setSelectedSkill(skill)}
          onQuickLevelUp={handleAllocateSp}
          onChangeIcon={handleOpenIconPicker}
          onCreateChild={handleCreateChildFromSkill}
          onToggleMastered={handleToggleMastered}
          onDelete={handleDeleteSkill}
        />
      )}

      {/* ICON PICKER MODAL */}
      {iconPickerSkill && (
        <IconPickerModal
          currentIcon={iconPickerSkill.icon || 'Sparkles'}
          currentColor={(iconPickerSkill.color as any) || 'amber'}
          onSelect={handleIconSelect}
          onClose={() => setIconPickerSkill(null)}
        />
      )}

      {/* RPG TOME INSPECT MODAL */}
      <SkillTomeModal
        skill={selectedSkill}
        availableSp={stats.availableSp}
        onClose={() => setSelectedSkill(null)}
        onAllocateSp={handleAllocateSp}
        onToggleDrill={handleToggleDrill}
        onAddDrill={handleAddDrill}
        onEditDrill={handleEditDrill}
        onDeleteDrill={handleDeleteDrill}
        onDeleteSkill={handleDeleteSkill}
        onUpdateTitle={handleUpdateTitle}
        onUpdateNotes={handleUpdateNotes}
        onUpdateColor={handleUpdateColor}
        onChangeIcon={handleOpenIconPicker}
      />

      {/* REDESIGNED STREAMLINED CREATE NEW SKILL MODAL */}
      {isCreatingModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsCreatingModalOpen(false)}
        >
          <form
            onSubmit={handleCreateSkillSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#111114] border border-stone-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 font-mono"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-100">Forge New Skill Node</h3>
                  <p className="text-[10px] text-stone-500">Create a competency node and link to its prerequisite</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Skill Title Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300">
                Skill Title <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. React Hooks, System Architecture, State Machines..."
                value={newSkillTitle}
                onChange={(e) => setNewSkillTitle(e.target.value)}
                className="w-full bg-[#16161b] border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Prerequisite Parent Skill Linker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300">
                  Parent / Prerequisite Skill
                </label>
                <span className="text-[10px] text-stone-500">Links tree hierarchy</span>
              </div>
              <select
                value={newSkillParentId}
                onChange={(e) => {
                  const parentId = e.target.value;
                  setNewSkillParentId(parentId);
                  if (parentId) {
                    const parentNode = skillNodes.find((s) => s.id === parentId);
                    if (parentNode) {
                      setNewSkillTier(Math.min(5, parentNode.tier + 1));
                      if (parentNode.color) setNewSkillColor(parentNode.color);
                    }
                  } else {
                    setNewSkillTier(1);
                  }
                }}
                className="w-full bg-[#16161b] border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">🌐 None (Root Origin Keystone — Tier 1)</option>
                {skillNodes.map((s) => (
                  <option key={s.id} value={s.id}>
                    Tier {s.tier}: {s.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Tier Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300">
                Hierarchy Tier
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { tier: 1, label: 'T1 Core', desc: 'Keystone' },
                  { tier: 2, label: 'T2 Cluster', desc: 'Major Domain' },
                  { tier: 3, label: 'T3 Topic', desc: 'Concept' },
                  { tier: 4, label: 'T4 Ability', desc: 'Skill' },
                  { tier: 5, label: 'T5 Drill', desc: 'Kata' },
                ].map((item) => (
                  <button
                    key={item.tier}
                    type="button"
                    onClick={() => {
                      setNewSkillTier(item.tier);
                      if (item.tier === 1) setNewSkillColor('amber');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                      newSkillTier === item.tier
                        ? 'bg-amber-500 text-stone-950 border-amber-400 font-extrabold shadow-sm'
                        : 'bg-[#16161b] border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[8px] opacity-75 font-normal">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Elemental Theme Palette */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300">
                Elemental Theme ({ELEMENTAL_THEMES.find((t) => t.id === newSkillColor)?.name || 'Custom'})
              </label>
              <div className="grid grid-cols-8 gap-1.5 p-2 bg-[#16161b] border border-stone-800 rounded-xl max-h-24 overflow-y-auto">
                {ELEMENTAL_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewSkillColor(t.id)}
                    className={`h-6 rounded-lg ${t.bgClass} flex items-center justify-center transition-all cursor-pointer ${
                      newSkillColor === t.id
                        ? 'ring-2 ring-white scale-110 z-10'
                        : 'opacity-50 hover:opacity-100 hover:scale-105'
                    }`}
                    title={t.name}
                  >
                    {newSkillColor === t.id && <Check className="w-3 h-3 text-stone-950 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800/80">
              <button
                type="button"
                onClick={() => setIsCreatingModalOpen(false)}
                className="px-4 py-2 text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newSkillTitle.trim()}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  newSkillTitle.trim()
                    ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm'
                    : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                }`}
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
