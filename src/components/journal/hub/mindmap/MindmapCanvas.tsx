import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
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
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../db';
import {
  MindmapNode,
  mindmapNodeTypes,
} from './components/MindmapNodes';
import { mindmapEdgeTypes } from './components/MindmapEdge';
import { MindmapEdgeModal } from './components/MindmapEdgeModal';
import { MindmapHeader } from './components/MindmapHeader';
import { MindmapControls } from './components/MindmapControls';
import { MindmapSpawnerDock } from './components/MindmapSpawnerDock';
import { MindmapContextMenu } from './components/MindmapContextMenu';
import { MindmapCreateModal } from './components/MindmapCreateModal';
import { MindmapInspector } from './components/MindmapInspector';
import { useMindmapStorage } from './hooks/useMindmapStorage';
import { useMindmapKeyboard } from './hooks/useMindmapKeyboard';
import { getClosestHandles } from './utils/geometry';
import { computeNodeTiers } from './utils/treeHierarchy';
import {
  MindmapActionContext,
  ContextMenuState,
  MindmapEdgeMetadata,
  STORAGE_EDGES_KEY,
} from './types';
import { EntityTypeDefinition, UnifiedEntity, EntityColor } from '../../../../types';

interface MindmapCanvasProps {
  onSwitchToSkillTree?: () => void;
}

