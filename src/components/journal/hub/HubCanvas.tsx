import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  MarkerType,
  Viewport,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db';
import { Goal, Objective, Purpose, Domain, Habit } from '../../../types';
import {
  PurposeNode,
  DomainNode,
  GoalNode,
  ObjectiveNode,
  HabitNode,
  GenericCanvasNode,
  CanvasNodeData,
  COLOR_THEMES,
  LUCIDE_ICONS,
  DEFAULT_ICONS,
  renderLucideIcon,
} from './CanvasNodes';

import {
  Compass,
  Layers,
  Target,
  CheckCircle2,
  Repeat2,
  RotateCcw,
  Plus,
  Minus,
  Maximize,
  X,
  Clock,
  Trash2,
  Edit3,
  Unlink,
  MousePointer,
  Hand,
  Bold,
  Italic,
  List,
  CheckSquare,
  Heading,
  Code,
  Eye,
  FileText,
  Calendar,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Link2,
  Palette,
  Settings2,
} from 'lucide-react';
import { formatDuration } from '../../../utils';
import { EntityTypeDefinition, UnifiedEntity, EntityColor } from '../../../types';

const STORAGE_POS_KEY = 'flowday_mindmap_positions_v3';
const STORAGE_VIEWPORT_KEY = 'flowday_mindmap_viewport_v3';
const STORAGE_COLLAPSED_KEY = 'flowday_mindmap_collapsed_v3';
const STORAGE_EDGES_KEY = 'flowday_mindmap_custom_edges_v3';
const STORAGE_COMPLETED_FILTER_KEY = 'flowday_mindmap_completed_filter_v3';

const ICON_PALETTE = Object.keys(LUCIDE_ICONS);
const COLOR_OPTIONS: EntityColor[] = [
  'indigo',
  'sky',
  'amber',
  'emerald',
  'rose',
  'violet',
  'teal',
  'orange',
  'cyan',
  'fuchsia',
];

const nodeTypes = {
  purpose: PurposeNode,
  domain: DomainNode,
  goal: GoalNode,
  objective: ObjectiveNode,
  habit: HabitNode,
  generic: GenericCanvasNode,
  custom: GenericCanvasNode,
};

// ─── Dagre Auto Layout Engine ──────────────────────────────────────────────
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = 'LR',
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 100,
  });

  const visibleNodes = nodes.filter((n) => !n.hidden);

  visibleNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 80 });
  });

  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.hasNode(node.id)
      ? dagreGraph.node(node.id)
      : null;
    return {
      ...node,
      position: nodeWithPosition
        ? {
            x: nodeWithPosition.x - 120,
            y: nodeWithPosition.y - 40,
          }
        : node.position,
    };
  });

  return { nodes: newNodes, edges };
};

// ─── Custom Horizontal Zoom Controls ──────────────────────────────────────
function HorizontalZoomBar({ zoom }: { zoom: number }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 bg-[#121212]/95 backdrop-blur-xl border border-stone-800 p-1 rounded-xl shadow-2xl">
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-850 transition-colors cursor-pointer"
        title="Zoom Out"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => fitView({ duration: 250 })}
        className="px-2 py-1 text-[11px] font-mono text-stone-300 hover:text-amber-400 hover:bg-stone-850 rounded-md transition-colors cursor-pointer font-bold"
        title="Reset Zoom to Fit"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        onClick={() => zoomIn({ duration: 200 })}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-850 transition-colors cursor-pointer"
        title="Zoom In"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-stone-800 mx-0.5" />

      <button
        onClick={() => fitView({ duration: 250 })}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-850 transition-colors cursor-pointer"
        title="Fit View"
      >
        <Maximize className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Lightweight Markdown Renderer ─────────────────────────────────────────
function RenderMarkdown({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <div className="text-stone-500 italic text-xs py-4 text-center">
        No notes or description written yet.
      </div>
    );
  }

  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-stone-200 text-xs leading-relaxed font-sans select-text">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-amber-300 pt-2 pb-0.5 border-b border-stone-800">
              {line.replace('### ', '')}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-amber-400 pt-3 pb-1 border-b border-stone-800">
              {line.replace('## ', '')}
            </h2>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-lg font-extrabold text-amber-400 pt-3 pb-1 border-b border-stone-800">
              {line.replace('# ', '')}
            </h1>
          );
        }

        // Checkbox item
        if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
          return (
            <div key={idx} className="flex items-start gap-2 text-stone-400 line-through">
              <span className="text-emerald-400 font-bold shrink-0">✓</span>
              <span>{line.replace(/- \[[xX]\] /, '')}</span>
            </div>
          );
        }
        if (line.startsWith('- [ ] ')) {
          return (
            <div key={idx} className="flex items-start gap-2 text-stone-200">
              <span className="w-3.5 h-3.5 border border-stone-600 rounded mt-0.5 shrink-0 inline-block" />
              <span>{line.replace('- [ ] ', '')}</span>
            </div>
          );
        }

        // Bullet list
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-amber-400 font-bold">•</span>
              <span>{line.replace(/^[-*] /, '')}</span>
            </div>
          );
        }

        // Quote
        if (line.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-2 border-amber-500/60 pl-3 py-1 text-stone-400 italic bg-amber-500/5 rounded-r">
              {line.replace('> ', '')}
            </blockquote>
          );
        }

        // Code block or inline code
        if (line.startsWith('```')) {
          return null; // simple single-line fallback
        }

        // Empty line
        if (!line.trim()) {
          return <div key={idx} className="h-1.5" />;
        }

        return <p key={idx}>{line}</p>;
      })}
    </div>
  );
}

interface HubCanvasProps {
  onSwitchToHabits?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: Node;
  data: CanvasNodeData;
}

