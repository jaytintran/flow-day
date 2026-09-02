/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
import { EntityTypeDefinition, UnifiedEntity, EntityColor } from '../../../types';
import {
  UniversalCanvasNode,
  UniversalNodeData,
  LUCIDE_ICONS,
  DEFAULT_ICONS,
  renderLucideIcon,
  COLOR_THEMES,
} from './UniversalCanvasNode';

import {
  Sparkles,
  Plus,
  Minus,
  Maximize,
  X,
  Trash2,
  Edit3,
  Unlink,
  MousePointer,
  Hand,
  Bold,
  Italic,
  List,
  CheckSquare,
  FileText,
  ChevronRight,
  ChevronDown,
  Link2,
  Palette,
  Search,
  Zap,
} from 'lucide-react';
import { formatDuration } from '../../../utils';

const STORAGE_POS_KEY = 'flowday_neural_graph_positions_v1';
const STORAGE_VIEWPORT_KEY = 'flowday_neural_graph_viewport_v1';
const STORAGE_COLLAPSED_KEY = 'flowday_neural_graph_collapsed_v1';
const STORAGE_FILTER_KEY = 'flowday_neural_graph_filter_v1';

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
  universal: UniversalCanvasNode,
  purpose: UniversalCanvasNode,
  domain: UniversalCanvasNode,
  goal: UniversalCanvasNode,
  objective: UniversalCanvasNode,
  habit: UniversalCanvasNode,
  generic: UniversalCanvasNode,
  custom: UniversalCanvasNode,
};

// ─── Auto Layout Engine (Radial Galaxy, LR Mindmap, TB Waterfall) ───────────
const computeLayout = (
  nodes: Node[],
  edges: Edge[],
  direction: 'RADIAL' | 'LR' | 'TB' = 'RADIAL',
) => {
  if (direction === 'RADIAL') {
    const rootNodes = nodes.filter((n) => !edges.some((e) => e.target === n.id));
    const centerNodeIds = rootNodes.length > 0 ? rootNodes.map((n) => n.id) : [nodes[0]?.id];
    const visited = new Set<string>();
    const posMap = new Map<string, { x: number; y: number }>();

    const centerX = 600;
    const centerY = 400;

    centerNodeIds.forEach((id, idx) => {
      if (!id) return;
      const angle = (idx / Math.max(1, centerNodeIds.length)) * 2 * Math.PI;
      const radius = centerNodeIds.length > 1 ? 140 : 0;
      posMap.set(id, {
        x: Math.round(centerX + radius * Math.cos(angle)),
        y: Math.round(centerY + radius * Math.sin(angle)),
      });
      visited.add(id);
    });

    let currentLayer = [...centerNodeIds];
    let layerRadius = 240;

    while (currentLayer.length > 0) {
      const nextLayer: string[] = [];
      currentLayer.forEach((parentId) => {
        const parentPos = posMap.get(parentId) || { x: centerX, y: centerY };
        const childEdges = edges.filter((e) => e.source === parentId && !visited.has(e.target));
        const childCount = childEdges.length;

        childEdges.forEach((e, cIdx) => {
          visited.add(e.target);
          nextLayer.push(e.target);
          const spreadAngle = childCount > 1 ? ((cIdx - (childCount - 1) / 2) / childCount) * (Math.PI * 0.95) : 0;
          const baseAngle = Math.atan2(parentPos.y - centerY, parentPos.x - centerX) || 0;
          const finalAngle = baseAngle + spreadAngle;

          posMap.set(e.target, {
            x: Math.round(parentPos.x + layerRadius * Math.cos(finalAngle)),
            y: Math.round(parentPos.y + layerRadius * Math.sin(finalAngle)),
          });
        });
      });
      currentLayer = nextLayer;
      layerRadius += 180;
    }

    nodes.forEach((n, idx) => {
      if (!posMap.has(n.id)) {
        posMap.set(n.id, { x: centerX + (idx % 4) * 240 - 360, y: centerY + Math.floor(idx / 4) * 120 + 350 });
      }
    });

    return {
      nodes: nodes.map((node) => ({ ...node, position: posMap.get(node.id) || node.position })),
      edges,
    };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: direction === 'LR' ? 35 : 55,
    ranksep: direction === 'LR' ? 75 : 85,
  });

  nodes.forEach((node) => {
    const tier = (node.data as any)?.tier || 2;
    const width = tier === 5 ? 120 : tier === 4 ? 140 : tier === 3 ? 180 : tier === 1 ? 290 : 240;
    const height = tier === 5 ? 30 : tier === 4 ? 40 : tier === 3 ? 50 : tier === 1 ? 95 : 75;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.hasNode(node.id) ? dagreGraph.node(node.id) : null;
    return {
      ...node,
      position: nodeWithPosition
        ? {
            x: nodeWithPosition.x - (nodeWithPosition.width || 200) / 2,
            y: nodeWithPosition.y - (nodeWithPosition.height || 70) / 2,
          }
        : node.position,
    };
  });

  return { nodes: newNodes, edges };
};

