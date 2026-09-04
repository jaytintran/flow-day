import { SkillNodeItem, ELEMENTAL_THEMES } from './types';

export interface PositionedSkillNode {
  skill: SkillNodeItem;
  x: number;
  y: number;
  tier: number;
}

export interface TreeConduitLine {
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

export interface HierarchicalTreeLayout {
  nodes: PositionedSkillNode[];
  conduits: TreeConduitLine[];
  width: number;
  height: number;
  tierYPositions: Record<number, number>;
  activeTiers: number[];
}

export interface TreeLayoutOptions {
  horizontalSpacing?: number;
  verticalSpacing?: number;
}

export const DEFAULT_NODE_SLOT_WIDTH = 150;
export const DEFAULT_TIER_HEIGHT = 150;
export const TOP_MARGIN = 40;

/**
 * 1D Non-Overlapping Optimal Placement Solver (Buchheim / Wetherell-Shannon Block Merging).
 * Given a list of nodes with their desired ideal X positions, places every node such that:
 * distance(node[i+1], node[i]) >= minSpacing, while minimizing total deviation from desired positions.
 * Guarantees 100% that NO two nodes will ever overlap.
 */
function solveNonOverlappingPositions(
  nodes: { id: string; desiredX: number; order: number }[],
  minSpacing: number,
): Map<string, number> {
  if (nodes.length === 0) return new Map();
  if (nodes.length === 1) {
    const res = new Map<string, number>();
    res.set(nodes[0].id, nodes[0].desiredX);
    return res;
  }

  // Sort by desiredX, tie-break by initial order
  const sorted = [...nodes].sort((a, b) => {
    if (Math.abs(a.desiredX - b.desiredX) > 0.001) {
      return a.desiredX - b.desiredX;
    }
    return a.order - b.order;
  });

  interface Block {
    nodes: typeof sorted;
    totalDesired: number;
    count: number;
    minX: number;
    maxX: number;
  }

  const blocks: Block[] = sorted.map((n) => ({
    nodes: [n],
    totalDesired: n.desiredX,
    count: 1,
    minX: 0,
    maxX: 0,
  }));

  let i = 0;
  while (i < blocks.length - 1) {
    const b1 = blocks[i];
    const b2 = blocks[i + 1];

    const center1 = b1.totalDesired / b1.count;
    const center2 = b2.totalDesired / b2.count;

    const rightEdge1 = center1 + b1.maxX;
    const leftEdge2 = center2 + b2.minX;

    if (leftEdge2 - rightEdge1 < minSpacing) {
      // Merge overlapping blocks
      const mergedNodes = [...b1.nodes, ...b2.nodes];
      const mergedCount = b1.count + b2.count;
      const mergedTotalDesired = b1.totalDesired + b2.totalDesired;

      const n = mergedCount;
      const minX = -((n - 1) / 2) * minSpacing;
      const maxX = ((n - 1) / 2) * minSpacing;

      blocks.splice(i, 2, {
        nodes: mergedNodes,
        totalDesired: mergedTotalDesired,
        count: mergedCount,
        minX,
        maxX,
      });

      // Step back to check if previous block now overlaps with this new merged block
      if (i > 0) {
        i--;
      }
    } else {
      i++;
    }
  }

  const result = new Map<string, number>();
  blocks.forEach((b) => {
    const center = b.totalDesired / b.count;
    const n = b.nodes.length;
    b.nodes.forEach((node, idx) => {
      const x = center + (idx - (n - 1) / 2) * minSpacing;
      result.set(node.id, x);
    });
  });

  return result;
}

/**
 * Computes a customizable, DAG-aware hierarchical tree layout.
 * Guarantees zero overlap via 1D block placement, centers parents over children,
 * centers multi-parent nodes between their prerequisites,
 * and allows real-time manual spacing tuning.
 */
export function computeHierarchicalTreeLayout(
  skills: SkillNodeItem[],
  activeLineageIds: Set<string> = new Set(),
  options?: TreeLayoutOptions,
): HierarchicalTreeLayout {
  const minSpacing = Math.max(80, options?.horizontalSpacing ?? DEFAULT_NODE_SLOT_WIDTH);
  const tierHeight = Math.max(80, options?.verticalSpacing ?? DEFAULT_TIER_HEIGHT);

  if (skills.length === 0) {
    return {
      nodes: [],
      conduits: [],
      width: 0,
      height: 0,
      tierYPositions: {},
      activeTiers: [],
    };
  }

  const skillMap = new Map<string, SkillNodeItem>();
  skills.forEach((s) => skillMap.set(s.id, s));

  // Build parent -> children map
  const childrenMap = new Map<string, string[]>();
  skills.forEach((s) => childrenMap.set(s.id, []));

  skills.forEach((s) => {
    (s.parent_ids || []).forEach((pid) => {
      if (childrenMap.has(pid)) {
        const list = childrenMap.get(pid)!;
        if (!list.includes(s.id)) {
          list.push(s.id);
        }
      }
    });
  });

  // Group nodes by tier (1 to 5)
  const tierGroups = new Map<number, SkillNodeItem[]>();
  for (let t = 1; t <= 5; t++) tierGroups.set(t, []);
  skills.forEach((s) => {
    const t = Math.min(5, Math.max(1, s.tier));
    tierGroups.get(t)?.push(s);
  });

  // Sort each tier initially by sort_order
  tierGroups.forEach((nodes) => {
    nodes.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
  });

  const nodeXMap = new Map<string, number>();

  // --- PASS 1: Top-Down Placement ---
  // Tier 1 (Root Keystones)
  const tier1Nodes = tierGroups.get(1) || [];
  const t1Placements = solveNonOverlappingPositions(
    tier1Nodes.map((n, idx) => ({ id: n.id, desiredX: idx * minSpacing, order: idx })),
    minSpacing,
  );
  t1Placements.forEach((x, id) => nodeXMap.set(id, x));

  // Tier 2 through 5: Position children beneath their parents
  for (let t = 2; t <= 5; t++) {
    const tierNodes = tierGroups.get(t) || [];
    if (tierNodes.length === 0) continue;

    const input = tierNodes.map((n, idx) => {
      const parentIds = (n.parent_ids || []).filter((pid) => nodeXMap.has(pid));
      let desiredX = idx * minSpacing;
      if (parentIds.length > 0) {
        desiredX =
          parentIds.reduce((sum, pid) => sum + (nodeXMap.get(pid) ?? 0), 0) / parentIds.length;
      }
      return { id: n.id, desiredX, order: idx };
    });

    const placements = solveNonOverlappingPositions(input, minSpacing);
    placements.forEach((x, id) => nodeXMap.set(id, x));
  }

  // --- PASS 2: Bottom-Up Parent Centering ---
  // Tier 4 down to Tier 1: Pull parents above their children's midpoint
  for (let t = 4; t >= 1; t--) {
    const tierNodes = tierGroups.get(t) || [];
    if (tierNodes.length === 0) continue;

    const input = tierNodes.map((n, idx) => {
      const childIds = (childrenMap.get(n.id) || []).filter((cid) => nodeXMap.has(cid));
      let desiredX = nodeXMap.get(n.id) ?? idx * minSpacing;
      if (childIds.length > 0) {
        desiredX =
          childIds.reduce((sum, cid) => sum + (nodeXMap.get(cid) ?? 0), 0) / childIds.length;
      }
      return { id: n.id, desiredX, order: idx };
    });

    const placements = solveNonOverlappingPositions(input, minSpacing);
    placements.forEach((x, id) => nodeXMap.set(id, x));
  }

  // --- PASS 3: Top-Down Child Adjustment ---
  // Tier 2 through 5: Refine children around updated parent centers
  for (let t = 2; t <= 5; t++) {
    const tierNodes = tierGroups.get(t) || [];
    if (tierNodes.length === 0) continue;

    const input = tierNodes.map((n, idx) => {
      const parentIds = (n.parent_ids || []).filter((pid) => nodeXMap.has(pid));
      let desiredX = nodeXMap.get(n.id) ?? idx * minSpacing;
      if (parentIds.length > 0) {
        desiredX =
          parentIds.reduce((sum, pid) => sum + (nodeXMap.get(pid) ?? 0), 0) / parentIds.length;
      }
      return { id: n.id, desiredX, order: idx };
    });

    const placements = solveNonOverlappingPositions(input, minSpacing);
    placements.forEach((x, id) => nodeXMap.set(id, x));
  }

  // --- PASS 4: Centering & Final Coordinates ---
  let minX = Infinity;
  let maxX = -Infinity;
  nodeXMap.forEach((x) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  });

