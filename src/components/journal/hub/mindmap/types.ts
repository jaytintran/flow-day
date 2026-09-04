import { createContext } from 'react';
import { EntityColor, UnifiedEntity } from '../../../../types';

export const STORAGE_POS_KEY = 'flowday_mindmap_positions_v3';
export const STORAGE_VIEWPORT_KEY = 'flowday_mindmap_viewport_v3';
export const STORAGE_COLLAPSED_KEY = 'flowday_mindmap_collapsed_v3';
export const STORAGE_EDGES_KEY = 'flowday_mindmap_custom_edges_v3';
export const STORAGE_COMPLETED_FILTER_KEY = 'flowday_mindmap_completed_filter_v3';
export const STORAGE_EDGE_METADATA_KEY = 'flowday_mindmap_edge_metadata_v1';

export const COLOR_OPTIONS: EntityColor[] = [
  'indigo',
  'sky',
  'amber',
  'emerald',
  'rose',
  'violet',
  'teal',
  'orange',
  'cyan',
  'fuchsia',
];

export interface MindmapActionContextType {
  onInspectNode?: (id: string) => void;
  onQuickRename?: (id: string, newTitle: string) => Promise<void>;
  onQuickUpdateNotes?: (id: string, notes: string) => Promise<void>;
  onQuickChangeIcon?: (id: string, icon: string) => Promise<void>;
  onToggleCollapse?: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onToggleComplete?: (id: string) => void;
  onOpenContextMenu?: (e: React.MouseEvent, rawId: string) => void;
}

export const MindmapActionContext = createContext<MindmapActionContextType>({});

export interface MindmapNodeData {
  id: string;
  rawId: string;
  title: string;
  type: string;
  typeName?: string;
  icon?: string;
  color?: string;
  status?: string;
  time_spent?: number;
  description?: string;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  isDimmed?: boolean;
  hasStatus?: boolean;
  hasTimeTracking?: boolean;
  tier?: number; // 0 = root, 1 = child, 2 = grandchild, 3 = great-grandchild, 4+ = leaf
}

export interface MindmapEdgeMetadata {
  title?: string;
  description?: string;
  color?: string; // hex or preset color
  styleType?: 'solid' | 'dashed' | 'dotted' | 'smooth' | 'straight';
}

export interface MindmapEdgeData extends Record<string, unknown> {
  title?: string;
  description?: string;
  isDimmed?: boolean;
  isCompleted?: boolean;
  strokeColor?: string;
  styleType?: 'solid' | 'dashed' | 'dotted' | 'smooth' | 'straight';
}

export interface ContextMenuState {
  x: number;
  y: number;
  rawId: string;
  entity: UnifiedEntity;
}
