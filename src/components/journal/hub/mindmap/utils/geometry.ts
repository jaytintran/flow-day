// ─── Dynamic Nearest-Side Handle Snapping Algorithm ───────────────────────────
// Determines the closest connection ports (top, bottom, left, right) between two node bounding boxes.
// Considers typical card dimensions (width ~200px, height ~70px) so center-to-center delta correctly identifies horizontal vs vertical alignment.
export function getClosestHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  sourceSize: { width: number; height: number } = { width: 220, height: 70 },
  targetSize: { width: number; height: number } = { width: 220, height: 70 },
): { sourceHandle: string; targetHandle: string } {
  // Center points
  const srcCenter = {
    x: sourcePos.x + sourceSize.width / 2,
    y: sourcePos.y + sourceSize.height / 2,
  };
  const tgtCenter = {
    x: targetPos.x + targetSize.width / 2,
    y: targetPos.y + targetSize.height / 2,
  };

  const dx = tgtCenter.x - srcCenter.x;
  const dy = tgtCenter.y - srcCenter.y;

  // Check if nodes are predominantly vertical (overlapping horizontally within threshold)
  const horizontalOverlap = Math.abs(dx) < Math.max(sourceSize.width, targetSize.width) * 0.7;

  if (horizontalOverlap) {
    if (dy > 0) {
      return { sourceHandle: 'bottom-source', targetHandle: 'top-target' };
    } else {
      return { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
    }
  }

  // Otherwise, determine dominant axis with aspect ratio weighting
  const horizontalScale = 1.0;
  const verticalScale = (sourceSize.width / sourceSize.height) * 0.8;

  if (Math.abs(dx) * horizontalScale >= Math.abs(dy) * verticalScale) {
    if (dx > 0) {
      return { sourceHandle: 'right-source', targetHandle: 'left-target' };
    } else {
      return { sourceHandle: 'left-source', targetHandle: 'right-target' };
    }
  } else {
    if (dy > 0) {
      return { sourceHandle: 'bottom-source', targetHandle: 'top-target' };
    } else {
      return { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
    }
  }
}