  const contentWidth = isFinite(minX) ? maxX - minX : 0;
  const centerX = isFinite(minX) ? (minX + maxX) / 2 : 0;
  const totalWidth = Math.max(800, contentWidth + minSpacing * 2);

  const positionedNodes: PositionedSkillNode[] = [];
  const nodePositionMap = new Map<string, { x: number; y: number; tier: number }>();

  skills.forEach((skill) => {
    const tier = Math.min(5, Math.max(1, skill.tier));
    const rawX = nodeXMap.get(skill.id) ?? 0;
    const finalX = rawX - centerX;
    const nodeY = TOP_MARGIN + (tier - 1) * tierHeight;

    nodePositionMap.set(skill.id, { x: finalX, y: nodeY, tier });
    positionedNodes.push({
      skill,
      x: finalX,
      y: nodeY,
      tier,
    });
  });

  // Calculate tier Y positions and active tiers
  const tierYPositions: Record<number, number> = {
    1: TOP_MARGIN,
    2: TOP_MARGIN + tierHeight,
    3: TOP_MARGIN + 2 * tierHeight,
    4: TOP_MARGIN + 3 * tierHeight,
    5: TOP_MARGIN + 4 * tierHeight,
  };

  const activeTiers = Array.from(new Set(positionedNodes.map((n) => n.tier))).sort((a, b) => a - b);
  const maxTier = activeTiers.length > 0 ? Math.max(...activeTiers) : 1;
  const totalHeight = TOP_MARGIN + maxTier * tierHeight + 80;