function InnerMindmapCanvas({ onSwitchToSkillTree }: MindmapCanvasProps) {
  const reactFlowInstance = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectNode, setInspectNode] = useState<UnifiedEntity | null>(null);
  const [isCreatingType, setIsCreatingType] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('Target');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectedEdgeForModal, setSelectedEdgeForModal] = useState<Edge | null>(null);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');

  // Storage and cache hook
  const {
    posCacheRef,
    savePositionsDebounced,
    defaultViewport,
    saveViewport,
    getInitialCollapsed,
    saveCollapsed,
    getInitialCompletedFilter,
    saveCompletedFilter,
    getInitialEdgeMetadata,
    saveEdgeMetadata,
    deleteEdgeMetadata,
  } = useMindmapStorage();

  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(getInitialCollapsed);
  const [completedFilterMode, setCompletedFilterMode] = useState<'show' | 'dim' | 'hide'>(
    getInitialCompletedFilter,
  );
  const [edgeMetadataMap, setEdgeMetadataMap] = useState<Record<string, MindmapEdgeMetadata>>(
    getInitialEdgeMetadata,
  );

  const handleCompletedFilterChange = useCallback(
    (mode: 'show' | 'dim' | 'hide') => {
      setCompletedFilterMode(mode);
      saveCompletedFilter(mode);
    },
    [saveCompletedFilter],
  );

  // Dexie live queries (Filter out default habit node type from mindmap)
  const rawEntityTypes = useLiveQuery(() => db.entity_types.toArray());
  const rawEntities = useLiveQuery(() => db.entities.toArray());

  const entityTypesList = useMemo(() => {
    return (rawEntityTypes || []).filter((t) => t.id !== 'habit');
  }, [rawEntityTypes]);

  const entityTypeMap = useMemo(() => {
    const map = new Map<string, EntityTypeDefinition>();
    entityTypesList.forEach((t) => map.set(t.id, t));
    return map;
  }, [entityTypesList]);

  const entitiesList = useMemo(() => {
    return (rawEntities || []).filter((e) => e.entity_type !== 'habit');
  }, [rawEntities]);

  const entityMap = useMemo(() => {
    const map = new Map<string, UnifiedEntity>();
    entitiesList.forEach((e) => map.set(e.id, e));
    return map;
  }, [entitiesList]);

  // Ancestor Depth Calculation
  const nodeTierMap = useMemo(() => computeNodeTiers(entitiesList, entityMap), [
    entitiesList,
    entityMap,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Action Dispatch Handlers
  const handleInspectNode = useCallback(
    (rawId: string) => {
      const entity = entityMap.get(rawId);
      if (!entity) return;
      setInspectNode(entity);
      setContextMenu(null);
    },
    [entityMap],
  );

  const handleQuickRename = useCallback(async (rawId: string, updatedTitle: string) => {
    await db.entities.update(rawId, { title: updatedTitle });
    await db.entries.update(rawId, { title: updatedTitle } as any).catch(() => {});
    await db.purposes.update(rawId, { title: updatedTitle } as any).catch(() => {});
    await db.domains.update(rawId, { name: updatedTitle, title: updatedTitle } as any).catch(() => {});
  }, []);

  const handleQuickUpdateNotes = useCallback(async (rawId: string, updatedNotes: string) => {
    await db.entities.update(rawId, { content: updatedNotes });
    await db.entries.update(rawId, { content: updatedNotes, description: updatedNotes } as any).catch(() => {});
    await db.purposes.update(rawId, { description: updatedNotes } as any).catch(() => {});
    await db.domains.update(rawId, { description: updatedNotes } as any).catch(() => {});
  }, []);

  const handleToggleCollapse = useCallback(
    (id: string) => {
      setCollapsedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveCollapsed(next);
        return next;
      });
      setContextMenu(null);
    },
    [saveCollapsed],
  );

  const handleToggleComplete = useCallback(
    async (rawId: string) => {
      const entity = entityMap.get(rawId);
      if (!entity) return;
      const isCurrentlyDone =
        entity.status === 'done' || entity.status === 'achieved' || entity.status === 'completed';
      const nextStatus = isCurrentlyDone
        ? entity.entity_type === 'objective'
          ? 'todo'
          : 'active'
        : entity.entity_type === 'goal'
          ? 'achieved'
          : 'done';

      await db.entities.update(rawId, { status: nextStatus });
      await db.entries.update(rawId, { status: nextStatus } as any).catch(() => {});
      setContextMenu(null);
    },
    [entityMap],
  );

  const handleAddChild = useCallback(
    (parentId: string) => {
      const parent = entityMap.get(parentId);
      setCreatingParentId(parentId);
      if (parent) {
        if (parent.entity_type === 'purpose' || parent.entity_type === 'domain') {
          setIsCreatingType('goal');
          setNewIcon('Target');
        } else if (parent.entity_type === 'goal') {
          setIsCreatingType('objective');
          setNewIcon('CheckCircle2');
        } else {
          setIsCreatingType('objective');
          setNewIcon('CheckCircle2');
        }
      } else {
        setIsCreatingType('goal');
      }
      setContextMenu(null);
    },
    [entityMap],
  );

  const handleDeleteNode = useCallback(
    async (entity: UnifiedEntity) => {
      if (confirm(`Delete "${entity.title}"?`)) {
        const fullNodeId = `${entity.entity_type}-${entity.id}`;
        await db.entities.delete(entity.id);
        delete posCacheRef.current[fullNodeId];
        setInspectNode(null);
        setContextMenu(null);
      }
    },
    [posCacheRef],
  );

  const handleQuickChangeIcon = useCallback(async (rawId: string, updatedIcon: string) => {
    await db.entities.update(rawId, { icon: updatedIcon });
    await db.entries.update(rawId, { icon: updatedIcon } as any).catch(() => {});
  }, []);

  const handleOpenContextMenu = useCallback(
    (e: React.MouseEvent, rawId: string) => {
      const entity = entityMap.get(rawId);
      if (entity) {
        setContextMenu({ x: e.clientX, y: e.clientY, rawId, entity });
      }
    },
    [entityMap],
  );

  // Connecting node tracking for drag-to-empty port connection
  const connectingNodeRef = useRef<{ nodeId: string; handleType: string | null } | null>(null);

  const onConnectStart = useCallback((_: any, { nodeId, handleType }: any) => {
    connectingNodeRef.current = { nodeId, handleType };
  }, []);

  const onConnectEnd = useCallback(
    async (event: any) => {
      if (!connectingNodeRef.current) return;

      const targetIsPane =
        event.target?.classList?.contains('react-flow__pane') ||
        event.target?.closest('.react-flow__pane') !== null;

      if (targetIsPane) {
        const sourceFullId = connectingNodeRef.current.nodeId;
        const [, sourceRawId] = sourceFullId.split('-');
        const sourceEntity = entityMap.get(sourceRawId);

        if (sourceEntity) {
          // Determine spawn position from drop client coordinates
          const clientX = event.clientX || event.changedTouches?.[0]?.clientX;
          const clientY = event.clientY || event.changedTouches?.[0]?.clientY;

          let spawnPos = { x: 300, y: 200 };
          if (clientX !== undefined && clientY !== undefined) {
            try {
              const flowPos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
              spawnPos = { x: Math.round(flowPos.x - 110), y: Math.round(flowPos.y - 35) };
            } catch {}
          }

          // Same type as the source node card
          const targetType = sourceEntity.entity_type;
          const newId = crypto.randomUUID();
          const fullNodeId = `${targetType}-${newId}`;
          const typeDef = entityTypeMap.get(targetType);

          posCacheRef.current[fullNodeId] = spawnPos;

          // Connect child to parent
          await db.entities.add({
            id: newId,
            entity_type: targetType,
            title: `New ${typeDef?.name || targetType}`,
            icon: sourceEntity.icon || typeDef?.icon || 'Target',
            color: sourceEntity.color || typeDef?.color || 'indigo',
            status: targetType === 'objective' ? 'todo' : typeDef?.has_status ? 'active' : undefined,
            time_spent: 0,
            parent_ids: [sourceRawId],
            created_at: new Date(),
          });
        }
      }

      connectingNodeRef.current = null;
    },
    [entityMap, entityTypeMap, posCacheRef, reactFlowInstance],
  );

  // Keyboard Shortcuts Hook
  useMindmapKeyboard({
    selectedNodeId,
    entityMap,
    onAddChild: handleAddChild,
    onAddSibling: (currentEntity) => {
      const parentId = currentEntity.parent_ids?.[0];
      setCreatingParentId(parentId || null);
      setIsCreatingType(currentEntity.entity_type);
      setNewIcon(currentEntity.icon || 'Target');
    },
    onDeleteNode: handleDeleteNode,
  });

  const actionContextValue = useMemo(
    () => ({
      onInspectNode: handleInspectNode,
      onQuickRename: handleQuickRename,
      onQuickUpdateNotes: handleQuickUpdateNotes,
      onQuickChangeIcon: handleQuickChangeIcon,
      onToggleCollapse: handleToggleCollapse,
      onAddChild: handleAddChild,
      onToggleComplete: handleToggleComplete,
      onOpenContextMenu: handleOpenContextMenu,
    }),
    [
      handleInspectNode,
      handleQuickRename,
      handleQuickUpdateNotes,
      handleQuickChangeIcon,
      handleToggleCollapse,
      handleAddChild,
      handleToggleComplete,
      handleOpenContextMenu,
    ],
  );

  // Graph Elements Assembly with mindmapEdge
  useEffect(() => {
    if (rawEntities === undefined || rawEntityTypes === undefined) return;

    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];

    const parentIdsSet = new Set<string>();
    entitiesList.forEach((e) => {
      e.parent_ids?.forEach((pid) => parentIdsSet.add(pid));
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
      const hasChildren = parentIdsSet.has(entity.id);
      const isCollapsed = collapsedNodes.has(id) || collapsedNodes.has(entity.id);

      const isCompleted =
        entity.status === 'done' || entity.status === 'achieved' || entity.status === 'completed';

      const hasParents = entity.parent_ids && entity.parent_ids.length > 0;
      const isParentCollapsed = hasParents
        ? entity.parent_ids!.every((pid) => {
            const pEntity = entityMap.get(pid);
            const parentKey = pEntity ? `${pEntity.entity_type}-${pEntity.id}` : pid;
            return collapsedNodes.has(parentKey) || collapsedNodes.has(pid);
          })
        : false;

      const isHiddenByFilter = completedFilterMode === 'hide' && isCompleted;
      const isDimmed = completedFilterMode === 'dim' && isCompleted;
      const calculatedTier = nodeTierMap.get(entity.id) ?? 0;

      const nodePos = savedPos || {
        x: calculatedTier * 280 + (idx % 2 === 0 ? 50 : 0),
        y: idx * 110,
      };

      rawNodes.push({
        id,
        type: 'mindmap',
        hidden: isParentCollapsed || isHiddenByFilter,
        position: nodePos,
        data: {
          id,
          rawId: entity.id,
          title: entity.title,
          icon: entity.icon || typeDef.icon || 'Target',
          type: entity.entity_type,
          typeName: typeDef.name,
          color: entity.color || typeDef.color || 'indigo',
          status: entity.status,
          time_spent: entity.time_spent,
          description: entity.content || '',
          hasChildren,
          isCollapsed,
          isDimmed,
          hasStatus: typeDef.has_status,
          hasTimeTracking: typeDef.has_time_tracking,
          tier: calculatedTier,
        },
      });

      // 4-Sided Dynamic Nearest Floating Bezier Edges
      if (entity.parent_ids && entity.parent_ids.length > 0) {
        entity.parent_ids.forEach((pid) => {
          const parentEntity = entityMap.get(pid);
          const parentFullId = parentEntity
            ? `${parentEntity.entity_type}-${parentEntity.id}`
            : pid;

          const parentPos = posCacheRef.current[parentFullId] || { x: 0, y: 0 };
          const { sourceHandle, targetHandle } = getClosestHandles(parentPos, nodePos);

          const edgeId = `e-${parentFullId}-${id}`;
          const edgeMeta = edgeMetadataMap[edgeId] || {};

          const strokeColor = isCompleted
            ? '#10b98180'
            : typeDef.color === 'amber'
              ? '#f59e0b'
              : typeDef.color === 'emerald'
                ? '#10b981'
                : typeDef.color === 'rose'
                  ? '#f43f5e'
                  : typeDef.color === 'sky'
                    ? '#0284c7'
                    : '#818cf8';

          const effectiveStrokeColor = edgeMeta.color || strokeColor;

          rawEdges.push({
            id: edgeId,
            source: parentFullId,
            target: id,
            sourceHandle,
            targetHandle,
            type: 'mindmapEdge',
            animated: !isCompleted,
            data: {
              title: edgeMeta.title,
              description: edgeMeta.description,
              isCompleted,
              isDimmed,
              strokeColor: effectiveStrokeColor,
              styleType: edgeMeta.styleType,
            },
            style: {
              stroke: effectiveStrokeColor,
              strokeWidth: isCompleted ? 1.5 : 2,
              strokeDasharray: isCompleted ? '5 5' : undefined,
              opacity: isDimmed ? 0.35 : 1,
              cursor: 'pointer',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: effectiveStrokeColor,
            },
          });
        });
      }
    });

    // Custom Edge Hydration
    const validNodeIdSet = new Set(rawNodes.map((n) => n.id));
    try {
      const raw = localStorage.getItem(STORAGE_EDGES_KEY);
      if (raw) {
        const customEdges: Edge[] = JSON.parse(raw);
        customEdges.forEach((ce) => {
          if (validNodeIdSet.has(ce.source) && validNodeIdSet.has(ce.target)) {
            if (!rawEdges.some((re) => re.source === ce.source && re.target === ce.target)) {
              const srcPos = posCacheRef.current[ce.source] || { x: 0, y: 0 };
              const tgtPos = posCacheRef.current[ce.target] || { x: 0, y: 0 };
              const { sourceHandle, targetHandle } = getClosestHandles(srcPos, tgtPos);
              const edgeMeta = edgeMetadataMap[ce.id] || {};
              const customStrokeColor = edgeMeta.color || '#f59e0b';

              rawEdges.push({
                ...ce,
                sourceHandle: ce.sourceHandle || sourceHandle,
                targetHandle: ce.targetHandle || targetHandle,
                type: 'mindmapEdge',
                data: {
                  title: edgeMeta.title,
                  description: edgeMeta.description,
                  strokeColor: customStrokeColor,
                  styleType: edgeMeta.styleType,
                },
                style: {
                  stroke: customStrokeColor,
                  strokeWidth: 2,
                  cursor: 'pointer',
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: customStrokeColor,
                },
              });
            }
          }
        });
      }
    } catch {}

    setNodes(rawNodes);
    setEdges(rawEdges);
  }, [
    entitiesList,
    entityTypesList,
    entityTypeMap,
    entityMap,
    nodeTierMap,
    collapsedNodes,
    completedFilterMode,
    edgeMetadataMap,
    posCacheRef,
  ]);

  // Dynamic Real-time Edge Re-snapping on Node Drag
  const handleNodeDrag = useCallback(
    (_: any, node: Node) => {
      posCacheRef.current[node.id] = { x: node.position.x, y: node.position.y };
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.source === node.id || edge.target === node.id) {
            const srcPos = posCacheRef.current[edge.source] || { x: 0, y: 0 };
            const tgtPos = posCacheRef.current[edge.target] || { x: 0, y: 0 };
            const { sourceHandle, targetHandle } = getClosestHandles(srcPos, tgtPos);
            return {
              ...edge,
              sourceHandle,
              targetHandle,
            };
          }
          return edge;
        }),
      );
    },
    [posCacheRef, setEdges],
  );

  const handleNodeDragStop = useCallback(
    (_: any, node: Node) => {
      setNodes((currentNodes) => {
        savePositionsDebounced(currentNodes);
        return currentNodes;
      });
    },
    [savePositionsDebounced, setNodes],
  );

  // Connection Handler
  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;

      const [, sourceId] = params.source.split('-');
      const [, targetId] = params.target.split('-');

      const targetEntity = entityMap.get(targetId);
      if (targetEntity) {
        const currentParents = targetEntity.parent_ids || [];
        if (!currentParents.includes(sourceId)) {
          await db.entities.update(targetId, {
            parent_ids: [...currentParents, sourceId],
          });
        }
      }

      const srcPos = posCacheRef.current[params.source] || { x: 0, y: 0 };
      const tgtPos = posCacheRef.current[params.target] || { x: 0, y: 0 };
      const { sourceHandle, targetHandle } = getClosestHandles(srcPos, tgtPos);

      const newEdge: Edge = {
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || sourceHandle,
        targetHandle: params.targetHandle || targetHandle,
        type: 'mindmapEdge',
        animated: true,
        style: { stroke: '#f59e0b', strokeWidth: 2, cursor: 'pointer' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
      };

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
    [entityMap, posCacheRef, setEdges],
  );

  // Edge Actions: Save Metadata
  const handleSaveEdgeMetadata = useCallback(
    (edgeId: string, metadata: MindmapEdgeMetadata) => {
      setEdgeMetadataMap((prev) => {
        const next = { ...prev, [edgeId]: metadata };
        saveEdgeMetadata(edgeId, metadata);
        return next;
      });
    },
    [saveEdgeMetadata],
  );

  // Edge Actions: Delete
  const handleDeleteEdge = useCallback(
    async (edge: Edge) => {
      const [, sourceId] = edge.source.split('-');
      const [, targetId] = edge.target.split('-');

      const targetEntity = entityMap.get(targetId);
      if (targetEntity) {
        const nextParents = (targetEntity.parent_ids || []).filter((pid) => pid !== sourceId);
        await db.entities.update(targetId, { parent_ids: nextParents });
      }

      deleteEdgeMetadata(edge.id);
      setEdgeMetadataMap((prev) => {
        const next = { ...prev };
        delete next[edge.id];
        return next;
      });

      try {
        const raw = localStorage.getItem(STORAGE_EDGES_KEY);
        if (raw) {
          const edgeList: Edge[] = JSON.parse(raw);
          const filtered = edgeList.filter((e) => e.id !== edge.id);
          localStorage.setItem(STORAGE_EDGES_KEY, JSON.stringify(filtered));
        }
      } catch {}

      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      setSelectedEdgeForModal(null);
    },
    [deleteEdgeMetadata, entityMap, setEdges],
  );

  const handleCreateNodeSubmit = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !isCreatingType) return;

    const newId = crypto.randomUUID();
    const typeDef = entityTypeMap.get(isCreatingType);
    const parentIds: string[] = creatingParentId ? [creatingParentId] : [];

    const defaultInitialStatus =
      isCreatingType === 'objective' ? 'todo' : typeDef?.has_status ? 'active' : undefined;

    const fullNodeId = `${isCreatingType}-${newId}`;
    let spawnPosition: { x: number; y: number } = { x: 0, y: 0 };

    if (creatingParentId) {
      const parent = entityMap.get(creatingParentId);
      const parentFullId = parent ? `${parent.entity_type}-${parent.id}` : creatingParentId;
      const parentPos = posCacheRef.current[parentFullId] || { x: 200, y: 200 };
      const siblingCount = entitiesList.filter((e) =>
        (e.parent_ids || []).includes(creatingParentId),
      ).length;
      spawnPosition = {
        x: parentPos.x + 280,
        y: parentPos.y + siblingCount * 90 - 20,
      };
    } else {
      try {
        const centerPos = reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2 + (Math.random() * 60 - 30),
          y: window.innerHeight / 2 + (Math.random() * 60 - 30),
        });
        spawnPosition = { x: Math.round(centerPos.x), y: Math.round(centerPos.y) };
      } catch {
        spawnPosition = { x: 400, y: 200 };
      }
    }

    posCacheRef.current[fullNodeId] = spawnPosition;
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

    setNewTitle('');
    setNewIcon('Target');
    setIsCreatingType(null);
    setCreatingParentId(null);
  };

  const contextNodeId = contextMenu
    ? `${contextMenu.entity.entity_type}-${contextMenu.entity.id}`
    : '';
  const isContextNodeCollapsed = collapsedNodes.has(contextNodeId);
  const contextNodeHasChildren = contextMenu
    ? entitiesList.some((e) => (e.parent_ids || []).includes(contextMenu.entity.id))
    : false;

  return (
    <MindmapActionContext.Provider value={actionContextValue}>
      <div
        onClick={() => {
          setContextMenu(null);
        }}
        className="w-full h-full flex-1 relative flex flex-col bg-[#09090b] overflow-hidden rounded-2xl border border-stone-850 shadow-inner"
      >
        {/* Header Mode & Settings */}
        <MindmapHeader
          onSwitchToSkillTree={onSwitchToSkillTree}
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
          completedFilterMode={completedFilterMode}
          onCompletedFilterChange={handleCompletedFilterChange}
        />

        {/* Canvas Area */}
        <div className="flex-1 w-full h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onEdgeClick={(_, edge) => setSelectedEdgeForModal(edge)}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              const [, rawId] = node.id.split('-');
              const entity = entityMap.get(rawId);
              if (entity) {
                setContextMenu({ x: e.clientX, y: e.clientY, rawId, entity });
              }
            }}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setContextMenu(null);
            }}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onViewportChange={(v) => {
              setZoomLevel(v.zoom);
              saveViewport(v);
            }}
            defaultViewport={defaultViewport}
            nodeTypes={mindmapNodeTypes}
            edgeTypes={mindmapEdgeTypes}
            fitView={!defaultViewport}
            selectionOnDrag={interactionMode === 'select'}
            panOnDrag={interactionMode === 'pan' ? [0, 1, 2] : [1, 2]}
            selectionKeyCode={interactionMode === 'pan' ? ['Shift', 'Meta', 'Control'] : null}
            multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
            className="bg-[#09090b]"
            minZoom={0.2}
            maxZoom={2.5}
            onlyRenderVisibleElements
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#202024" gap={28} size={1.5} variant={BackgroundVariant.Dots} />
            <MindmapControls zoomLevel={zoomLevel} entityMap={entityMap} />
          </ReactFlow>
        </div>

        {/* Right Click Context Menu */}
        {contextMenu && (
          <MindmapContextMenu
            contextMenu={contextMenu}
            isCollapsed={isContextNodeCollapsed}
            hasChildren={contextNodeHasChildren}
            onInspectNode={handleInspectNode}
            onAddChild={handleAddChild}
            onToggleCollapse={handleToggleCollapse}
            onToggleComplete={handleToggleComplete}
            onDeleteNode={handleDeleteNode}
          />
        )}

        {/* Floating Spawner Dock */}
        <MindmapSpawnerDock
          entityTypesList={entityTypesList}
          onSelectTypeToCreate={(typeId, icon) => {
            setCreatingParentId(null);
            setIsCreatingType(typeId);
            setNewIcon(icon || 'Target');
          }}
          onOpenCustomTypeModal={() => {}}
        />

        {/* Node Creation Dialog Modal */}
        <MindmapCreateModal
          isCreatingType={isCreatingType}
          creatingParentId={creatingParentId}
          newTitle={newTitle}
          newIcon={newIcon}
          entityTypeMap={entityTypeMap}
          onTitleChange={setNewTitle}
          onConfirm={handleCreateNodeSubmit}
          onClose={() => setIsCreatingType(null)}
        />

        {/* Connection Wire Modal */}
        <MindmapEdgeModal
          edge={selectedEdgeForModal}
          metadata={selectedEdgeForModal ? edgeMetadataMap[selectedEdgeForModal.id] : undefined}
          onSave={handleSaveEdgeMetadata}
          onDelete={handleDeleteEdge}
          onClose={() => setSelectedEdgeForModal(null)}
        />

        {/* Slide-over Inspector */}
        <MindmapInspector
          inspectNode={inspectNode}
          onClose={() => setInspectNode(null)}
          onSave={async (id, updates) => {
            await db.entities.update(id, updates);
          }}
          onDelete={handleDeleteNode}
        />
      </div>
    </MindmapActionContext.Provider>
  );
}

export default function MindmapCanvas(props: MindmapCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerMindmapCanvas {...props} />
    </ReactFlowProvider>
  );
}
