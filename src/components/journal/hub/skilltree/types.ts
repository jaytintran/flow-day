export interface SkillDrill {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface SkillNodeItem {
  id: string; // entity id
  title: string;
  icon?: string;
  color?: string;
  time_spent: number; // in ms
  content?: string;
  parent_ids: string[];
  tier: number; // 1 = Core, 2 = Major Cluster, 3 = Topic, 4 = Micro-concept, 5 = Drill/Kata
  status: 'locked' | 'available' | 'learning' | 'mastered';
  rank: number; // 0 to 5
  maxRank: number; // usually 5
  drills: SkillDrill[];
  spSpent: number;
  sort_order?: number;
}

export interface SkillViewSettings {
  showConduits: boolean;
  showParticles: boolean;
  showRankBadges: boolean;
  showTierBanners: boolean;
  showAuras: boolean;
  showLockedNodes: boolean;
}

export const DEFAULT_VIEW_SETTINGS: SkillViewSettings = {
  showConduits: true,
  showParticles: true,
  showRankBadges: true,
  showTierBanners: true,
  showAuras: true,
  showLockedNodes: true,
};

export type SkillLayoutMode = 'tree' | 'orbit';

export const STORAGE_LAYOUT_MODE_KEY = 'flowday_skilltree_layout_mode_v1';
export const STORAGE_VIEW_SETTINGS_KEY = 'flowday_skilltree_view_settings_v1';

export interface SkillTreeStats {
  totalXp: number;
  level: number;
  levelTitle: string;
  availableSp: number;
  totalHours: number;
  masteryPercentage: number;
}

export const LEVEL_TITLES = [
  'Novice Explorer',
  'Apprentice Initiate',
  'Rune Carver',
  'Knowledge Weaver',
  'Arcane Practitioner',
  'Systems Adept',
  'Master Architect',
  'Grandmaster Sorcerer',
  'Legendary Archmage',
  'Ascended Omniscient',
];

export interface ElementalTheme {
  id: string;
  name: string;
  glow: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const ELEMENTAL_THEMES: ElementalTheme[] = [
  // Solar & Radiant (Gold / Yellow / Amber)
  { id: 'amber', name: 'Solar Gold', glow: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-400', borderClass: 'border-amber-500' },
  { id: 'yellow', name: 'Radiant Sun', glow: '#eab308', bgClass: 'bg-yellow-500', textClass: 'text-yellow-400', borderClass: 'border-yellow-500' },
  { id: 'orange', name: 'Molten Magma', glow: '#f97316', bgClass: 'bg-orange-500', textClass: 'text-orange-400', borderClass: 'border-orange-500' },
  { id: 'bronze', name: 'Ancient Bronze', glow: '#d97706', bgClass: 'bg-amber-600', textClass: 'text-amber-500', borderClass: 'border-amber-600' },

  // Flame & Blood (Red / Crimson / Rose)
  { id: 'red', name: 'Inferno Flame', glow: '#ef4444', bgClass: 'bg-red-500', textClass: 'text-red-400', borderClass: 'border-red-500' },
  { id: 'crimson', name: 'Blood Crimson', glow: '#dc2626', bgClass: 'bg-red-600', textClass: 'text-red-400', borderClass: 'border-red-600' },
  { id: 'rose', name: 'Scarlet Rose', glow: '#f43f5e', bgClass: 'bg-rose-500', textClass: 'text-rose-400', borderClass: 'border-rose-500' },
  { id: 'ruby', name: 'Imperial Ruby', glow: '#e11d48', bgClass: 'bg-rose-600', textClass: 'text-rose-400', borderClass: 'border-rose-600' },

  // Arcane & Void (Purple / Violet / Fuchsia / Pink)
  { id: 'violet', name: 'Void Purple', glow: '#8b5cf6', bgClass: 'bg-violet-500', textClass: 'text-violet-400', borderClass: 'border-violet-500' },
  { id: 'purple', name: 'Arcane Mystic', glow: '#a855f7', bgClass: 'bg-purple-500', textClass: 'text-purple-400', borderClass: 'border-purple-500' },
  { id: 'fuchsia', name: 'Astral Warp', glow: '#d946ef', bgClass: 'bg-fuchsia-500', textClass: 'text-fuchsia-400', borderClass: 'border-fuchsia-500' },
  { id: 'pink', name: 'Lotus Blossom', glow: '#ec4899', bgClass: 'bg-pink-500', textClass: 'text-pink-400', borderClass: 'border-pink-500' },

  // Lightning & Water (Blue / Indigo / Sky / Cyan)
  { id: 'indigo', name: 'Electric Storm', glow: '#6366f1', bgClass: 'bg-indigo-500', textClass: 'text-indigo-400', borderClass: 'border-indigo-500' },
  { id: 'blue', name: 'Abyssal Depths', glow: '#3b82f6', bgClass: 'bg-blue-500', textClass: 'text-blue-400', borderClass: 'border-blue-500' },
  { id: 'sky', name: 'Frost Cyan', glow: '#38bdf8', bgClass: 'bg-sky-400', textClass: 'text-sky-400', borderClass: 'border-sky-400' },
  { id: 'cyan', name: 'Glacial Ice', glow: '#06b6d4', bgClass: 'bg-cyan-500', textClass: 'text-cyan-400', borderClass: 'border-cyan-500' },

  // Nature & Poison (Teal / Emerald / Green / Lime)
  { id: 'teal', name: 'Deep Reef', glow: '#14b8a6', bgClass: 'bg-teal-500', textClass: 'text-teal-400', borderClass: 'border-teal-500' },
  { id: 'emerald', name: 'Living Emerald', glow: '#10b981', bgClass: 'bg-emerald-500', textClass: 'text-emerald-400', borderClass: 'border-emerald-500' },
  { id: 'green', name: 'Forest Druid', glow: '#22c55e', bgClass: 'bg-green-500', textClass: 'text-green-400', borderClass: 'border-green-500' },
  { id: 'lime', name: 'Venom Acid', glow: '#84cc16', bgClass: 'bg-lime-500', textClass: 'text-lime-400', borderClass: 'border-lime-500' },

  // Shadow, Steel, Celestial & Earth (Slate / Zinc / Stone / Gold)
  { id: 'zinc', name: 'Titanium Steel', glow: '#a1a1aa', bgClass: 'bg-zinc-400', textClass: 'text-zinc-300', borderClass: 'border-zinc-400' },
  { id: 'slate', name: 'Shadow Obsidian', glow: '#64748b', bgClass: 'bg-slate-500', textClass: 'text-slate-300', borderClass: 'border-slate-500' },
  { id: 'stone', name: 'Earthen Stone', glow: '#78716c', bgClass: 'bg-stone-500', textClass: 'text-stone-300', borderClass: 'border-stone-500' },
  { id: 'celestial', name: 'Celestial White', glow: '#e2e8f0', bgClass: 'bg-slate-200', textClass: 'text-white', borderClass: 'border-white' },
];

export const STORAGE_SP_KEY = 'flowday_skilltree_sp_spent_v1';
export const STORAGE_ACTIVE_TREE_KEY = 'flowday_skilltree_active_tree_id_v1';