function InnerHubCanvas({ onSwitchToHabits }: HubCanvasProps) {
  const reactFlowInstance = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [inspectNode, setInspectNode] = useState<CanvasNodeData | null>(null);
  const [isCreatingType, setIsCreatingType] = useState<string | null>(null);
  const [creatingParent, setCreatingParent] = useState<CanvasNodeData | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('Target');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Inspector Dock States
  const [inspectTab, setInspectTab] = useState<'strategy' | 'relations'>('strategy');
  const [markdownMode, setMarkdownMode] = useState<'edit' | 'preview'>('edit');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Collapsed Branches Set
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COLLAPSED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Mode State: 'pan' (default hand navigation) vs 'select' (box marquee multi-select)
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');

  // Completed Items Display Filter: 'show' | 'dim' | 'hide'
  const [completedFilterMode, setCompletedFilterMode] = useState<'show' | 'dim' | 'hide'>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COMPLETED_FILTER_KEY);
      return (raw as 'show' | 'dim' | 'hide') || 'show';
    } catch {
      return 'show';
    }
  });

  const handleCompletedFilterChange = useCallback((mode: 'show' | 'dim' | 'hide') => {
    setCompletedFilterMode(mode);
    try {
      localStorage.setItem(STORAGE_COMPLETED_FILTER_KEY, mode);
    } catch {}
  }, []);

  // Editable Inspector States
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editIcon, setEditIcon] = useState('Target');

  // Query entity types and unified entities
  const rawEntityTypes = useLiveQuery(() => db.entity_types.toArray());
  const rawEntities = useLiveQuery(() => db.entities.toArray());

  const entityTypesList = useMemo(() => rawEntityTypes || [], [rawEntityTypes]);
  const entityTypeMap = useMemo(() => {
    const map = new Map<string, EntityTypeDefinition>();
    entityTypesList.forEach((t) => map.set(t.id, t));
    return map;
  }, [entityTypesList]);

  const entitiesList = useMemo(() => rawEntities || [], [rawEntities]);

  // Modal State for creating a new Custom Entity Type
  const [isCreatingCustomType, setIsCreatingCustomType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState<EntityColor>('violet');
  const [newTypeIcon, setNewTypeIcon] = useState('Rocket');
  const [newTypeHasStatus, setNewTypeHasStatus] = useState(true);
  const [newTypeHasTime, setNewTypeHasTime] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Node position cache (in-memory ref + localStorage)
  const posCacheRef = useRef<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_POS_KEY);
      if (raw) posCacheRef.current = JSON.parse(raw);
    } catch {}
  }, []);

  const savePositions = useCallback((newNodes: Node[]) => {
    try {
      newNodes.forEach((n) => {
        if (n.position) {
          posCacheRef.current[n.id] = { x: n.position.x, y: n.position.y };
        }
      });
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(posCacheRef.current));
    } catch {}
  }, []);

  // Save Viewport & update zoom state
  const handleViewportChange = useCallback((viewport: Viewport) => {
    setZoomLevel(viewport.zoom);
    try {
      localStorage.setItem(STORAGE_VIEWPORT_KEY, JSON.stringify(viewport));
    } catch {}
  }, []);

  const defaultViewport = useMemo<Viewport | undefined>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_VIEWPORT_KEY);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }, []);

  // Node Inspector Callback
  const handleInspect = useCallback((data: CanvasNodeData) => {
    setInspectNode(data);
    setEditTitle(data.title || '');
    setEditContent(data.description || data.rawEntry?.content || data.rawEntry?.description || '');
    setEditStatus(data.status || 'active');
    setEditIcon(data.icon || DEFAULT_ICONS[data.type] || 'Target');
    setContextMenu(null);
    setMarkdownMode('preview');
    setShowIconPicker(false);
  }, []);

  // Quick Status Change from Context Menu
  const handleQuickChangeStatus = useCallback(async (data: CanvasNodeData, nextStatus: string) => {
    const rawId = data.id;
    const type = data.type;

    // Update unified entities table
    await db.entities.update(rawId, { status: nextStatus });

    // Sync with legacy tables
    if (type === 'habit') {
      await db.habits.update(rawId, { status: nextStatus as any }).catch(() => {});
    } else if (type === 'goal' || type === 'objective') {
      await db.entries.update(rawId, { status: nextStatus } as any).catch(() => {});
    }

    setContextMenu(null);
  }, []);

  // Quick Rename directly from node double click
  const handleQuickRename = useCallback(async (id: string, updatedTitle: string) => {
    const [type, rawId] = id.split('-');
    // Update unified entities table
    await db.entities.update(rawId, { title: updatedTitle });

    // Sync with legacy tables if existing for backward compatibility
    if (type === 'purpose') {
      await db.purposes.update(rawId, { title: updatedTitle } as any).catch(() => {});
    } else if (type === 'domain') {
      await db.domains.update(rawId, { name: updatedTitle, title: updatedTitle } as any).catch(() => {});
    } else if (type === 'habit') {
      await db.habits.update(rawId, { title: updatedTitle } as any).catch(() => {});
    } else {
      await db.entries.update(rawId, { title: updatedTitle } as any).catch(() => {});
    }
  }, []);

  // Quick Update Description / Notes directly from node card
  const handleQuickUpdateDescription = useCallback(
    async (id: string, updatedDescription: string) => {
      const [type, rawId] = id.split('-');
      await db.entities.update(rawId, { content: updatedDescription });

      if (type === 'purpose') {
        await db.purposes.update(rawId, { description: updatedDescription } as any).catch(() => {});
      } else if (type === 'domain') {
        await db.domains.update(rawId, { description: updatedDescription } as any).catch(() => {});
      } else if (type === 'goal' || type === 'objective') {
        await db.entries.update(rawId, { description: updatedDescription } as any).catch(() => {});
      }
    },
    [],
  );

  // Change Node Icon directly
  const handleChangeIcon = useCallback(async (id: string, updatedIcon: string) => {
    const [type, rawId] = id.split('-');
    await db.entities.update(rawId, { icon: updatedIcon });

    if (type === 'purpose') {
      await db.purposes.update(rawId, { icon: updatedIcon } as any).catch(() => {});
    } else if (type === 'domain') {
      await db.domains.update(rawId, { icon: updatedIcon } as any).catch(() => {});
    } else if (type === 'habit') {
      await db.habits.update(rawId, { icon: updatedIcon } as any).catch(() => {});
    } else {
      await db.entries.update(rawId, { icon: updatedIcon } as any).catch(() => {});
    }
  }, []);

  // Toggle Collapse / Expand Subtree
  const handleToggleCollapse = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setCollapsedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(STORAGE_COLLAPSED_KEY, JSON.stringify([...next]));
        } catch {}
        return next;
      });
    },
    [],
  );

  // Quick Add Child from node plus handle
  const handleQuickAddChild = useCallback(
    (parentData: CanvasNodeData, e: React.MouseEvent) => {
      e.stopPropagation();
      setCreatingParent(parentData);
      setContextMenu(null);
      if (parentData.type === 'purpose' || parentData.type === 'domain') {
        setIsCreatingType('goal');
        setNewIcon('Target');
      } else if (parentData.type === 'goal') {
        setIsCreatingType('objective');
        setNewIcon('CheckCircle2');
      } else {
        setIsCreatingType('habit');
        setNewIcon('Repeat2');
      }
    },
    [],
  );

  // Build Graph Nodes and Edges from Unified DB Entities
  useEffect(() => {
    // Wait until Dexie liveQueries have initially loaded
    if (rawEntities === undefined || rawEntityTypes === undefined) {
      return;
    }

    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];

    // Map parent-child relationships
    const parentChildMap = new Set<string>();
    entitiesList.forEach((e) => {
      e.parent_ids?.forEach((pid) => parentChildMap.add(`${pid}`));
    });

    entitiesList.forEach((entity, idx) => {
      const typeDef = entityTypeMap.get(entity.entity_type) || {
        id: entity.entity_type,
        name: entity.entity_type.toUpperCase(),
        color: 'indigo' as EntityColor,
        icon: 'Target',
        is_system: false,
        has_status: true,
        has_time_tracking: true,
      };

      const id = `${entity.entity_type}-${entity.id}`;
      const savedPos = posCacheRef.current[id] || posCacheRef.current[entity.id];
      const hasChildren = parentChildMap.has(entity.id) || parentChildMap.has(id);
      const isCollapsed = collapsedNodes.has(id) || collapsedNodes.has(entity.id);

      const isCompleted =
        entity.status === 'done' || entity.status === 'achieved' || entity.status === 'completed';

      // Check if all parents are collapsed
      const hasParents = entity.parent_ids && entity.parent_ids.length > 0;
      const isParentCollapsed = hasParents
        ? entity.parent_ids!.every((pid) => {
            const pEntity = entitiesList.find((item) => item.id === pid);
            const parentKey = pEntity ? `${pEntity.entity_type}-${pEntity.id}` : pid;
            return collapsedNodes.has(parentKey) || collapsedNodes.has(pid);
          })
        : false;

      const isHiddenByFilter = completedFilterMode === 'hide' && isCompleted;
      const isDimmed = completedFilterMode === 'dim' && isCompleted;

      // Select node component type: specialized for system types or generic for custom
      const reactFlowNodeNodeType =
        entity.entity_type === 'purpose'
          ? 'purpose'
          : entity.entity_type === 'domain'
            ? 'domain'
            : entity.entity_type === 'goal'
              ? 'goal'
              : entity.entity_type === 'objective'
                ? 'objective'
                : entity.entity_type === 'habit'
                  ? 'habit'
                  : 'generic';

      rawNodes.push({
        id,
        type: reactFlowNodeNodeType,
        hidden: isParentCollapsed || isHiddenByFilter,
        position: savedPos || {
          x: typeDef.sort_order !== undefined ? typeDef.sort_order * 260 : 600,
          y: idx * 95,
        },
        data: {
          id: entity.id,
          title: entity.title,
          icon: entity.icon || typeDef.icon || 'Target',
          type: entity.entity_type,
          typeName: typeDef.name,
          color: entity.color || typeDef.color || 'indigo',
          status: entity.status,
          time_spent: entity.time_spent,
          description: entity.content || '',
          rawEntry: entity,
          hasChildren,
          isCollapsed,
          isDimmed,
          hasStatus: typeDef.has_status,
          hasTimeTracking: typeDef.has_time_tracking,
          onInspect: handleInspect,
          onToggleCollapse: handleToggleCollapse,
          onQuickRename: (newT: string) => handleQuickRename(id, newT),
          onChangeIcon: (newI: string) => handleChangeIcon(id, newI),
          onQuickUpdateDescription: (newD: string) => handleQuickUpdateDescription(id, newD),
        },
      });

      // Render parent edges
      if (entity.parent_ids && entity.parent_ids.length > 0) {
        entity.parent_ids.forEach((pid) => {
          const parentEntity = entitiesList.find((item) => item.id === pid);
          const parentFullId = parentEntity
            ? `${parentEntity.entity_type}-${parentEntity.id}`
            : pid;

          const strokeColor = isCompleted
            ? '#10b98190'
            : typeDef.color === 'amber'
              ? '#818cf8'
              : typeDef.color === 'emerald'
                ? '#34d399'
                : typeDef.color === 'rose'
                  ? '#fb7185'
                  : '#a855f7';

          rawEdges.push({
            id: `e-${parentFullId}-${id}`,
            source: parentFullId,
            target: id,
            animated: !isCompleted,
            style: {
              stroke: strokeColor,
              strokeWidth: isCompleted ? 1.5 : 2,
              strokeDasharray: isCompleted ? '5 5' : undefined,
              opacity: isDimmed ? 0.35 : 1,
              cursor: 'pointer',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: strokeColor,
            },
          });
        });
      }
    });

    // Load custom persisted edges from localStorage, pruning any orphaned edges
    const validNodeIdSet = new Set(rawNodes.map((n) => n.id));
    try {
      const raw = localStorage.getItem(STORAGE_EDGES_KEY);
      if (raw) {
        const customEdges: Edge[] = JSON.parse(raw);
        const validCustomEdges: Edge[] = [];
        customEdges.forEach((ce) => {
          if (validNodeIdSet.has(ce.source) && validNodeIdSet.has(ce.target)) {
            validCustomEdges.push(ce);
            if (!rawEdges.some((re) => re.source === ce.source && re.target === ce.target)) {
              rawEdges.push(ce);
            }
          }
        });
        if (validCustomEdges.length !== customEdges.length && rawNodes.length > 0) {
          localStorage.setItem(STORAGE_EDGES_KEY, JSON.stringify(validCustomEdges));
        }
      }
    } catch {}

    // Initial Layout calculation if cache is completely empty
    if (Object.keys(posCacheRef.current).length === 0) {
      const layouted = getLayoutedElements(rawNodes, rawEdges, 'LR');
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      savePositions(layouted.nodes);
    } else {
      setNodes(rawNodes);
      setEdges(rawEdges);
    }
  }, [
    entitiesList,
    entityTypesList,
    entityTypeMap,
    collapsedNodes,
    completedFilterMode,
    handleInspect,
    handleToggleCollapse,
    handleQuickAddChild,
    handleQuickRename,
    handleChangeIcon,
    savePositions,
  ]);

  // Handle Drag Node Stop to persist coordinates (single or bulk)
  const handleNodeDragStop = useCallback(
    (_: any, node: Node, draggedNodes?: Node[]) => {
      setNodes((currentNodes) => {
        savePositions(currentNodes);
        return currentNodes;
      });
    },
    [savePositions, setNodes],
  );

  const handleSelectionDragStop = useCallback(
    (_: any, draggedNodes: Node[]) => {
      setNodes((currentNodes) => {
        savePositions(currentNodes);
        return currentNodes;
      });
    },
    [savePositions, setNodes],
  );

  // Handle Edge Click to Select Edge for Deletion
  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setContextMenu(null);
  }, []);

  // Delete Connection (Wire) and update Dexie DB + localStorage
  const handleDeleteEdge = useCallback(
    async (edge: Edge) => {
      const [, sourceId] = edge.source.split('-');
      const [, targetId] = edge.target.split('-');

      // Update parent_ids on unified entities table
      const targetEntity = entitiesList.find((e) => e.id === targetId);
      if (targetEntity) {
        const nextParents = (targetEntity.parent_ids || []).filter((pid) => pid !== sourceId);
        await db.entities.update(targetId, { parent_ids: nextParents });
      }

      const sourceEntity = entitiesList.find((e) => e.id === sourceId);
      if (sourceEntity) {
        const nextParents = (sourceEntity.parent_ids || []).filter((pid) => pid !== targetId);
        await db.entities.update(sourceId, { parent_ids: nextParents });
      }

      // LocalStorage custom edge cache update
      try {
        const raw = localStorage.getItem(STORAGE_EDGES_KEY);
        if (raw) {
          const edgeList: Edge[] = JSON.parse(raw);
          const filtered = edgeList.filter((e) => e.id !== edge.id);
          localStorage.setItem(STORAGE_EDGES_KEY, JSON.stringify(filtered));
        }
      } catch {}

      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      setSelectedEdge(null);
    },
    [entitiesList, setEdges],
  );

  // Handle Drag Wire Connection & Sync DB + localStorage
  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;

      const [, sourceId] = params.source.split('-');
      const [, targetId] = params.target.split('-');

      // Link target to source parent in db.entities
      const targetEntity = entitiesList.find((e) => e.id === targetId);
      if (targetEntity) {
        const current = targetEntity.parent_ids || [];
        if (!current.includes(sourceId)) {
          await db.entities.update(targetId, {
            parent_ids: [...current, sourceId],
          });
        }
      }

      const newEdge: Edge = {
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        animated: true,
        style: { stroke: '#f59e0b', strokeWidth: 2, cursor: 'pointer' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
      };

      // Save to localStorage
      try {
        const raw = localStorage.getItem(STORAGE_EDGES_KEY);
        const edgeList: Edge[] = raw ? JSON.parse(raw) : [];
        if (!edgeList.some((e) => e.source === newEdge.source && e.target === newEdge.target)) {
          edgeList.push(newEdge);
          localStorage.setItem(STORAGE_EDGES_KEY, JSON.stringify(edgeList));
        }
      } catch {}

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [entitiesList, setEdges],
  );

  // Auto-Tidy Layout
  const handleAutoLayout = () => {
    const layouted = getLayoutedElements(nodes, edges, 'LR');
    setNodes(layouted.nodes);
    savePositions(layouted.nodes);
  };

  // Node Creation Handler (Supports Built-in & Custom Entity Types)
  const handleCreateNode = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !isCreatingType) return;

    const newId = crypto.randomUUID();
    const typeDef = entityTypeMap.get(isCreatingType);
    const parentIds: string[] = creatingParent ? [creatingParent.id] : [];

    const defaultInitialStatus =
      isCreatingType === 'objective'
        ? 'todo'
        : typeDef?.has_status
          ? 'active'
          : undefined;

    // 1. Calculate spawn position inside the current visible canvas view
    const fullNodeId = `${isCreatingType}-${newId}`;
    let spawnPosition: { x: number; y: number } = { x: 0, y: 0 };

    if (creatingParent) {
      const parentFullId = `${creatingParent.type}-${creatingParent.id}`;
      const parentPos = posCacheRef.current[parentFullId] || { x: 200, y: 200 };
      // Count existing siblings to offset vertically
      const existingSiblings = entitiesList.filter((e) =>
        (e.parent_ids || []).includes(creatingParent.id),
      ).length;
      spawnPosition = {
        x: parentPos.x + 280,
        y: parentPos.y + (existingSiblings * 80) - 20,
      };
    } else {
      // Spawn near the center of the current canvas viewport
      try {
        const centerPos = reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2 + (Math.random() * 60 - 30),
          y: window.innerHeight / 2 + (Math.random() * 60 - 30),
        });
        spawnPosition = {
          x: Math.round(centerPos.x),
          y: Math.round(centerPos.y),
        };
      } catch {
        const fallbackX = typeDef?.sort_order !== undefined ? typeDef.sort_order * 260 : 300;
        spawnPosition = { x: fallbackX, y: 150 };
      }
    }

    // Cache position immediately
    posCacheRef.current[fullNodeId] = spawnPosition;
    try {
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(posCacheRef.current));
    } catch {}

    // 2. Add to unified entities table
    await db.entities.add({
      id: newId,
      entity_type: isCreatingType,
      title: trimmed,
      icon: newIcon || typeDef?.icon || 'Target',
      color: typeDef?.color || 'indigo',
      status: defaultInitialStatus,
      time_spent: 0,
      parent_ids: parentIds,
      created_at: new Date(),
    });

    // 3. Backward compatibility sync for built-ins
    if (isCreatingType === 'purpose') {
      await db.purposes
        .add({
          id: newId,
          title: trimmed,
          icon: newIcon || 'Compass',
          created_at: new Date(),
        })
        .catch(() => {});
    } else if (isCreatingType === 'domain') {
      await db.domains
        .add({
          id: newId,
          title: trimmed,
          name: trimmed,
          color: 'sky',
          icon: newIcon || 'Layers',
          created_at: new Date(),
        })
        .catch(() => {});
    } else if (isCreatingType === 'goal') {
      await db.entries
        .add({
          id: newId,
          type: 'goal',
          title: trimmed,
          icon: newIcon || 'Target',
          time_spent: 0,
          status: 'active',
          purpose_ids: parentIds,
          created_at: new Date(),
        } as any)
        .catch(() => {});
    } else if (isCreatingType === 'objective') {
      await db.entries
        .add({
          id: newId,
          type: 'objective',
          title: trimmed,
          icon: newIcon || 'CheckCircle2',
          time_spent: 0,
          status: 'todo',
          goal_id: creatingParent?.id,
          created_at: new Date(),
        } as any)
        .catch(() => {});
    } else if (isCreatingType === 'habit') {
      await db.habits
        .add({
          id: newId,
          title: trimmed,
          icon: newIcon || 'Repeat2',
          status: 'active',
          purpose_ids: parentIds,
          created_at: new Date(),
        })
        .catch(() => {});
    }

    setNewTitle('');
    setNewIcon('Target');
    setIsCreatingType(null);
    setCreatingParent(null);
  };

  // Save Node Edit in Inspector
  const handleSaveInspectNode = async () => {
    if (!inspectNode) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    // Update in unified entities table
    await db.entities.update(inspectNode.id, {
      title: trimmedTitle,
      icon: editIcon,
      content: editContent,
      status: editStatus,
    });

    // Update in legacy tables
    if (inspectNode.type === 'purpose') {
      await db.purposes
        .update(inspectNode.id, {
          title: trimmedTitle,
          icon: editIcon || 'Compass',
          description: editContent,
        } as any)
        .catch(() => {});
    } else if (inspectNode.type === 'domain') {
      await db.domains
        .update(inspectNode.id, {
          name: trimmedTitle,
          title: trimmedTitle,
          icon: editIcon || 'Layers',
          description: editContent,
        } as any)
        .catch(() => {});
    } else if (inspectNode.type === 'habit') {
      await db.habits
        .update(inspectNode.id, {
          title: trimmedTitle,
          status: editStatus as any,
          icon: editIcon || 'Repeat2',
          description: editContent,
        } as any)
        .catch(() => {});
    } else {
      await db.entries
        .update(inspectNode.id, {
          title: trimmedTitle,
          status: editStatus as any,
          content: editContent,
          icon: editIcon || (inspectNode.type === 'goal' ? 'Target' : 'CheckCircle2'),
        } as any)
        .catch(() => {});
    }

    setInspectNode((prev) =>
      prev
        ? {
            ...prev,
            title: trimmedTitle,
            status: editStatus,
            icon: editIcon,
            description: editContent,
          }
        : null,
    );
  };

  // Create New Custom Entity Type Handler
  const handleCreateCustomType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    const id = `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
    const newDef: EntityTypeDefinition = {
      id,
      name: trimmed,
      plural_name: `${trimmed}s`,
      color: newTypeColor,
      icon: newTypeIcon,
      is_system: false,
      has_status: newTypeHasStatus,
      has_time_tracking: newTypeHasTime,
      sort_order: entityTypesList.length,
    };

    await db.entity_types.add(newDef);
    setIsCreatingCustomType(false);
    setNewTypeName('');
  };

  // Delete Node Handler with cascading edge and foreign key cleanup
  const handleDeleteNode = async (data: CanvasNodeData) => {
    if (confirm(`Delete "${data.title}"?`)) {
      const fullNodeId = `${data.type}-${data.id}`;

      // 1. Delete from Dexie
      if (data.type === 'purpose') {
        await db.purposes.delete(data.id);
        // Unlink purpose from goals & habits
        const affectedGoals = await db.entries.where('type').equals('goal').toArray();
        for (const g of affectedGoals) {
          if (g.purpose_ids?.includes(data.id)) {
            await db.entries.update(g.id, {
              purpose_ids: g.purpose_ids.filter((pid: string) => pid !== data.id),
            } as any);
          }
        }
        const affectedHabits = await db.habits.toArray();
        for (const h of affectedHabits) {
          if (h.purpose_ids?.includes(data.id)) {
            await db.habits.update(h.id, {
              purpose_ids: h.purpose_ids.filter((pid: string) => pid !== data.id),
            } as any);
          }
        }
      } else if (data.type === 'domain') {
        await db.domains.delete(data.id);
        // Unlink domain from goals
        const affectedGoals = await db.entries.where('type').equals('goal').toArray();
        for (const g of affectedGoals) {
          if (g.domain_ids?.includes(data.id)) {
            await db.entries.update(g.id, {
              domain_ids: g.domain_ids.filter((did: string) => did !== data.id),
            } as any);
          }
        }
      } else if (data.type === 'habit') {
        await db.habits.delete(data.id);
      } else if (data.type === 'goal') {
        await db.entries.delete(data.id);
        // Unlink objectives belonging to this goal
        const childObjectives = await db.entries.where('goal_id').equals(data.id).toArray();
        for (const obj of childObjectives) {
          await db.entries.update(obj.id, { goal_id: undefined } as any);
        }
      } else {
        await db.entries.delete(data.id);
      }

      // 2. Clean up custom edges from localStorage
      try {
        const raw = localStorage.getItem(STORAGE_EDGES_KEY);
        if (raw) {
          const edgeList: Edge[] = JSON.parse(raw);
          const filtered = edgeList.filter(
            (e) => e.source !== fullNodeId && e.target !== fullNodeId,
          );
          localStorage.setItem(STORAGE_EDGES_KEY, JSON.stringify(filtered));
        }
      } catch {}

      // 3. Clean up cached position
      if (posCacheRef.current[fullNodeId]) {
        delete posCacheRef.current[fullNodeId];
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(posCacheRef.current));
      }

      setInspectNode(null);
      setContextMenu(null);
    }
  };

  // Right-Click Context Menu Handler
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        node,
        data: node.data as any,
      });
      setSelectedEdge(null);
    },
    [],
  );

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
    setSelectedEdge(null);
  }, []);

  return (
    <div
      onClick={handlePaneClick}
      className="w-full h-full flex-1 relative flex flex-col bg-[#0a0a0a] overflow-hidden rounded-2xl border border-stone-850 shadow-inner"
    >
      {/* ─── Top Control Toolbar: Hub Switcher + Mindmap Search & Tidy ──────── */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none gap-2 flex-wrap">
        {/* Left: Primary Hub Switcher (System Canvas | Habits Studio) */}
        <div className="flex items-center gap-1 bg-[#121212]/95 backdrop-blur-xl border border-stone-800 p-1 rounded-xl shadow-2xl pointer-events-auto">
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)] select-none cursor-default">
            <Compass className="w-3.5 h-3.5" />
            <span>🌐 System Canvas</span>
          </button>
          <button
            onClick={onSwitchToHabits}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 transition-all cursor-pointer select-none"
          >
            <Repeat2 className="w-3.5 h-3.5" />
            <span>🔄 Habits Studio</span>
          </button>
        </div>

        {/* Right: Completed Filter + Select | Pan Switcher & Auto-Tidy */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap justify-end">
          {/* Completed Nodes Filter Toggle */}
          <div className="flex items-center gap-0.5 bg-[#121212]/95 backdrop-blur-xl border border-stone-800 p-1 rounded-xl shadow-lg">
            <span className="text-[10px] font-mono text-stone-500 uppercase px-1.5 font-bold hidden sm:inline">
              🏆 Done:
            </span>
            <button
              onClick={() => handleCompletedFilterChange('show')}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                completedFilterMode === 'show'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Show all completed goals and objectives normally"
            >
              Show
            </button>
            <button
              onClick={() => handleCompletedFilterChange('dim')}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                completedFilterMode === 'dim'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Dim completed goals and objectives (focus on active)"
            >
              Dim
            </button>
            <button
              onClick={() => handleCompletedFilterChange('hide')}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                completedFilterMode === 'hide'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Hide all completed goals and objectives from canvas"
            >
              Hide
            </button>
          </div>

          {/* Pan vs Select Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-[#121212]/95 backdrop-blur-xl border border-stone-800 p-1 rounded-xl shadow-lg">
            <button
              onClick={() => setInteractionMode('pan')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                interactionMode === 'pan'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Pan Mode (Drag to move canvas. Hold Shift/Ctrl to select)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan</span>
            </button>
            <button
              onClick={() => setInteractionMode('select')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                interactionMode === 'select'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Select Mode (Drag to marquee multi-select. Hold Space/Middle-click to pan)"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>
          </div>

          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121212]/90 backdrop-blur-md hover:bg-[#181818] border border-stone-800 text-stone-300 hover:text-amber-400 rounded-xl text-xs font-mono font-semibold transition-all shadow-lg cursor-pointer active:scale-95"
            title="Auto-align tree branches into clean columns"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Auto-Tidy Tree</span>
          </button>
        </div>
      </div>

      {/* ─── Selected Connection Banner (Delete Connection) ────────────────── */}
      {selectedEdge && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#161314]/95 backdrop-blur-xl border border-rose-500/50 px-4 py-2 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-xs font-mono text-rose-300">
            <Unlink className="w-3.5 h-3.5" />
            <span>Connection Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDeleteEdge(selectedEdge)}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            >
              Delete Wire
            </button>
            <button
              onClick={() => setSelectedEdge(null)}
              className="p-1 text-stone-400 hover:text-stone-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── React Flow Mindmap Tree Canvas ─────────────────────────────────── */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={handleEdgeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneClick={handlePaneClick}
          onNodeDragStop={handleNodeDragStop}
          onSelectionDragStop={handleSelectionDragStop}
          onViewportChange={handleViewportChange}
          defaultViewport={defaultViewport}
          nodeTypes={nodeTypes}
          fitView={!defaultViewport}
          selectionOnDrag={interactionMode === 'select'}
          panOnDrag={interactionMode === 'pan' ? [0, 1, 2] : [1, 2]}
          selectionKeyCode={interactionMode === 'pan' ? ['Shift', 'Meta', 'Control'] : null}
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
          className="bg-[#080808]"
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background
            color="#222"
            gap={24}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
          
          {/* Custom Horizontal Zoom Controls */}
          <HorizontalZoomBar zoom={zoomLevel} />

          {/* Mini View with Rounded 2xl border */}
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'purpose':
                  return '#818cf8';
                case 'domain':
                  return '#38bdf8';
                case 'goal':
                  return '#f59e0b';
                case 'objective':
                  return '#34d399';
                case 'habit':
                  return '#fb7185';
                default:
                  return '#555';
              }
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
            className="!bg-[#101010] !border !border-stone-800 !rounded-2xl hidden sm:block shadow-2xl !overflow-hidden !bottom-4 !right-4"
          />
        </ReactFlow>
      </div>

      {/* ─── Right-Click Context Menu ──────────────────────────────────────── */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-52 bg-[#121212]/98 backdrop-blur-xl border border-stone-800 rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
        >
          <div className="px-2.5 py-1.5 border-b border-stone-850 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-bold">
              {contextMenu.data.type} Actions
            </span>
          </div>

          <button
            onClick={() => handleInspect(contextMenu.data)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-stone-200 hover:bg-stone-850 hover:text-amber-400 text-left transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-500" />
            <span>Open Details</span>
          </button>

          <button
            onClick={(e) => {
              handleQuickAddChild(contextMenu.data, e);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-stone-200 hover:bg-stone-850 hover:text-emerald-400 text-left transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              Add {contextMenu.data.type === 'goal' ? 'Objective' : contextMenu.data.type === 'purpose' ? 'Goal' : 'Child'}
            </span>
          </button>

          {/* Quick Status Changers for entities with status */}
          {(contextMenu.data.hasStatus ||
            contextMenu.data.type === 'goal' ||
            contextMenu.data.type === 'objective' ||
            contextMenu.data.type === 'habit' ||
            !['purpose', 'domain'].includes(contextMenu.data.type)) && (
            <div className="border-t border-stone-850 my-1 pt-1 space-y-0.5">
              <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500 px-2 py-0.5 block">
                Change Status
              </span>

              <button
                onClick={() => {
                  const activeVal = contextMenu.data.type === 'objective' ? 'todo' : 'active';
                  handleQuickChangeStatus(contextMenu.data, activeVal);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono text-left transition-colors cursor-pointer ${
                  contextMenu.data.status === 'active' || contextMenu.data.status === 'todo'
                    ? 'bg-amber-500/15 text-amber-400 font-bold'
                    : 'text-stone-300 hover:bg-stone-850 hover:text-amber-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Active</span>
                </div>
                {(contextMenu.data.status === 'active' || contextMenu.data.status === 'todo') && (
                  <span className="text-[10px]">✓</span>
                )}
              </button>

              <button
                onClick={() => {
                  const doneVal = contextMenu.data.type === 'goal' ? 'achieved' : 'done';
                  handleQuickChangeStatus(contextMenu.data, doneVal);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono text-left transition-colors cursor-pointer ${
                  contextMenu.data.status === 'done' || contextMenu.data.status === 'achieved'
                    ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                    : 'text-stone-300 hover:bg-stone-850 hover:text-emerald-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{contextMenu.data.type === 'goal' ? 'Achieved' : 'Done'}</span>
                </div>
                {(contextMenu.data.status === 'done' || contextMenu.data.status === 'achieved') && (
                  <span className="text-[10px]">✓</span>
                )}
              </button>

              <button
                onClick={() => handleQuickChangeStatus(contextMenu.data, 'archived')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono text-left transition-colors cursor-pointer ${
                  contextMenu.data.status === 'archived'
                    ? 'bg-stone-800 text-stone-300 font-bold'
                    : 'text-stone-400 hover:bg-stone-850 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-stone-500" />
                  <span>Archived</span>
                </div>
                {contextMenu.data.status === 'archived' && (
                  <span className="text-[10px]">✓</span>
                )}
              </button>
            </div>
          )}

          {(contextMenu.data.type === 'goal' || contextMenu.data.type === 'objective') && (
            <button
              onClick={async () => {
                await db.entries.add({
                  id: crypto.randomUUID(),
                  type: 'task',
                  title: `Focus on ${contextMenu.data.title}`,
                  status: 'todo',
                  time_spent: 0,
                  scheduled_at: new Date(),
                  objective_id:
                    contextMenu.data.type === 'objective' ? contextMenu.data.id : undefined,
                  created_at: new Date(),
                } as any);
                setContextMenu(null);
                alert(`Added task to today's timeline!`);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-stone-200 hover:bg-stone-850 hover:text-sky-400 text-left transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              <span>Schedule for Today</span>
            </button>
          )}

          <div className="border-t border-stone-850 my-1 pt-1">
            <button
              onClick={() => handleDeleteNode(contextMenu.data)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-rose-400 hover:bg-rose-500/10 text-left transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete {contextMenu.data.type}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Bottom Floating Node Spawner Dock ──────────────────────────────── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#121212]/95 backdrop-blur-md border border-stone-800 p-1.5 rounded-2xl shadow-2xl overflow-x-auto max-w-[95vw] scrollbar-none">
        {entityTypesList.map((t) => {
          const theme = COLOR_THEMES[t.color] || COLOR_THEMES.indigo;
          return (
            <button
              key={t.id}
              onClick={() => {
                setCreatingParent(null);
                setIsCreatingType(t.id);
                setNewIcon(t.icon || 'Target');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder} text-xs font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0`}
            >
              {renderLucideIcon(t.icon, 'Target', 'w-3.5 h-3.5')}
              <span>+ {t.name}</span>
            </button>
          );
        })}

        {/* Create New Custom Entity Type Button */}
        <button
          onClick={() => setIsCreatingCustomType(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-750 hover:border-amber-500/50 text-xs font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
          title="Create a custom entity type (e.g. Project, Skill, Book, Principle)"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>New Type</span>
        </button>
      </div>

      {/* ─── Custom Entity Type Definition Modal ─────────────────────────────── */}
      {isCreatingCustomType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#141416] border border-stone-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-850 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-100">Create Custom Entity Type</h3>
                  <p className="text-[10px] font-mono text-stone-400">Add a new building block to your life graph</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreatingCustomType(false)}
                className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Type Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block">
                  Type Name (Singular)
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="e.g. Project, Skill, Principle, Book, Milestone..."
                  autoFocus
                  className="w-full bg-[#1c1c20] border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-stone-100 font-medium focus:outline-none shadow-inner"
                />
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block">
                  Color Accent
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTypeColor(c)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono capitalize transition-all cursor-pointer border ${
                        newTypeColor === c
                          ? `${COLOR_THEMES[c]?.badgeBg} ${COLOR_THEMES[c]?.badgeText} ${COLOR_THEMES[c]?.badgeBorder} font-bold scale-105 shadow-sm`
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block">
                  Default Icon
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 text-amber-400 flex items-center justify-center">
                    {renderLucideIcon(newTypeIcon, 'Target', 'w-4 h-4')}
                  </div>
                  <div className="flex-1 grid grid-cols-8 gap-1 max-h-24 overflow-y-auto pr-1 bg-stone-900/60 p-1.5 rounded-xl border border-stone-800">
                    {ICON_PALETTE.map((iconKey) => (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setNewTypeIcon(iconKey)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          newTypeIcon === iconKey
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60'
                            : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
                        }`}
                        title={iconKey}
                      >
                        {renderLucideIcon(iconKey, 'Target', 'w-3 h-3')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature Capabilities Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 bg-stone-900/60 p-2.5 rounded-xl border border-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTypeHasStatus}
                    onChange={(e) => setNewTypeHasStatus(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span className="text-[11px] text-stone-300 font-mono">Has Status (Done / Active)</span>
                </label>
                <label className="flex items-center gap-2 bg-stone-900/60 p-2.5 rounded-xl border border-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTypeHasTime}
                    onChange={(e) => setNewTypeHasTime(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span className="text-[11px] text-stone-300 font-mono">Track Focus Time</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-850">
              <button
                type="button"
                onClick={() => setIsCreatingCustomType(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-mono text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomType}
                disabled={!newTypeName.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
              >
                Save Entity Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Node Creation Modal Popup ─────────────────────────────────────── */}
      {isCreatingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-stone-800 rounded-2xl p-4 w-full max-w-md shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Create New {entityTypeMap.get(isCreatingType)?.name || isCreatingType}
                {creatingParent && (
                  <span className="text-stone-400 lowercase font-normal">
                    under {creatingParent.title}
                  </span>
                )}
              </span>
              <button
                onClick={() => {
                  setIsCreatingType(null);
                  setCreatingParent(null);
                }}
                className="text-stone-500 hover:text-stone-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lucide Icon Palette Picker */}
            <div className="flex items-center gap-1.5 flex-wrap p-2 bg-[#0a0a0a] rounded-xl border border-stone-850 max-h-28 overflow-y-auto">
              {ICON_PALETTE.map((iconKey) => (
                <button
                  key={iconKey}
                  type="button"
                  onClick={() => setNewIcon(iconKey)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    newIcon === iconKey
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 scale-110'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/80'
                  }`}
                  title={iconKey}
                >
                  {renderLucideIcon(iconKey, 'Target', 'w-3.5 h-3.5')}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <div className="w-9 h-9 rounded-xl bg-[#0a0a0a] border border-stone-800 flex items-center justify-center text-amber-400 shrink-0">
                {renderLucideIcon(newIcon, 'Target', 'w-4 h-4')}
              </div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNode();
                  if (e.key === 'Escape') {
                    setIsCreatingType(null);
                    setCreatingParent(null);
                  }
                }}
                placeholder={`Enter ${isCreatingType} title...`}
                autoFocus
                className="flex-1 bg-[#0a0a0a] border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 font-sans focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setIsCreatingType(null);
                  setCreatingParent(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNode}
                className="px-4 py-1.5 bg-amber-500 text-stone-950 font-bold rounded-lg text-xs hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Node Inspector Sleek Docked Sidebar ───────────────────────────── */}
      {inspectNode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-0 right-0 bottom-0 w-full sm:w-[420px] md:w-[460px] bg-[#101012]/98 backdrop-blur-2xl border-l border-stone-800 shadow-[-12px_0_40px_rgba(0,0,0,0.8)] z-40 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250"
        >
          {/* Top Header Bar */}
          <div className="p-4 border-b border-stone-850 bg-[#141416]/70 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase font-bold tracking-wider border shadow-sm flex items-center gap-1.5 ${
                  inspectNode.type === 'purpose'
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                    : inspectNode.type === 'domain'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                      : inspectNode.type === 'goal'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                        : inspectNode.type === 'objective'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                }`}
              >
                {renderLucideIcon(editIcon, 'Target', 'w-3 h-3')}
                <span>{inspectNode.type} Details</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Quick toggle completed for Goals / Objectives */}
              {inspectNode.type === 'goal' && (
                <button
                  type="button"
                  onClick={() => {
                    const next = editStatus === 'achieved' ? 'active' : 'achieved';
                    setEditStatus(next);
                    setTimeout(handleSaveInspectNode, 50);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                    editStatus === 'achieved'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                      : 'bg-stone-850 text-stone-300 border-stone-750 hover:border-emerald-500/50 hover:text-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{editStatus === 'achieved' ? 'Achieved' : 'Mark Achieved'}</span>
                </button>
              )}

              {inspectNode.type === 'objective' && (
                <button
                  type="button"
                  onClick={() => {
                    const next = editStatus === 'done' ? 'todo' : 'done';
                    setEditStatus(next);
                    setTimeout(handleSaveInspectNode, 50);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                    editStatus === 'done'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                      : 'bg-stone-850 text-stone-300 border-stone-750 hover:border-emerald-500/50 hover:text-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{editStatus === 'done' ? 'Completed' : 'Mark Done'}</span>
                </button>
              )}

              <button
                onClick={() => setInspectNode(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Close Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Title & Icon Row */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {/* Popover Icon Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker((prev) => !prev)}
                    className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/60 flex items-center justify-center text-amber-400 transition-all cursor-pointer shadow-sm hover:scale-105"
                    title="Change Icon"
                  >
                    {renderLucideIcon(editIcon, 'Target', 'w-5 h-5')}
                  </button>

                  {/* Popover Icon Palette */}
                  {showIconPicker && (
                    <div className="absolute top-12 left-0 z-50 w-64 bg-[#141416] border border-stone-750 p-2.5 rounded-2xl shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                        <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-bold">
                          Select Icon
                        </span>
                        <button
                          onClick={() => setShowIconPicker(false)}
                          className="text-stone-500 hover:text-stone-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto pr-1">
                        {ICON_PALETTE.map((iconKey) => (
                          <button
                            key={iconKey}
                            type="button"
                            onClick={() => {
                              setEditIcon(iconKey);
                              setShowIconPicker(false);
                              setTimeout(handleSaveInspectNode, 50);
                            }}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              editIcon === iconKey
                                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 scale-110'
                                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
                            }`}
                            title={iconKey}
                          >
                            {renderLucideIcon(iconKey, 'Target', 'w-3.5 h-3.5')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <textarea
                    rows={Math.min(5, Math.max(1, Math.ceil((editTitle || '').length / 28)))}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSaveInspectNode}
                    placeholder="Title..."
                    className="w-full bg-[#161618] border border-stone-800 focus:border-amber-500/50 rounded-xl px-3.5 py-2 text-sm font-semibold text-stone-100 font-sans focus:outline-none shadow-inner resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Status & Metrics Strip */}
            <div className="grid grid-cols-2 gap-2">
              {/* Status Selector */}
              {((inspectNode as any).hasStatus ||
                inspectNode.type === 'goal' ||
                inspectNode.type === 'objective' ||
                inspectNode.type === 'habit' ||
                !['purpose', 'domain'].includes(inspectNode.type)) && (
                <div className="space-y-1 bg-[#141416] p-2.5 rounded-xl border border-stone-850">
                  <label className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block font-bold">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => {
                      setEditStatus(e.target.value);
                      setTimeout(handleSaveInspectNode, 50);
                    }}
                    className="w-full bg-transparent border-0 text-xs font-mono text-amber-300 focus:outline-none cursor-pointer font-bold"
                  >
                    {inspectNode.type === 'goal' && (
                      <>
                        <option value="active" className="bg-stone-900 text-stone-200">Active Goal</option>
                        <option value="achieved" className="bg-stone-900 text-emerald-400">Achieved (Done)</option>
                        <option value="archived" className="bg-stone-900 text-stone-400">Archived</option>
                      </>
                    )}
                    {inspectNode.type === 'objective' && (
                      <>
                        <option value="todo" className="bg-stone-900 text-stone-200">In Progress</option>
                        <option value="done" className="bg-stone-900 text-emerald-400">Completed</option>
                        <option value="archived" className="bg-stone-900 text-stone-400">Archived</option>
                      </>
                    )}
                    {inspectNode.type === 'habit' && (
                      <>
                        <option value="active" className="bg-stone-900 text-rose-300">Active Routine</option>
                        <option value="archived" className="bg-stone-900 text-stone-400">Archived</option>
                      </>
                    )}
                    {!['goal', 'objective', 'habit', 'purpose', 'domain'].includes(inspectNode.type) && (
                      <>
                        <option value="active" className="bg-stone-900 text-stone-200">Active</option>
                        <option value="done" className="bg-stone-900 text-emerald-400">Done / Completed</option>
                        <option value="archived" className="bg-stone-900 text-stone-400">Archived</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Time Spent Counter */}
              {inspectNode.time_spent !== undefined ? (
                <div className="space-y-1 bg-[#141416] p-2.5 rounded-xl border border-stone-850">
                  <label className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block font-bold flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-amber-500" />
                    <span>Focus Logged</span>
                  </label>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    {formatDuration(inspectNode.time_spent)}
                  </div>
                </div>
              ) : (
                <div className="space-y-1 bg-[#141416] p-2.5 rounded-xl border border-stone-850">
                  <label className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block font-bold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                    <span>Entity Type</span>
                  </label>
                  <div className="text-xs font-mono font-bold capitalize text-stone-300">
                    {inspectNode.type}
                  </div>
                </div>
              )}
            </div>

            {/* Completed Milestone Victory Banner */}
            {(editStatus === 'achieved' || editStatus === 'done') && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.12)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold">
                    🏆
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-emerald-300">
                      {inspectNode.type === 'goal' ? 'Goal Achieved!' : 'Objective Completed!'}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400/80">
                      Milestone saved to timeline & trophy history
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs: Strategy / Notes vs Relationships */}
            <div className="flex items-center gap-1 border-b border-stone-800 pb-1">
              <button
                onClick={() => setInspectTab('strategy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  inspectTab === 'strategy'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Strategy & Notes</span>
              </button>

              <button
                onClick={() => setInspectTab('relations')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  inspectTab === 'relations'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Relations</span>
              </button>
            </div>

            {/* TAB 1: Markdown Strategy & Notes (Default: Rendered Markdown, Click to Edit) */}
            {inspectTab === 'strategy' && (
              <div className="space-y-2">
                {/* Header & Formatting Toolbar (Visible when editing or always accessible) */}
                <div className="flex items-center justify-between bg-[#141416] p-1.5 rounded-xl border border-stone-850">
                  {/* Left: Markdown formatting helpers */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMarkdownMode('edit');
                        const ta = textareaRef.current;
                        if (!ta) {
                          setEditContent((prev) => `${prev} **bold text**`);
                          return;
                        }
                        const start = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const text = ta.value;
                        const selected = text.substring(start, end) || 'bold text';
                        const next = `${text.substring(0, start)}**${selected}**${text.substring(end)}`;
                        setEditContent(next);
                        setTimeout(handleSaveInspectNode, 50);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Bold (**text**)"
                    >
                      <Bold className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMarkdownMode('edit');
                        const ta = textareaRef.current;
                        if (!ta) {
                          setEditContent((prev) => `${prev} *italic text*`);
                          return;
                        }
                        const start = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const text = ta.value;
                        const selected = text.substring(start, end) || 'italic text';
                        const next = `${text.substring(0, start)}*${selected}*${text.substring(end)}`;
                        setEditContent(next);
                        setTimeout(handleSaveInspectNode, 50);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Italic (*text*)"
                    >
                      <Italic className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMarkdownMode('edit');
                        setEditContent((prev) => `${prev}\n### Heading\n`);
                        setTimeout(handleSaveInspectNode, 50);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Heading (### Title)"
                    >
                      <Heading className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMarkdownMode('edit');
                        setEditContent((prev) => `${prev}\n- List item\n`);
                        setTimeout(handleSaveInspectNode, 50);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Bullet List (- item)"
                    >
                      <List className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMarkdownMode('edit');
                        setEditContent((prev) => `${prev}\n- [ ] Task checkbox\n`);
                        setTimeout(handleSaveInspectNode, 50);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Checkbox Task (- [ ] item)"
                    >
                      <CheckSquare className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Right: Quick Action Hint / Done Editing */}
                  {markdownMode === 'edit' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMarkdownMode('preview');
                        handleSaveInspectNode();
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition-all cursor-pointer shadow-sm"
                    >
                      Done Editing
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-stone-500 pr-1 select-none">
                      Click box to edit
                    </span>
                  )}
                </div>

                {/* Click-to-Edit Markdown Content Box */}
                {markdownMode === 'edit' ? (
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onBlur={() => {
                      setMarkdownMode('preview');
                      handleSaveInspectNode();
                    }}
                    placeholder="Write detailed notes, strategy, key milestones, vision, or markdown checklists (- [ ])..."
                    className="w-full bg-[#141416] border border-amber-500/40 focus:border-amber-400 rounded-xl p-3 text-xs text-stone-200 font-mono leading-relaxed h-52 resize-none focus:outline-none shadow-inner"
                  />
                ) : (
                  <div
                    onClick={() => setMarkdownMode('edit')}
                    className="w-full bg-[#141416] border border-stone-800 hover:border-stone-700 rounded-xl p-3 min-h-[13rem] max-h-72 overflow-y-auto shadow-inner cursor-pointer transition-colors group"
                    title="Click anywhere to edit markdown notes"
                  >
                    {editContent.trim() ? (
                      <RenderMarkdown content={editContent} />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8 text-stone-600 group-hover:text-stone-500 transition-colors">
                        <FileText className="w-6 h-6 mb-1.5 opacity-40" />
                        <span className="text-xs font-mono">
                          Click to add strategy notes, checklists, and vision...
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Hierarchy & Relations Matrix */}
            {inspectTab === 'relations' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#141416] border border-stone-850 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-amber-400" />
                    Connected Graph Wires
                  </span>

                  {/* List connections from current node */}
                  {(() => {
                    const fullId = `${inspectNode.type}-${inspectNode.id}`;
                    const connected = edges.filter(
                      (e) => e.source === fullId || e.target === fullId,
                    );

                    if (connected.length === 0) {
                      return (
                        <div className="text-xs text-stone-500 italic py-2">
                          No direct connections linked yet. Drag handles on the canvas to connect any node!
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1.5">
                        {connected.map((edge) => {
                          const isSource = edge.source === fullId;
                          const otherNodeId = isSource ? edge.target : edge.source;
                          const otherNode = nodes.find((n) => n.id === otherNodeId);

                          return (
                            <div
                              key={edge.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-xs font-mono"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-stone-500">{isSource ? '→' : '←'}</span>
                                <span className="text-stone-200 font-semibold truncate">
                                  {(otherNode?.data as any)?.title || otherNodeId}
                                </span>
                                <span className="text-[9px] text-stone-500 uppercase">
                                  ({otherNode?.type || 'node'})
                                </span>
                              </div>

                              <button
                                onClick={() => handleDeleteEdge(edge)}
                                className="text-stone-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                                title="Disconnect Wire"
                              >
                                <Unlink className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Quick Actions (Day timeline schedule) */}
            <div className="pt-2">
              <button
                onClick={async () => {
                  await db.entries.add({
                    id: crypto.randomUUID(),
                    type: 'task',
                    title: `Focus on ${inspectNode.title}`,
                    status: 'todo',
                    time_spent: 0,
                    scheduled_at: new Date(),
                    objective_id:
                      inspectNode.type === 'objective' ? inspectNode.id : undefined,
                    created_at: new Date(),
                  } as any);
                  alert(`Added task to today's timeline!`);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Focus Task for Today</span>
              </button>
            </div>
          </div>

          {/* Dock Footer */}
          <div className="p-3 border-t border-stone-850 bg-[#141416]/70 flex items-center justify-between shrink-0">
            <span className="text-[9px] font-mono text-stone-500">
              Auto-saved to local database
            </span>

            <button
              onClick={() => handleDeleteNode(inspectNode)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-rose-400 hover:bg-rose-500/15 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete {inspectNode.type}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HubCanvas(props: HubCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerHubCanvas {...props} />
    </ReactFlowProvider>
  );
}
