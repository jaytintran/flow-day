import React from 'react';
import {
  Edit3,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Focus,
  Unlink,
} from 'lucide-react';
import { ContextMenuState } from '../types';
import { UnifiedEntity } from '../../../../../types';

interface MindmapContextMenuProps {
  contextMenu: ContextMenuState;
  isCollapsed?: boolean;
  hasChildren?: boolean;
  onInspectNode: (rawId: string) => void;
  onAddChild: (rawId: string) => void;
  onToggleCollapse: (id: string) => void;
  onToggleComplete: (rawId: string) => void;
  onDeleteNode: (entity: UnifiedEntity) => void;
}

export function MindmapContextMenu({
  contextMenu,
  isCollapsed,
  hasChildren,
  onInspectNode,
  onAddChild,
  onToggleCollapse,
  onToggleComplete,
  onDeleteNode,
}: MindmapContextMenuProps) {
  const isCompleted =
    contextMenu.entity.status === 'done' ||
    contextMenu.entity.status === 'achieved' ||
    contextMenu.entity.status === 'completed';

  const fullNodeId = `${contextMenu.entity.entity_type}-${contextMenu.entity.id}`;

  return (
    <div
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-60 bg-[#121215]/98 backdrop-blur-2xl border border-stone-800 rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
    >
      {/* Menu Header */}
      <div className="px-2.5 py-1.5 border-b border-stone-850 mb-1 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-bold truncate max-w-[170px]">
          {contextMenu.entity.title || contextMenu.entity.entity_type}
        </span>
        <span className="text-[9px] font-mono uppercase text-amber-400/80 font-bold bg-amber-500/10 px-1 py-0.5 rounded">
          {contextMenu.entity.entity_type}
        </span>
      </div>

      {/* Primary Actions */}
      <button
        onClick={() => onInspectNode(contextMenu.rawId)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-stone-200 hover:bg-stone-800 hover:text-amber-400 text-left transition-colors cursor-pointer"
      >
        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
        <span>Open Details & Notes</span>
      </button>

      <button
        onClick={() => onAddChild(contextMenu.rawId)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-stone-200 hover:bg-stone-800 hover:text-emerald-400 text-left transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5 text-emerald-400" />
        <span>Add Child Branch (Tab)</span>
      </button>

      {/* Collapse / Expand Sub-branches */}
      {hasChildren && (
        <button
          onClick={() => onToggleCollapse(fullNodeId)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-stone-200 hover:bg-stone-800 hover:text-sky-400 text-left transition-colors cursor-pointer"
        >
          {isCollapsed ? (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
              <span>Expand Sub-branches</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
              <span>Collapse Sub-branches</span>
            </>
          )}
        </button>
      )}

      {/* Toggle Done / Active */}
      <button
        onClick={() => onToggleComplete(contextMenu.rawId)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-stone-200 hover:bg-stone-800 hover:text-emerald-300 text-left transition-colors cursor-pointer"
      >
        {isCompleted ? (
          <>
            <Circle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mark as Incomplete</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mark as Done</span>
          </>
        )}
      </button>

      {/* Destructive Actions */}
      <div className="border-t border-stone-850 my-1 pt-1">
        <button
          onClick={() => onDeleteNode(contextMenu.entity)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-rose-400 hover:bg-rose-500/10 text-left transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Node (Del)</span>
        </button>
      </div>
    </div>
  );
}
