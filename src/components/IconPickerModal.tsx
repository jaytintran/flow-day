import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Category } from '../types';
import { getCategoryColor } from './CategoryIcon';

export interface IconItem {
  name: string;
  label: string;
  category: string;
}

export const CURATED_ICONS: IconItem[] = [
  // Essentials
  { name: 'ListTodo', label: 'Todo List', category: 'Essentials' },
  { name: 'CheckSquare', label: 'Check Square', category: 'Essentials' },
  { name: 'Inbox', label: 'Inbox', category: 'Essentials' },
  { name: 'Bookmark', label: 'Bookmark', category: 'Essentials' },
  { name: 'Tag', label: 'Tag', category: 'Essentials' },
  { name: 'Folder', label: 'Folder', category: 'Essentials' },
  { name: 'Briefcase', label: 'Briefcase', category: 'Essentials' },
  { name: 'Calendar', label: 'Calendar', category: 'Essentials' },
  { name: 'Clock', label: 'Clock', category: 'Essentials' },
  { name: 'Sparkles', label: 'Sparkles', category: 'Essentials' },
  { name: 'Star', label: 'Star', category: 'Essentials' },
  { name: 'Heart', label: 'Heart', category: 'Essentials' },
  { name: 'Flag', label: 'Flag', category: 'Essentials' },
  { name: 'Flame', label: 'Flame', category: 'Essentials' },
  { name: 'Zap', label: 'Zap', category: 'Essentials' },
  { name: 'Target', label: 'Target', category: 'Essentials' },
  { name: 'Trophy', label: 'Trophy', category: 'Essentials' },
  { name: 'Milestone', label: 'Milestone', category: 'Essentials' },
  { name: 'Bell', label: 'Bell', category: 'Essentials' },
  { name: 'Pin', label: 'Pin', category: 'Essentials' },

  // Work & Productivity
  { name: 'BookOpen', label: 'Book', category: 'Productivity' },
  { name: 'GraduationCap', label: 'Study', category: 'Productivity' },
  { name: 'Code', label: 'Code', category: 'Productivity' },
  { name: 'Terminal', label: 'Terminal', category: 'Productivity' },
  { name: 'Cpu', label: 'Tech', category: 'Productivity' },
  { name: 'Layers', label: 'Layers', category: 'Productivity' },
  { name: 'Layout', label: 'Layout', category: 'Productivity' },
  { name: 'FileText', label: 'Document', category: 'Productivity' },
  { name: 'Lightbulb', label: 'Idea', category: 'Productivity' },
  { name: 'PenTool', label: 'Design', category: 'Productivity' },
  { name: 'Search', label: 'Search', category: 'Productivity' },
  { name: 'Archive', label: 'Archive', category: 'Productivity' },
  { name: 'Shield', label: 'Security', category: 'Productivity' },
  { name: 'Activity', label: 'Activity', category: 'Productivity' },
  { name: 'BarChart2', label: 'Analytics', category: 'Productivity' },
  { name: 'PieChart', label: 'Chart', category: 'Productivity' },
  { name: 'Kanban', label: 'Kanban', category: 'Productivity' },
  { name: 'GitBranch', label: 'Branch', category: 'Productivity' },
  { name: 'Workflow', label: 'Workflow', category: 'Productivity' },
  { name: 'ClipboardList', label: 'Clipboard', category: 'Productivity' },

  // Life & Health
  { name: 'Home', label: 'Home', category: 'Life' },
  { name: 'Coffee', label: 'Coffee', category: 'Life' },
  { name: 'Music', label: 'Music', category: 'Life' },
  { name: 'Smile', label: 'Smile', category: 'Life' },
  { name: 'Sun', label: 'Morning', category: 'Life' },
  { name: 'Moon', label: 'Night', category: 'Life' },
  { name: 'Dumbbell', label: 'Fitness', category: 'Life' },
  { name: 'Utensils', label: 'Food', category: 'Life' },
  { name: 'Plane', label: 'Travel', category: 'Life' },
  { name: 'ShoppingBag', label: 'Shopping', category: 'Life' },
  { name: 'DollarSign', label: 'Finance', category: 'Life' },
  { name: 'Wallet', label: 'Wallet', category: 'Life' },
  { name: 'CreditCard', label: 'Card', category: 'Life' },
  { name: 'Camera', label: 'Photo', category: 'Life' },
  { name: 'Film', label: 'Film', category: 'Life' },
  { name: 'MessageSquare', label: 'Message', category: 'Life' },
  { name: 'Phone', label: 'Phone', category: 'Life' },
  { name: 'User', label: 'Personal', category: 'Life' },
  { name: 'Users', label: 'Team', category: 'Life' },
  { name: 'Car', label: 'Vehicle', category: 'Life' },
  { name: 'Bike', label: 'Bicycle', category: 'Life' },
  { name: 'TreePine', label: 'Nature', category: 'Life' },
  { name: 'Apple', label: 'Nutrition', category: 'Life' },
  { name: 'HeartPulse', label: 'Health', category: 'Life' },

  // Tools & Objects
  { name: 'Settings', label: 'Settings', category: 'Tools' },
  { name: 'Wrench', label: 'Tools', category: 'Tools' },
  { name: 'Hash', label: 'Hash', category: 'Tools' },
  { name: 'Globe', label: 'Web', category: 'Tools' },
  { name: 'MapPin', label: 'Location', category: 'Tools' },
  { name: 'Gift', label: 'Gift', category: 'Tools' },
  { name: 'Key', label: 'Key', category: 'Tools' },
  { name: 'Lock', label: 'Lock', category: 'Tools' },
  { name: 'Package', label: 'Package', category: 'Tools' },
  { name: 'Box', label: 'Box', category: 'Tools' },
  { name: 'Tv', label: 'TV', category: 'Tools' },
  { name: 'Headphones', label: 'Audio', category: 'Tools' },
  { name: 'Feather', label: 'Writing', category: 'Tools' },
  { name: 'Send', label: 'Send', category: 'Tools' },
  { name: 'Share2', label: 'Share', category: 'Tools' },
  { name: 'Compass', label: 'Compass', category: 'Tools' },
  { name: 'Map', label: 'Map', category: 'Tools' },
  { name: 'Anchor', label: 'Anchor', category: 'Tools' },
  { name: 'Rocket', label: 'Rocket', category: 'Tools' },
  { name: 'Palette', label: 'Art', category: 'Tools' },
  { name: 'Scissors', label: 'Cut', category: 'Tools' },
  { name: 'Database', label: 'Data', category: 'Tools' },
];

