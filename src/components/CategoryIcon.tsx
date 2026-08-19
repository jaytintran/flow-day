import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Category } from '../types';

export const CATEGORY_COLORS: Array<{
  key: Category['color'];
  name: string;
  dot: string;
  ring: string;
  pill: string;
  text: string;
  bg: string;
  border: string;
  glow: string;
}> = [
  {
    key: 'violet',
    name: 'Violet',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500',
    pill: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    glow: 'text-violet-400',
  },
  {
    key: 'sky',
    name: 'Sky',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500',
    pill: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    glow: 'text-sky-400',
  },
  {
    key: 'emerald',
    name: 'Emerald',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    pill: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    glow: 'text-emerald-400',
  },
  {
    key: 'amber',
    name: 'Amber',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
    pill: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    glow: 'text-amber-400',
  },
  {
    key: 'rose',
    name: 'Rose',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500',
    pill: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    glow: 'text-rose-400',
  },
  {
    key: 'indigo',
    name: 'Indigo',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-500',
    pill: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    glow: 'text-indigo-400',
  },
  {
    key: 'teal',
    name: 'Teal',
    dot: 'bg-teal-500',
    ring: 'ring-teal-500',
    pill: 'bg-teal-500/15 border-teal-500/40 text-teal-300',
    text: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    glow: 'text-teal-400',
  },
  {
    key: 'orange',
    name: 'Orange',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500',
    pill: 'bg-orange-500/15 border-orange-500/40 text-orange-300',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    glow: 'text-orange-400',
  },
];

export function getCategoryColor(color?: Category['color']) {
  return CATEGORY_COLORS.find((c) => c.key === color) ?? CATEGORY_COLORS[0];
}

interface CategoryIconProps {
  name?: string;
  color?: Category['color'];
  className?: string;
  fallback?: string;
}

export default function CategoryIcon({
  name,
  color,
  className = 'w-3.5 h-3.5',
  fallback = 'ListTodo',
}: CategoryIconProps) {
  const iconName = name || fallback;
  const colorDef = color ? getCategoryColor(color) : null;
  const colorClass = colorDef ? colorDef.text : '';

  // Lookup the icon component in LucideIcons
  const IconComponent =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName] ||
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[fallback] ||
    LucideIcons.ListTodo;

  return <IconComponent className={`${className} ${colorClass} shrink-0`} />;
}