// ─── Lightweight Markdown Renderer ─────────────────────────────────────────
function RenderMarkdown({ content }: { content: string }) {
  if (!content.trim()) {
    return <div className="text-stone-500 italic text-xs py-4 text-center">No strategy notes written yet.</div>;
  }
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-stone-200 text-xs leading-relaxed font-mono select-text">
      {lines.map((line, idx) => {
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-xs font-bold text-amber-300 pt-1 border-b border-stone-800">{line.replace('### ', '')}</h3>;
        }
        if (line.startsWith('## ') || line.startsWith('# ')) {
          return <h2 key={idx} className="text-sm font-bold text-amber-400 pt-2 pb-0.5 border-b border-stone-800">{line.replace(/^#+\s/, '')}</h2>;
        }
        if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
          return (
            <div key={idx} className="flex items-center gap-1.5 text-stone-400 line-through">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>{line.replace(/- \[[xX]\] /, '')}</span>
            </div>
          );
        }
        if (line.startsWith('- [ ] ')) {
          return (
            <div key={idx} className="flex items-center gap-1.5 text-stone-200">
              <span className="w-3 h-3 border border-stone-600 rounded shrink-0 inline-block" />
              <span>{line.replace('- [ ] ', '')}</span>
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 text-stone-300">
              <span className="text-amber-400">•</span>
              <span>{line.replace(/^[-*]\s/, '')}</span>
            </div>
          );
        }
        return <p key={idx}>{line}</p>;
      })}
    </div>
  );
}

