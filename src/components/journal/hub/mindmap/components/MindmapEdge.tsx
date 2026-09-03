import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getStraightPath,
  EdgeProps,
} from '@xyflow/react';
import { MindmapEdgeData } from '../types';

export function MindmapEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<MindmapEdgeData>) {
  const isStraight = data?.styleType === 'straight';

  const [edgePath, labelX, labelY] = isStraight
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        borderRadius: 16,
      });

  const hasTitle = Boolean(data?.title && data.title.trim().length > 0);
  const hasDesc = Boolean(data?.description && data.description.trim().length > 0);
  const isCompleted = data?.isCompleted;

  // Custom stroke dasharray based on styleType
  let strokeDasharray = style.strokeDasharray;
  if (data?.styleType === 'dashed') {
    strokeDasharray = '6 6';
  } else if (data?.styleType === 'dotted') {
    strokeDasharray = '2 4';
  } else if (data?.styleType === 'solid') {
    strokeDasharray = undefined;
  }

  const edgeStyle = {
    ...style,
    stroke: data?.strokeColor || style.stroke,
    strokeDasharray,
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />

      {(hasTitle || hasDesc) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan z-10 select-none group cursor-pointer"
          >
            <div
              className={`flex flex-col items-center max-w-[200px] px-2.5 py-1 rounded-xl backdrop-blur-xl border transition-all shadow-xl ${
                isCompleted
                  ? 'bg-[#0b1913]/90 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                  : 'bg-[#121215]/95 border-stone-800 hover:border-amber-500/50 text-stone-200'
              } hover:scale-105 active:scale-95`}
            >
              {hasTitle && (
                <span className="text-[11px] font-mono font-bold tracking-wide truncate max-w-full text-center leading-tight">
                  {data?.title}
                </span>
              )}
              {hasDesc && (
                <span className="text-[9px] font-sans text-stone-400 truncate max-w-full text-center leading-tight mt-0.5">
                  {data?.description}
                </span>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const mindmapEdgeTypes = {
  mindmapEdge: MindmapEdge,
};
