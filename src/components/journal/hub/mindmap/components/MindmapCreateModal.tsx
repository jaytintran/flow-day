import React from 'react';
import { X } from 'lucide-react';
import { EntityTypeDefinition } from '../../../../../types';
import { renderLucideIcon } from './MindmapNodes';

interface MindmapCreateModalProps {
  isCreatingType: string | null;
  creatingParentId: string | null;
  newTitle: string;
  newIcon: string;
  entityTypeMap: Map<string, EntityTypeDefinition>;
  onTitleChange: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function MindmapCreateModal({
  isCreatingType,
  creatingParentId,
  newTitle,
  newIcon,
  entityTypeMap,
  onTitleChange,
  onConfirm,
  onClose,
}: MindmapCreateModalProps) {
  if (!isCreatingType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#141416] border border-stone-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-850 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              {renderLucideIcon(newIcon, 'Target', 'w-4 h-4')}
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-100">
                Add {entityTypeMap.get(isCreatingType)?.name || isCreatingType}
              </h3>
              <p className="text-[10px] font-mono text-stone-400">
                {creatingParentId ? 'Connected to parent branch' : 'Floating root branch'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          autoFocus
          value={newTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Name or title..."
          className="w-full bg-[#1c1c20] border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-stone-100 focus:outline-none shadow-inner"
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-mono text-stone-400 hover:text-stone-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg cursor-pointer transition-all active:scale-95"
          >
            Create Branch
          </button>
        </div>
      </div>
    </div>
  );
}
