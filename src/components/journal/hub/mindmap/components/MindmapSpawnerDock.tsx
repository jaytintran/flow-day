import React from 'react';
import { Sparkles } from 'lucide-react';
import { EntityTypeDefinition } from '../../../../../types';
import { COLOR_THEMES, renderLucideIcon } from './MindmapNodes';

interface MindmapSpawnerDockProps {
  entityTypesList: EntityTypeDefinition[];
  onSelectTypeToCreate: (typeId: string, icon?: string) => void;
  onOpenCustomTypeModal: () => void;
}

export function MindmapSpawnerDock({
  entityTypesList,
  onSelectTypeToCreate,
  onOpenCustomTypeModal,
}: MindmapSpawnerDockProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#121212]/95 backdrop-blur-md border border-stone-800 p-1.5 rounded-2xl shadow-2xl overflow-x-auto max-w-[95vw] scrollbar-none">
      {entityTypesList.map((t) => {
        const theme = COLOR_THEMES[t.color] || COLOR_THEMES.indigo;
        return (
          <button
            key={t.id}
            onClick={() => onSelectTypeToCreate(t.id, t.icon)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder} text-xs font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0`}
          >
            {renderLucideIcon(t.icon, 'Target', 'w-3.5 h-3.5')}
            <span>+ {t.name}</span>
          </button>
        );
      })}

      <button
        onClick={onOpenCustomTypeModal}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-750 hover:border-amber-500/50 text-xs font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
        title="Create a custom entity type"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>New Type</span>
      </button>
    </div>
  );
}
