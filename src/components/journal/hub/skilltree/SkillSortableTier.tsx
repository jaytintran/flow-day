import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SkillNodeItem } from './types';
import { SkillGlyph } from './SkillGlyph';

interface SortableSkillItemProps {
  skill: SkillNodeItem;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  showRankBadges: boolean;
  showAuras: boolean;
  onSelect: (skill: SkillNodeItem) => void;
  onHover: (skill: SkillNodeItem | null) => void;
}

function SortableSkillItem({
  skill,
  isSelected,
  isHighlighted,
  isDimmed,
  showRankBadges,
  showAuras,
  onSelect,
  onHover,
}: SortableSkillItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: skill.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : undefined,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SkillGlyph
        skill={skill}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        isDimmed={isDimmed}
        showRankBadges={showRankBadges}
        showAuras={showAuras}
        onSelect={onSelect}
        onHover={onHover}
      />
    </div>
  );
}

interface SkillSortableTierProps {
  tier: number;
  label: string;
  badgeClass: string;
  skills: SkillNodeItem[];
  selectedSkill: SkillNodeItem | null;
  activeLineageIds: Set<string>;
  showTierBanners: boolean;
  showRankBadges: boolean;
  showAuras: boolean;
  onReorder: (tier: number, newOrderedIds: string[]) => void;
  onSelect: (skill: SkillNodeItem) => void;
  onHover: (skill: SkillNodeItem | null) => void;
}

export function SkillSortableTier({
  tier,
  label,
  badgeClass,
  skills,
  selectedSkill,
  activeLineageIds,
  showTierBanners,
  showRankBadges,
  showAuras,
  onReorder,
  onSelect,
  onHover,
}: SkillSortableTierProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Avoid accidental drag when clicking
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = skills.findIndex((s) => s.id === active.id);
    const newIndex = skills.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = [...skills];
      const [moved] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, moved);
      onReorder(
        tier,
        newItems.map((s) => s.id),
      );
    }
  };

  if (skills.length === 0) return null;

  const gapClass =
    tier === 1
      ? 'gap-12'
      : tier === 2
        ? 'gap-10'
        : tier === 3
          ? 'gap-8'
          : tier === 4
            ? 'gap-6'
            : 'gap-5';

  return (
    <div className="flex flex-col items-center space-y-3">
      {showTierBanners && (
        <span
          className={`text-[10px] font-mono tracking-widest uppercase font-bold px-3 py-0.5 rounded-full border ${badgeClass}`}
        >
          {label}
        </span>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={skills.map((s) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className={`flex flex-wrap items-center justify-center ${gapClass}`}>
            {skills.map((s) => (
              <SortableSkillItem
                key={s.id}
                skill={s}
                isSelected={selectedSkill?.id === s.id}
                isHighlighted={activeLineageIds.has(s.id)}
                isDimmed={activeLineageIds.size > 0 && !activeLineageIds.has(s.id)}
                showRankBadges={showRankBadges}
                showAuras={showAuras}
                onSelect={onSelect}
                onHover={onHover}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