// ─── Inner Canvas Component ────────────────────────────────────────────────
function InnerHubCanvas() {
  const reactFlowInstance = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [inspectNode, setInspectNode] = useState<UniversalNodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Sprout Modal
  const [isCreatingType, setIsCreatingType] = useState<string | null>(null);
  const [creatingParent, setCreatingParent] = useState<UniversalNodeData | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('Target');

  // New Custom Entity Type Modal
  const [isCreatingCustomType, setIsCreatingCustomType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState<EntityColor>('violet');
  const [newTypeIcon, setNewTypeIcon] = useState('Brain');

  // Inspector States
  const [inspectTab, setInspectTab] = useState<'strategy' | 'relations'>('strategy');
  const [markdownMode, setMarkdownMode] = useState<'edit' | 'preview'>('preview');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editIcon, setEditIcon] = useState('Target');
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Filter & Mode
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');
  const [completedFilter, setCompletedFilter] = useState<'show' | 'dim' | 'hide'>('show');

  // Collapsed branches
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COLLAPSED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Position cache in localStorage
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
        if (n.position) posCacheRef.current[n.id] = { x: n.position.x, y: n.position.y };
      });
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(posCacheRef.current));
    } catch {}
  }, []);

  // Live Dexie Subscriptions
  const rawEntities = useLiveQuery(() => db.entities.toArray());
  const rawEntityTypes = useLiveQuery(() => db.entity_types.toArray());

  const entitiesList = useMemo(() => rawEntities || [], [rawEntities]);
  const entityTypesList = useMemo(() => rawEntityTypes || [], [rawEntityTypes]);
  const entityTypeMap = useMemo(() => {
    const map = new Map<string, EntityTypeDefinition>();
    entityTypesList.forEach((t) => map.set(t.id, t));
    return map;
  }, [entityTypesList]);

  // Handle Inspect Node
  const handleInspect = useCallback((data: UniversalNodeData) => {
    setInspectNode(data);
    setEditTitle(data.title || '');
    setEditContent(data.description || data.rawEntity?.content || '');
    setEditStatus(data.status || 'active');
    setEditIcon(data.icon || DEFAULT_ICONS[data.type] || 'Target');
    setMarkdownMode('preview');
    setShowIconPicker(false);
  }, []);

  // Quick Rename directly from node double-click
  const handleQuickRename = useCallback(async (id: string, updatedTitle: string) => {
    const rawId = id.replace(/^[a-z0-9_-]+-/, '');
    await db.entities.update(rawId, { title: updatedTitle });
  }, []);

  // Toggle Collapse Branch
  const handleToggleCollapse = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  // ─── Build Graph Nodes & Synaptic Wires ───────────────────────────────────
  useEffect(() => {
    if (rawEntities === undefined || rawEntityTypes === undefined) return;

    const depthMap = new Map<string, number>();
    const computeDepth = (entityId: string, visited = new Set<string>()): number => {
      if (visited.has(entityId)) return 0;
      if (depthMap.has(entityId)) return depthMap.get(entityId)!;
      visited.add(entityId);

      const entity = entitiesList.find((e) => e.id === entityId);
      if (!entity || !entity.parent_ids || entity.parent_ids.length === 0) {
        depthMap.set(entityId, 0);
        return 0;
      }

      let maxParentDepth = 0;
      for (const pid of entity.parent_ids) {
        maxParentDepth = Math.max(maxParentDepth, computeDepth(pid, new Set(visited)));
      }
      const myDepth = maxParentDepth + 1;
      depthMap.set(entityId, myDepth);
      return myDepth;
    };

    entitiesList.forEach((e) => computeDepth(e.id));

    const parentChildMap = new Set<string>();
    entitiesList.forEach((e) => e.parent_ids?.forEach((pid) => parentChildMap.add(pid)));

    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];

    entitiesList.forEach((entity, idx) => {
      const typeDef = entityTypeMap.get(entity.entity_type) || {
        id: entity.entity_type,
        name: entity.entity_type.toUpperCase(),
        color: 'indigo' as EntityColor,
        icon: DEFAULT_ICONS[entity.entity_type] || 'Target',
        is_system: false,
        has_status: true,
        has_time_tracking: true,
      };

      const depth = depthMap.get(entity.id) || 0;
      // 5-Tier Scale: 1 = Galaxy Root (0), 2 = Major Pillar (1), 3 = Topic (2), 4 = Micro-Skill (3), 5 = Atomic Leaf (4+)
      const tier: 1 | 2 | 3 | 4 | 5 = depth === 0 ? 1 : depth === 1 ? 2 : depth === 2 ? 3 : depth === 3 ? 4 : 5;

      const fullId = `${entity.entity_type}-${entity.id}`;
      const savedPos = posCacheRef.current[fullId] || posCacheRef.current[entity.id];
      const hasChildren = parentChildMap.has(entity.id);
      const isCollapsed = collapsedNodes.has(fullId) || collapsedNodes.has(entity.id);

      const isDone = entity.status === 'done' || entity.status === 'achieved' || entity.status === 'completed';

      const hasParents = entity.parent_ids && entity.parent_ids.length > 0;
      const isParentCollapsed = hasParents
        ? entity.parent_ids!.every((pid) => {
            const pEntity = entitiesList.find((item) => item.id === pid);
            const parentKey = pEntity ? `${pEntity.entity_type}-${pEntity.id}` : pid;
            return collapsedNodes.has(parentKey) || collapsedNodes.has(pid);
          })
        : false;

      const isHidden = completedFilter === 'hide' && isDone;
      const isDimmed = completedFilter === 'dim' && isDone;

      rawNodes.push({
        id: fullId,
        type: 'universal',
        hidden: isParentCollapsed || isHidden,
        position: savedPos || { x: depth * 260 + (idx % 3) * 30, y: idx * 85 },
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
          rawEntity: entity,
          hasChildren,
          isCollapsed,
          isDimmed,
          tier,
          onInspect: handleInspect,
          onToggleCollapse: handleToggleCollapse,
          onQuickRename: (newT: string) => handleQuickRename(fullId, newT),
        },
      });

      // Synaptic Curved Wires
      if (entity.parent_ids && entity.parent_ids.length > 0) {
        entity.parent_ids.forEach((pid) => {
          const parentEntity = entitiesList.find((item) => item.id === pid);
          const parentFullId = parentEntity ? `${parentEntity.entity_type}-${parentEntity.id}` : pid;
          const strokeColor = isDone ? '#10b981' : COLOR_THEMES[typeDef.color]?.accentColor || '#818cf8';

          rawEdges.push({
            id: `e-${parentFullId}-${fullId}`,
            source: parentFullId,
            target: fullId,
            type: 'default',
            animated: !isDone && !isDimmed,
            style: {
              stroke: strokeColor,
              strokeWidth: tier >= 4 ? 1.5 : 2,
              strokeDasharray: isDone ? '4 4' : undefined,
              opacity: isDimmed ? 0.3 : tier >= 4 ? 0.7 : 0.9,
              cursor: 'pointer',
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor, width: 12, height: 12 },
          });
        });
      }
    });

    if (Object.keys(posCacheRef.current).length === 0 && rawNodes.length > 0) {
      const layouted = computeLayout(rawNodes, rawEdges, 'RADIAL');
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
    completedFilter,
    handleInspect,
    handleToggleCollapse,
    handleQuickRename,
    savePositions,
  ]);

  // Connect Handle Wire -> Mutates Dexie parent_ids directly
  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;
      const sourceRawId = params.source.replace(/^[a-z0-9_-]+-/, '');
      const targetRawId = params.target.replace(/^[a-z0-9_-]+-/, '');

      const targetEntity = entitiesList.find((e) => e.id === targetRawId);
      if (targetEntity) {
        const current = targetEntity.parent_ids || [];
        if (!current.includes(sourceRawId)) {
          await db.entities.update(targetRawId, { parent_ids: [...current, sourceRawId] });
        }
      }
    },
    [entitiesList],
  );

  // Delete Edge Wire
  const handleDeleteEdge = useCallback(
    async (edge: Edge) => {
      const sourceRawId = edge.source.replace(/^[a-z0-9_-]+-/, '');
      const targetRawId = edge.target.replace(/^[a-z0-9_-]+-/, '');

      const targetEntity = entitiesList.find((e) => e.id === targetRawId);
      if (targetEntity) {
        const nextParents = (targetEntity.parent_ids || []).filter((pid) => pid !== sourceRawId);
        await db.entities.update(targetRawId, { parent_ids: nextParents });
      }

      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      setSelectedEdge(null);
    },
    [entitiesList, setEdges],
  );

  // Save Node Edit in Inspector
  const handleSaveInspectNode = async () => {
    if (!inspectNode) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    await db.entities.update(inspectNode.id, {
      title: trimmedTitle,
      icon: editIcon,
      content: editContent,
      status: editStatus,
    });

    setInspectNode((prev) =>
      prev ? { ...prev, title: trimmedTitle, status: editStatus, icon: editIcon, description: editContent } : null,
    );
  };

  // Delete Node Handler
  const handleDeleteNode = async (nodeData: UniversalNodeData) => {
    if (confirm(`Delete "${nodeData.title}" and clean up child connections?`)) {
      await db.entities.delete(nodeData.id);

      // Clean up parents referencing this
      const children = entitiesList.filter((e) => e.parent_ids?.includes(nodeData.id));
      for (const child of children) {
        const nextP = (child.parent_ids || []).filter((pid) => pid !== nodeData.id);
        await db.entities.update(child.id, { parent_ids: nextP });
      }

      const fullId = `${nodeData.type}-${nodeData.id}`;
      if (posCacheRef.current[fullId]) {
        delete posCacheRef.current[fullId];
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(posCacheRef.current));
      }

      setInspectNode(null);
    }
  };

  // Create Node Handler
  const handleCreateNode = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !isCreatingType) return;

    const newId = crypto.randomUUID();
    const typeDef = entityTypeMap.get(isCreatingType);
    const parentIds: string[] = creatingParent ? [creatingParent.id] : [];

    const spawnPos = creatingParent
      ? {
          x: (posCacheRef.current[`${creatingParent.type}-${creatingParent.id}`]?.x || 300) + 240,
          y: (posCacheRef.current[`${creatingParent.type}-${creatingParent.id}`]?.y || 300) + Math.random() * 60 - 30,
        }
      : { x: 500 + Math.random() * 100 - 50, y: 350 + Math.random() * 100 - 50 };

    posCacheRef.current[`${isCreatingType}-${newId}`] = spawnPos;
    try {
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(posCacheRef.current));
    } catch {}

    await db.entities.add({
      id: newId,
      entity_type: isCreatingType,
      title: trimmed,
      icon: newIcon || typeDef?.icon || 'Target',
      color: typeDef?.color || 'indigo',
      status: 'active',
      time_spent: 0,
      parent_ids: parentIds,
      created_at: new Date(),
    });

    setNewTitle('');
    setIsCreatingType(null);
    setCreatingParent(null);
  };

  // Create Custom Type
  const handleCreateCustomType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    const id = `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
    await db.entity_types.add({
      id,
      name: trimmed,
      plural_name: `${trimmed}s`,
      color: newTypeColor,
      icon: newTypeIcon,
      is_system: false,
      has_status: true,
      has_time_tracking: true,
      sort_order: entityTypesList.length,
    });

    setIsCreatingCustomType(false);
    setNewTypeName('');
  };

  return (
    <div className="w-full h-full relative flex overflow-hidden bg-[#0a0a0c]">
      {/* ─── Floating Top Glass Control Bar ───────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 max-w-[95vw] overflow-x-auto p-1.5 bg-[#121214]/90 backdrop-blur-2xl border border-stone-800/80 rounded-2xl shadow-2xl">
        {/* Fit Canvas */}
        <button
          onClick={() => reactFlowInstance.fitView({ duration: 300 })}
          className="p-1.5 rounded-xl border border-stone-800 hover:border-amber-500/50 text-stone-400 hover:text-amber-400 bg-[#161618] transition-all cursor-pointer"
          title="Fit Canvas View"
        >
          <Maximize className="w-4 h-4" />
        </button>

        {/* Layout Modes */}
        <div className="flex items-center gap-0.5 bg-[#161618] border border-stone-800/80 p-0.5 rounded-xl">
          <button
            onClick={() => {
              const res = computeLayout(nodes, edges, 'RADIAL');
              setNodes(res.nodes);
              savePositions(res.nodes);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold text-stone-400 hover:text-amber-300 rounded-lg hover:bg-stone-800 transition-all cursor-pointer"
            title="Radial Galaxy (Brain Orbit Layout)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Radial</span>
          </button>
          <button
            onClick={() => {
              const res = computeLayout(nodes, edges, 'LR');
              setNodes(res.nodes);
              savePositions(res.nodes);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-all cursor-pointer"
            title="Horizontal Tree"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Tree LR</span>
          </button>
          <button
            onClick={() => {
              const res = computeLayout(nodes, edges, 'TB');
              setNodes(res.nodes);
              savePositions(res.nodes);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-all cursor-pointer"
            title="Waterfall Tree"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Tree TB</span>
          </button>
        </div>

        {/* Pan / Select */}
        <div className="flex items-center gap-0.5 bg-[#161618] border border-stone-800/80 p-0.5 rounded-xl">
          <button
            onClick={() => setInteractionMode('pan')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${interactionMode === 'pan' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-500 hover:text-stone-300'}`}
            title="Pan Hand Mode"
          >
            <Hand className="w-4 h-4" />
          </button>
          <button
            onClick={() => setInteractionMode('select')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${interactionMode === 'select' ? 'bg-indigo-500/20 text-indigo-300' : 'text-stone-500 hover:text-stone-300'}`}
            title="Select Marquee Mode"
          >
            <MousePointer className="w-4 h-4" />
          </button>
        </div>

        {/* Completed Filter */}
        <div className="flex items-center gap-0.5 bg-[#161618] border border-stone-800/80 p-0.5 rounded-xl text-xs font-mono">
          <button
            onClick={() => setCompletedFilter('show')}
            className={`px-2 py-1 rounded-lg font-bold ${completedFilter === 'show' ? 'bg-stone-800 text-stone-200' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Show
          </button>
          <button
            onClick={() => setCompletedFilter('dim')}
            className={`px-2 py-1 rounded-lg font-bold ${completedFilter === 'dim' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Dim
          </button>
          <button
            onClick={() => setCompletedFilter('hide')}
            className={`px-2 py-1 rounded-lg font-bold ${completedFilter === 'hide' ? 'bg-emerald-500/20 text-emerald-300' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Hide
          </button>
        </div>

        {/* Add Entity Sprouter */}
        <div className="flex items-center gap-1">
          <select
            onChange={(e) => {
              if (e.target.value === '__NEW_TYPE__') {
                setIsCreatingCustomType(true);
              } else if (e.target.value) {
                setIsCreatingType(e.target.value);
              }
              e.target.value = '';
            }}
            defaultValue=""
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer shadow-md transition-all outline-none"
          >
            <option value="" disabled>
              + Add Node...
            </option>
            {entityTypesList.map((t) => (
              <option key={t.id} value={t.id}>
                + {t.name}
              </option>
            ))}
            <option value="__NEW_TYPE__">⚙️ Create New Entity Type...</option>
          </select>
        </div>
      </div>

      {/* ─── Selected Wire Delete Bar ──────────────────────────────────────── */}
      {selectedEdge && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#181214] border border-rose-500/50 px-4 py-2 rounded-2xl shadow-2xl">
          <span className="text-xs font-mono text-rose-300">Synaptic Wire Selected</span>
          <button
            onClick={() => handleDeleteEdge(selectedEdge)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-xl shadow cursor-pointer"
          >
            Disconnect Wire
          </button>
          <button onClick={() => setSelectedEdge(null)} className="p-1 text-stone-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Canvas Viewport ───────────────────────────────────────────────── */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={(_, edge) => setSelectedEdge(edge)}
          onNodeDragStop={(_, __, draggedNodes) => savePositions(draggedNodes || nodes)}
          onSelectionDragStop={(_, draggedNodes) => savePositions(draggedNodes || nodes)}
          onViewportChange={(v) => setZoomLevel(v.zoom)}
          nodeTypes={nodeTypes}
          fitView
          selectionOnDrag={interactionMode === 'select'}
          panOnDrag={interactionMode === 'pan' ? [0, 1, 2] : [1, 2]}
          className="bg-[#08080a]"
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="#1c1c22" gap={24} size={1.5} variant={BackgroundVariant.Dots} />
          <MiniMap
            nodeColor={(node) => COLOR_THEMES[(node.data as any)?.color || 'indigo']?.accentColor || '#818cf8'}
            maskColor="rgba(0, 0, 0, 0.85)"
            className="!bg-[#101014] !border !border-stone-800 !rounded-2xl shadow-2xl !bottom-4 !right-4 hidden sm:block"
          />
        </ReactFlow>
      </div>

      {/* ─── Slide-Out Node Inspector Drawer ───────────────────────────────── */}
      {inspectNode && (
        <div className="absolute top-0 right-0 bottom-0 z-40 w-96 bg-[#111114]/98 backdrop-blur-2xl border-l border-stone-800/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                {inspectNode.typeName || inspectNode.type} Node
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-400">
                Tier {inspectNode.tier}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDeleteNode(inspectNode)}
                className="p-1.5 text-stone-500 hover:text-rose-400 rounded-lg hover:bg-stone-850 cursor-pointer"
                title="Delete Node"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setInspectNode(null)} className="p-1.5 text-stone-500 hover:text-stone-200 rounded-lg hover:bg-stone-850 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Title & Icon */}
            <div className="flex items-start gap-2.5">
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-10 h-10 rounded-xl bg-[#18181c] border border-stone-800 hover:border-amber-500 text-amber-400 flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                title="Change Icon"
              >
                {renderLucideIcon(editIcon, 'Target', 'w-5 h-5')}
              </button>
              <textarea
                rows={2}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveInspectNode}
                placeholder="Node Title..."
                className="flex-1 bg-[#16161a] border border-stone-800 focus:border-amber-500/50 rounded-xl p-2.5 text-xs font-semibold text-stone-100 resize-none outline-none font-mono"
              />
            </div>

            {/* Icon Picker Popover */}
            {showIconPicker && (
              <div className="p-2.5 bg-[#16161a] border border-stone-750 rounded-2xl grid grid-cols-6 gap-1 max-h-36 overflow-y-auto">
                {ICON_PALETTE.map((iconKey) => (
                  <button
                    key={iconKey}
                    onClick={() => {
                      setEditIcon(iconKey);
                      setShowIconPicker(false);
                      setTimeout(handleSaveInspectNode, 50);
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${editIcon === iconKey ? 'bg-amber-500/30 text-amber-300 border border-amber-500' : 'text-stone-400 hover:bg-stone-800'}`}
                  >
                    {renderLucideIcon(iconKey, 'Target', 'w-3.5 h-3.5')}
                  </button>
                ))}
              </div>
            )}

            {/* Status Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#16161a] rounded-xl border border-stone-800 text-xs font-mono">
              {['active', 'done', 'archived'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setEditStatus(st);
                    setTimeout(handleSaveInspectNode, 50);
                  }}
                  className={`py-1 rounded-lg capitalize font-bold cursor-pointer transition-all ${editStatus === st ? (st === 'done' ? 'bg-emerald-500/20 text-emerald-300' : st === 'active' ? 'bg-amber-500/20 text-amber-300' : 'bg-stone-800 text-stone-300') : 'text-stone-500 hover:text-stone-300'}`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-stone-800 pb-1">
              <button
                onClick={() => setInspectTab('strategy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer ${inspectTab === 'strategy' ? 'bg-amber-500/15 text-amber-300' : 'text-stone-500 hover:text-stone-300'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Strategy Notes</span>
              </button>
              <button
                onClick={() => setInspectTab('relations')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer ${inspectTab === 'relations' ? 'bg-indigo-500/15 text-indigo-300' : 'text-stone-500 hover:text-stone-300'}`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Synapses</span>
              </button>
            </div>

            {/* Tab 1: Strategy Notes */}
            {inspectTab === 'strategy' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-stone-500 uppercase">Markdown Notes</span>
                  <button
                    onClick={() => {
                      if (markdownMode === 'edit') handleSaveInspectNode();
                      setMarkdownMode(markdownMode === 'edit' ? 'preview' : 'edit');
                    }}
                    className="text-[10px] font-mono text-amber-400 hover:underline cursor-pointer"
                  >
                    {markdownMode === 'edit' ? 'Done Editing' : 'Click to Edit'}
                  </button>
                </div>
                {markdownMode === 'edit' ? (
                  <textarea
                    rows={8}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onBlur={() => {
                      setMarkdownMode('preview');
                      handleSaveInspectNode();
                    }}
                    placeholder="Write strategy, checkpoints, markdown checklists (- [ ])..."
                    className="w-full bg-[#16161a] border border-amber-500/40 rounded-xl p-3 text-xs font-mono text-stone-200 resize-none outline-none leading-relaxed"
                  />
                ) : (
                  <div
                    onClick={() => setMarkdownMode('edit')}
                    className="w-full bg-[#16161a] border border-stone-800 hover:border-stone-700 rounded-xl p-3 min-h-[10rem] cursor-pointer"
                  >
                    <RenderMarkdown content={editContent} />
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Synapses */}
            {inspectTab === 'relations' && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-stone-500 uppercase">Connected Synapses</span>
                {(() => {
                  const fullId = `${inspectNode.type}-${inspectNode.id}`;
                  const connected = edges.filter((e) => e.source === fullId || e.target === fullId);
                  if (connected.length === 0) {
                    return <div className="text-xs text-stone-500 italic py-2">No connected synapses. Drag handles on the canvas to link any node!</div>;
                  }
                  return (
                    <div className="space-y-1.5">
                      {connected.map((edge) => {
                        const isSource = edge.source === fullId;
                        const otherId = isSource ? edge.target : edge.source;
                        const otherNode = nodes.find((n) => n.id === otherId);
                        return (
                          <div key={edge.id} className="flex items-center justify-between p-2 rounded-xl bg-[#16161a] border border-stone-800 text-xs font-mono">
                            <span className="truncate">
                              {isSource ? '→' : '←'} {(otherNode?.data as any)?.title || otherId}
                            </span>
                            <button onClick={() => handleDeleteEdge(edge)} className="text-stone-500 hover:text-rose-400 p-1 cursor-pointer">
                              <Unlink className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Create Node Modal ──────────────────────────────────────────────── */}
      {isCreatingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#141418] border border-stone-800 rounded-2xl p-4 w-full max-w-md shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-bold text-amber-400">
                Create New {entityTypeMap.get(isCreatingType)?.name || isCreatingType}
              </span>
              <button onClick={() => setIsCreatingType(null)} className="text-stone-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNode()}
              placeholder="Title..."
              autoFocus
              className="w-full bg-[#0a0a0c] border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsCreatingType(null)} className="px-3 py-1.5 text-xs font-mono text-stone-400 hover:text-white">
                Cancel
              </button>
              <button onClick={handleCreateNode} disabled={!newTitle.trim()} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs font-mono rounded-xl shadow cursor-pointer disabled:opacity-40">
                Create Node
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Custom Type Modal ───────────────────────────────────────── */}
      {isCreatingCustomType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#141418] border border-stone-800 rounded-2xl p-4 w-full max-w-md shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-bold text-amber-400">Create Custom Entity Type</span>
              <button onClick={() => setIsCreatingCustomType(false)} className="text-stone-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="Type Name (e.g. Skill, Topic, Book)..."
              autoFocus
              className="w-full bg-[#0a0a0c] border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTypeColor(c)}
                  className={`w-6 h-6 rounded-full border ${newTypeColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: COLOR_THEMES[c]?.accentColor || '#818cf8' }}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsCreatingCustomType(false)} className="px-3 py-1.5 text-xs font-mono text-stone-400 hover:text-white">
                Cancel
              </button>
              <button onClick={handleCreateCustomType} disabled={!newTypeName.trim()} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs font-mono rounded-xl shadow cursor-pointer disabled:opacity-40">
                Save Entity Type
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HubCanvas() {
  return (
    <ReactFlowProvider>
      <InnerHubCanvas />
    </ReactFlowProvider>
  );
}
