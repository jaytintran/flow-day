import { useRef, useEffect, useCallback, useMemo } from 'react';
import { Node, Viewport } from '@xyflow/react';
import {
  STORAGE_POS_KEY,
  STORAGE_VIEWPORT_KEY,
  STORAGE_COLLAPSED_KEY,
  STORAGE_COMPLETED_FILTER_KEY,
  MindmapEdgeMetadata,
} from '../types';

export function useMindmapStorage() {
  const posCacheRef = useRef<Record<string, { x: number; y: number }>>({});
  const posSaveTimeoutRef = useRef<any>(null);

  // Initialize position cache from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_POS_KEY);
      if (raw) posCacheRef.current = JSON.parse(raw);
    } catch {}
  }, []);

  const savePositionsDebounced = useCallback((newNodes: Node[]) => {
    newNodes.forEach((n) => {
      if (n.position) {
        posCacheRef.current[n.id] = { x: n.position.x, y: n.position.y };
      }
    });
    if (posSaveTimeoutRef.current) clearTimeout(posSaveTimeoutRef.current);
    posSaveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(posCacheRef.current));
      } catch {}
    }, 300);
  }, []);

  const defaultViewport = useMemo<Viewport | undefined>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_VIEWPORT_KEY);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const saveViewport = useCallback((viewport: Viewport) => {
    try {
      localStorage.setItem(STORAGE_VIEWPORT_KEY, JSON.stringify(viewport));
    } catch {}
  }, []);

  const getInitialCollapsed = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(STORAGE_COLLAPSED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }, []);

  const saveCollapsed = useCallback((set: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_COLLAPSED_KEY, JSON.stringify([...set]));
    } catch {}
  }, []);

  const getInitialCompletedFilter = useCallback((): 'show' | 'dim' | 'hide' => {
    try {
      const raw = localStorage.getItem(STORAGE_COMPLETED_FILTER_KEY);
      return (raw as 'show' | 'dim' | 'hide') || 'show';
    } catch {
      return 'show';
    }
  }, []);

  const saveCompletedFilter = useCallback((mode: 'show' | 'dim' | 'hide') => {
    try {
      localStorage.setItem(STORAGE_COMPLETED_FILTER_KEY, mode);
    } catch {}
  }, []);

  const getInitialEdgeMetadata = useCallback((): Record<string, MindmapEdgeMetadata> => {
    try {
      const raw = localStorage.getItem('flowday_mindmap_edge_metadata_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const saveEdgeMetadata = useCallback(
    (edgeId: string, metadata: MindmapEdgeMetadata) => {
      try {
        const raw = localStorage.getItem('flowday_mindmap_edge_metadata_v1');
        const map = raw ? JSON.parse(raw) : {};
        if (!metadata.title && !metadata.description && !metadata.color && !metadata.styleType) {
          delete map[edgeId];
        } else {
          map[edgeId] = metadata;
        }
        localStorage.setItem('flowday_mindmap_edge_metadata_v1', JSON.stringify(map));
      } catch {}
    },
    [],
  );

  const deleteEdgeMetadata = useCallback((edgeId: string) => {
    try {
      const raw = localStorage.getItem('flowday_mindmap_edge_metadata_v1');
      if (raw) {
        const map = JSON.parse(raw);
        delete map[edgeId];
        localStorage.setItem('flowday_mindmap_edge_metadata_v1', JSON.stringify(map));
      }
    } catch {}
  }, []);

  return {
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
  };
}
