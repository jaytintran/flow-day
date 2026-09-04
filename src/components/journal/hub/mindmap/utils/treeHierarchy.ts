import { UnifiedEntity } from '../../../../../types';

// ─── Ancestor Depth (Tier) Calculation ──────────────────────────────────────
// Any node with 0 parents is Tier 0 (Root).
// Depth is calculated recursively based on how many parents/grandparents it has.
export function computeNodeTiers(
  entitiesList: UnifiedEntity[],
  entityMap: Map<string, UnifiedEntity>,
): Map<string, number> {
  const tierMap = new Map<string, number>();
  const visiting = new Set<string>();

  const getDepth = (id: string): number => {
    if (tierMap.has(id)) return tierMap.get(id)!;
    if (visiting.has(id)) return 0; // prevent circular reference lock
    visiting.add(id);

    const entity = entityMap.get(id);
    if (!entity || !entity.parent_ids || entity.parent_ids.length === 0) {
      tierMap.set(id, 0);
      visiting.delete(id);
      return 0;
    }

    let maxParentDepth = 0;
    for (const pid of entity.parent_ids) {
      maxParentDepth = Math.max(maxParentDepth, getDepth(pid) + 1);
    }

    tierMap.set(id, maxParentDepth);
    visiting.delete(id);
    return maxParentDepth;
  };

  entitiesList.forEach((e) => getDepth(e.id));
  return tierMap;
}
