/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableRowProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * A wrapper that makes its child draggable within a @dnd-kit sortable context.
 * Renders a grip handle on the left side and applies transform styles during drag.
 * The outer element gets `group` so `.group-hover:*` modifiers work on descendants.
 */
export default function SortableRow({ id, children, disabled = false }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 50 : 'auto',
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div ref={setNodeRef} style={style} className="group/sortable">
      <div className="flex items-start gap-0">
        {/* Drag handle — visible always on mobile, hover-only on desktop */}
        <button
          {...attributes}
          {...listeners}
          className="mt-3.5 -ml-1 p-0.5 rounded text-stone-600 hover:text-stone-400 hover:bg-stone-800/60 transition-colors cursor-grab active:cursor-grabbing touch-none shrink-0 opacity-100 md:opacity-0 md:group-hover/sortable:opacity-100"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
