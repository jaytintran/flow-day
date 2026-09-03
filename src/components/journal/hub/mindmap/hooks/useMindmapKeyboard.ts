import { useEffect } from 'react';
import { UnifiedEntity } from '../../../../types';

interface UseMindmapKeyboardProps {
  selectedNodeId: string | null;
  entityMap: Map<string, UnifiedEntity>;
  onAddChild: (rawId: string) => void;
  onAddSibling: (entity: UnifiedEntity) => void;
  onDeleteNode: (entity: UnifiedEntity) => void;
}

export function useMindmapKeyboard({
  selectedNodeId,
  entityMap,
  onAddChild,
  onAddSibling,
  onDeleteNode,
}: UseMindmapKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (!selectedNodeId) return;
      const [, rawId] = selectedNodeId.split('-');
      const currentEntity = entityMap.get(rawId);
      if (!currentEntity) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        onAddChild(rawId);
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        onAddSibling(currentEntity);
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        onDeleteNode(currentEntity);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, entityMap, onAddChild, onAddSibling, onDeleteNode]);
}
