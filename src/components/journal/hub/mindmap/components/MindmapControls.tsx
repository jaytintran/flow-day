import React from 'react';
import { useReactFlow } from '@xyflow/react';
import { Plus, Minus, Maximize } from 'lucide-react';
import { UnifiedEntity } from '../../../../../types';

interface MindmapControlsProps {
  zoomLevel: number;
  entityMap: Map<string, UnifiedEntity>;
}

export function MindmapControls({ zoomLevel, entityMap }: MindmapControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <>
      {/* Custom Horizontal Zoom Controls */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 bg-[#121214]/95 backdrop-blur-xl border border-stone-800 p-1 rounded-xl shadow-2xl">
        <button
          onClick={() => zoomOut({ duration: 200 })}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => fitView({ duration: 250 })}
          className="px-2 py-1 text-[11px] font-mono text-stone-300 hover:text-amber-400 hover:bg-stone-800 rounded-md transition-colors cursor-pointer font-bold"
          title="Reset Zoom to Fit"
        >
          {Math.round(zoomLevel * 100)}%
        </button>

        <button
          onClick={() => zoomIn({ duration: 200 })}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-stone-800 mx-0.5" />

        <button
          onClick={() => fitView({ duration: 250 })}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          title="Fit View"
        >
          <Maximize className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}