const CATEGORY_TABS = ['All', 'Essentials', 'Productivity', 'Life', 'Tools'];

interface IconPickerModalProps {
  currentIcon?: string;
  currentColor?: Category['color'];
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export default function IconPickerModal({
  currentIcon = 'ListTodo',
  currentColor = 'violet',
  onSelect,
  onClose,
}: IconPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState('All');

  const filteredIcons = useMemo(() => {
    return CURATED_ICONS.filter((item) => {
      const matchesTab = selectedTab === 'All' || item.category === selectedTab;
      const matchesSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [search, selectedTab]);

  const colorDef = getCategoryColor(currentColor);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl w-[380px] max-w-[95vw] flex flex-col max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-stone-850 shrink-0">
            <div>
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
                Choose Icon
              </p>
              <p className="text-xs font-serif font-semibold text-stone-200 mt-0.5">
                Select an icon from Lucide
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 bg-[#0a0a0a] border border-stone-800 rounded-xl text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 px-4 pb-2.5 overflow-x-auto scrollbar-none shrink-0 border-b border-stone-850/60">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                  selectedTab === tab
                    ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-300 border border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Icon Grid */}
          <div
            className="flex-1 overflow-y-auto p-4 min-h-[220px] custom-scrollbar"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a2a transparent' }}
          >
            {filteredIcons.length === 0 ? (
              <div className="py-12 text-center text-stone-600">
                <p className="text-xs font-mono">No matching icons</p>
                <p className="text-[10px] font-mono text-stone-700 mt-1">Try a different search</p>
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-6 gap-2">
                {filteredIcons.map((item) => {
                  const IconComp =
                    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[item.name] ||
                    LucideIcons.Tag;
                  const isSelected = currentIcon === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        onSelect(item.name);
                        onClose();
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer group ${
                        isSelected
                          ? `${colorDef.bg} border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.15)] scale-105`
                          : 'bg-[#0a0a0a] border-stone-850 hover:border-stone-700 hover:bg-stone-900/60'
                      }`}
                      title={item.label}
                    >
                      <IconComp
                        className={`w-4 h-4 transition-colors ${
                          isSelected ? colorDef.text : 'text-stone-400 group-hover:text-stone-100'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
