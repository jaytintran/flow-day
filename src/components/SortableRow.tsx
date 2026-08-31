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
  hideHandle?: boolean;
}

/**
 * A wrapper that makes its child draggable within a @dnd-kit sortable context.
 * Renders a grip handle on the left side and applies transform styles during drag.
 * The outer element gets `group` so `.group-hover:*` modifiers work on descendants.
 */
export default function SortableRow({
  id,
  children,
  disabled = false,
  hideHandle = false,
}: SortableRowProps) {
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

  if (hideHandle) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="group/sortable select-none touch-manipulation"
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="group/sortable">
      <div className="flex items-center gap-0.5">
        {/* Dedicated compact drag handle on the left edge for mobile */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 -ml-0.5 text-stone-600 hover:text-stone-400 active:text-amber-400 transition-colors cursor-grab active:cursor-grabbing touch-none shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