  // Step 5: Build conduits
  const conduits: TreeConduitLine[] = [];

  skills.forEach((child) => {
    const childPos = nodePositionMap.get(child.id);
    if (!childPos) return;

    (child.parent_ids || []).forEach((parentId) => {
      const parentPos = nodePositionMap.get(parentId);
      const parent = skillMap.get(parentId);
      if (!parentPos || !parent) return;

      const isChildMastered = child.rank >= child.maxRank || child.status === 'mastered';
      const isLearning = child.status === 'learning' || child.rank > 0;
      const isHighlighted =
        activeLineageIds.size > 0 &&
        activeLineageIds.has(parent.id) &&
        activeLineageIds.has(child.id);
      const isDimmed = activeLineageIds.size > 0 && !isHighlighted;

      const c = child.color || parent.color || 'sky';
      const themeDef = ELEMENTAL_THEMES.find((t) => t.id === c);
      const colorHex = isChildMastered ? '#f59e0b' : themeDef?.glow || '#38bdf8';

      conduits.push({
        id: `conduit-${parent.id}-${child.id}`,
        sourceId: parent.id,
        targetId: child.id,
        x1: totalWidth / 2 + parentPos.x,
        y1: parentPos.y,
        x2: totalWidth / 2 + childPos.x,
        y2: childPos.y,
        color: colorHex,
        isMastered: isChildMastered,
        isLearning,
        isHighlighted,
        isDimmed,
      });
    });
  });

  return {
    nodes: positionedNodes,
    conduits,
    width: totalWidth,
    height: totalHeight,
    tierYPositions,
    activeTiers,
  };
}
