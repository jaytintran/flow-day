import React, { useState, useRef, useEffect } from 'react';
import { Compass, Zap, Hand, MousePointer, Settings2, Sliders } from 'lucide-react';

interface MindmapHeaderProps {
  onSwitchToSkillTree?: () => void;
  interactionMode: 'pan' | 'select';
  onInteractionModeChange: (mode: 'pan' | 'select') => void;
  completedFilterMode: 'show' | 'dim' | 'hide';
  onCompletedFilterChange: (mode: 'show' | 'dim' | 'hide') => void;
}

export function MindmapHeader({
  onSwitchToSkillTree,
  interactionMode,
  onInteractionModeChange,
  completedFilterMode,
  onCompletedFilterChange,
}: MindmapHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as any)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSettingsOpen]);

  return (
    <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none gap-2">
      {/* Top-Left: Clean Segmented Switcher between Mindmap and RPG Skill Tree */}
      <div className="flex items-center p-0.5 bg-[#141417]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl pointer-events-auto">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm select-none cursor-default">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>Mindmap</span>
        </button>
        {onSwitchToSkillTree && (
          <button
            onClick={onSwitchToSkillTree}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-all cursor-pointer select-none"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>RPG Skill Tree</span>
          </button>
        )}
      </div>

      {/* Top-Right: Pan/Select Pill & Settings Popover */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center p-0.5 bg-[#141417]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg">
          <button
            onClick={() => onInteractionModeChange('pan')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              interactionMode === 'pan'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Pan Mode (Drag to navigate)"
          >
            <Hand className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onInteractionModeChange('select')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              interactionMode === 'select'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Select Mode (Marquee selection)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ⚙️ Canvas Settings Button & Popover */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSettingsOpen((prev) => !prev);
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer shadow-lg ${
              isSettingsOpen
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-[#141417]/90 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Canvas Settings & Filters"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {isSettingsOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-2 w-56 bg-[#121215]/98 backdrop-blur-2xl border border-stone-800 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3"
            >
              <div className="flex items-center gap-1.5 pb-2 border-b border-stone-800 text-xs font-mono font-bold text-stone-200 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Canvas Settings</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block">
                  Done Items Display
                </label>
                <div className="grid grid-cols-3 gap-1 bg-[#1a1a20] p-1 rounded-xl border border-stone-800">
                  {(['show', 'dim', 'hide'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onCompletedFilterChange(mode)}
                      className={`py-1 text-center rounded-lg text-[11px] font-mono capitalize transition-all cursor-pointer ${
                        completedFilterMode === mode
                          ? 'bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
