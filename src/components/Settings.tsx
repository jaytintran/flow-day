/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  X,
  Eye,
  EyeOff,
  HelpCircle,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  Moon,
  Sun,
  Sliders,
  Cloud,
  Keyboard,
  ShieldCheck,
  Check,
  BookOpen,
  Layers,
  Compass,
  Zap,
  Sparkles,
  Calendar,
  Clock,
  Star,
  Tag,
  Activity,
  Flame,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGistSync } from '../hooks/useGistSync';
import { useTheme } from '../lib/theme';

export type SettingsTab = 'preferences' | 'sync' | 'shortcuts' | 'guide';
export type GuideSubTab = 'philosophy' | 'types' | 'rules' | 'syntax';

interface SettingsProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: SettingsTab;
}

export default function Settings({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  initialTab = 'preferences',
}: SettingsProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [guideSubTab, setGuideSubTab] = useState<GuideSubTab>('philosophy');
  const [showPat, setShowPat] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'push' | 'pull' | null>(null);
  const [theme, setTheme] = useTheme();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update active tab if initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Listen to custom event for opening settings or philosophy/guide
  useEffect(() => {
    const handleOpenSettingsEvent = (
      e: CustomEvent<{ tab?: SettingsTab; guideSubTab?: GuideSubTab }>,
    ) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
      if (e.detail?.guideSubTab) {
        setGuideSubTab(e.detail.guideSubTab);
      }
      setInternalIsOpen(true);
    };

    const handleOpenPhilosophyEvent = (
      e: CustomEvent<{ tab?: GuideSubTab }>,
    ) => {
      setActiveTab('guide');
      if (e.detail?.tab) {
        setGuideSubTab(e.detail.tab);
      }
      setInternalIsOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement)?.tagName || '',
        ) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setInternalIsOpen((prev) => {
          if (!prev) {
            setActiveTab('guide');
          }
          return !prev;
        });
      } else if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('flowday-open-settings' as any, handleOpenSettingsEvent);
    window.addEventListener('flowday-open-philosophy' as any, handleOpenPhilosophyEvent);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('flowday-open-settings' as any, handleOpenSettingsEvent);
      window.removeEventListener('flowday-open-philosophy' as any, handleOpenPhilosophyEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
    setShowHelp(false);
    setConfirmAction(null);
  };

  const [showTimelineContent, setShowTimelineContent] = useState(() => {
    try {
      const stored = localStorage.getItem('flowday_show_note_event_content');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const handleToggleTimelineContent = (val: boolean) => {
    setShowTimelineContent(val);
    try {
      localStorage.setItem('flowday_show_note_event_content', String(val));
      window.dispatchEvent(new CustomEvent('flowday-settings-change'));
    } catch {}
  };

  const [cardsPerRow, setCardsPerRow] = useState(() => {
    try {
      return localStorage.getItem('flowday_lists_cards_per_row') || '3';
    } catch {
      return '3';
    }
  });

  const handleSaveCardsPerRow = (val: string) => {
    setCardsPerRow(val);
    try {
      localStorage.setItem('flowday_lists_cards_per_row', val);
      window.dispatchEvent(new CustomEvent('flowday-settings-change'));
    } catch {}
  };

  const [sleepTime, setSleepTime] = useState(() => {
    try {
      return localStorage.getItem('flowday_sleep_time') || '23:00';
    } catch {
      return '23:00';
    }
  });

  const handleSaveSleepTime = (val: string) => {
    setSleepTime(val);
    try {
      localStorage.setItem('flowday_sleep_time', val);
      window.dispatchEvent(new CustomEvent('flowday-settings-change'));
    } catch {}
  };

  const [sleepEnabled, setSleepEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('flowday_sleep_enabled');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const handleToggleSleepEnabled = (val: boolean) => {
    setSleepEnabled(val);
    try {
      localStorage.setItem('flowday_sleep_enabled', String(val));
      window.dispatchEvent(new CustomEvent('flowday-settings-change'));
    } catch {}
  };

  const [showDayPhases, setShowDayPhases] = useState(() => {
    try {
      const stored = localStorage.getItem('flowday_show_day_phases');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const handleToggleShowDayPhases = (val: boolean) => {
    setShowDayPhases(val);
    try {
      localStorage.setItem('flowday_show_day_phases', String(val));
      window.dispatchEvent(new CustomEvent('flowday-settings-change'));
    } catch {}
  };

  const [desktopHubLayout, setDesktopHubLayout] = useState<'canvas' | 'classic'>(() => {
    try {
      const stored = localStorage.getItem('flowday_desktop_hub_layout');
      return stored === 'classic' ? 'classic' : 'canvas';
    } catch {
      return 'canvas';
    }
  });

  const handleSaveDesktopHubLayout = (val: 'canvas' | 'classic') => {
    setDesktopHubLayout(val);
    try {
      localStorage.setItem('flowday_desktop_hub_layout', val);
      window.dispatchEvent(new CustomEvent('flowday-settings-change'));
    } catch {}
  };

  const {
    pat,
    setPat,
    gistId,
    setGistId,
    lastSync,
    status,
    statusMsg,
    isConfigured,
    reload,
    pushToCloud,
    pullFromCloud,
    testConnection,
    handleAutoCreateGist,
    handleSaveCredentials,
  } = useGistSync();

  const handleOpen = () => {
    reload();
    setInternalIsOpen(true);
  };

  const renderModalContent = () => (
    <>
      {/* Modal Header & Segmented Tabs */}
      <div
        className={`flex flex-col border-b border-stone-850 shrink-0 ${
          isMobile ? 'bg-[#181818] pt-2 px-4' : 'bg-stone-900/90 backdrop-blur-sm pt-3 px-6'
        }`}
      >
        <div className="flex items-center justify-between pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-500">
              FlowDay
            </span>
            <span className="text-xs text-stone-500 font-mono">/</span>
            <h2 className="text-stone-100 font-serif font-bold text-base">Settings</h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setActiveTab('preferences');
              setShowHelp(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'preferences'
                ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-500" />
            <span>Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('sync');
              setShowHelp(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'sync'
                ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Cloud Sync</span>
            {isConfigured && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('shortcuts');
              setShowHelp(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'shortcuts'
                ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5 text-purple-400" />
            <span>Shortcuts &amp; Info</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('guide');
              setShowHelp(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'guide'
                ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Guide &amp; Philosophy</span>
          </button>
        </div>
      </div>

      {/* Tab Content Area */}
      <div className={`overflow-y-auto flex-1 space-y-5 ${isMobile ? 'p-4' : 'p-6'}`}>
                {/* ======================================================== */}
                {/* TAB 1: PREFERENCES                                      */}
                {/* ======================================================== */}
                {activeTab === 'preferences' && (
                  <div className="space-y-4">
                    {/* Theme / Appearance */}
                    <div className="flex items-center justify-between p-3.5 bg-stone-950/60 border border-stone-850 rounded-2xl">
                      <div className="flex flex-col gap-0.5 pr-4">
                        <span className="text-xs text-stone-200 font-semibold">
                          Theme &amp; Appearance
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          Obsidian Dark or Warm Sepia for reduced eye fatigue.
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 p-1 rounded-xl shrink-0">
                        <button
                          type="button"
                          onClick={() => setTheme('dark')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            theme === 'dark'
                              ? 'bg-amber-500 text-stone-950 shadow-xs'
                              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Dark</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme('sepia')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            theme === 'sepia'
                              ? 'bg-amber-500 text-stone-950 shadow-xs'
                              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>Sepia</span>
                        </button>
                      </div>
                    </div>

                    {/* Show Entry Details */}
                    <div className="flex items-center justify-between p-3.5 bg-stone-950/60 border border-stone-850 rounded-2xl">
                      <div className="flex flex-col gap-0.5 pr-4">
                        <span className="text-xs text-stone-200 font-semibold">
                          Show Entry Details
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          Display descriptions &amp; notes on timeline items.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showTimelineContent}
                          onChange={(e) => handleToggleTimelineContent(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-800 rounded-full peer peer-focus:outline-none peer-checked:bg-amber-500/80 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-400 peer-checked:after:bg-stone-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                      </label>
                    </div>

                    {/* Daylight Phases */}
                    <div className="flex items-center justify-between p-3.5 bg-stone-950/60 border border-stone-850 rounded-2xl">
                      <div className="flex flex-col gap-0.5 pr-4">
                        <span className="text-xs text-stone-200 font-semibold">
                          Daylight Phases (Day View)
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          Group timeline by Morning, Noon, Afternoon, and Night.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showDayPhases}
                          onChange={(e) => handleToggleShowDayPhases(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-800 rounded-full peer peer-focus:outline-none peer-checked:bg-amber-500/80 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-400 peer-checked:after:bg-stone-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                      </label>
                    </div>

                    {/* Sleep Marker & Bedtime */}
                    <div className="flex flex-col bg-stone-950/60 border border-stone-850 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between p-3.5">
                        <div className="flex flex-col gap-0.5 pr-4">
                          <span className="text-xs text-stone-200 font-semibold">
                            Show Sleep Marker
                          </span>
                          <span className="text-[11px] font-mono text-stone-500">
                            Display bedtime line with live countdown on timeline.
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={sleepEnabled}
                            onChange={(e) => handleToggleSleepEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-stone-800 rounded-full peer peer-focus:outline-none peer-checked:bg-amber-500/80 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-400 peer-checked:after:bg-stone-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                        </label>
                      </div>

                      {sleepEnabled && (
                        <div className="flex items-center justify-between px-3.5 pb-3.5 pt-2 border-t border-stone-850/80 bg-stone-900/30">
                          <span className="text-[11px] font-mono text-stone-400">Bedtime</span>
                          <input
                            type="time"
                            value={sleepTime}
                            onChange={(e) => handleSaveSleepTime(e.target.value)}
                            className="bg-stone-900 border border-stone-800 hover:border-stone-700 focus:border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-stone-100 font-mono focus:outline-none transition-all cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* Desktop Cards Per Row */}
                    <div className="flex items-center justify-between p-3.5 bg-stone-950/60 border border-stone-850 rounded-2xl">
                      <div className="flex flex-col gap-0.5 pr-4">
                        <span className="text-xs text-stone-200 font-semibold">
                          Desktop Cards Per Row
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          Task grid columns on desktop in Lists view.
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 p-1 rounded-xl shrink-0">
                        {['1', '2', '3', '4'].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleSaveCardsPerRow(num)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                              cardsPerRow === num
                                ? 'bg-amber-500 text-stone-950 shadow-xs'
                                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Desktop Hub Layout Mode */}
                    <div className="flex items-center justify-between p-3.5 bg-stone-950/60 border border-stone-850 rounded-2xl">
                      <div className="flex flex-col gap-0.5 pr-4">
                        <span className="text-xs text-stone-200 font-semibold">
                          Desktop Hub View
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          Interactive Mindmap canvas or multi-column matrix.
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 p-1 rounded-xl shrink-0">
                        {[
                          { id: 'canvas', label: 'Mindmap' },
                          { id: 'classic', label: 'Classic' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              handleSaveDesktopHubLayout(item.id as 'canvas' | 'classic')
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                              desktopHubLayout === item.id
                                ? 'bg-amber-500 text-stone-950 shadow-xs'
                                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* FlowDay Philosophy & Guide Banner */}
                    <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                          <BookOpen className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-serif font-bold text-stone-100">
                            FlowDay Guide &amp; Philosophy
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono mt-0.5 truncate">
                            Explore core principles, 4 golden rules &amp; cheatsheet
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleClose();
                          window.dispatchEvent(new CustomEvent('flowday-open-philosophy'));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-stone-950 hover:bg-amber-400 text-xs font-mono font-bold shrink-0 transition-colors shadow-xs active:scale-95 cursor-pointer"
                      >
                        Read Guide
                      </button>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* TAB 2: CLOUD SYNC                                       */}
                {/* ======================================================== */}
                {activeTab === 'sync' && (
                  <div className="space-y-4">
                    {/* Header bar with setup guide button */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-stone-100 font-serif font-bold text-sm">
                          GitHub Gist Synchronization
                        </h3>
                        {lastSync && (
                          <span className="text-[10px] font-mono text-stone-500">
                            Last synced: {lastSync}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowHelp(!showHelp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          showHelp
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-800'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Setup Guide</span>
                      </button>
                    </div>

                    {/* Expandable Setup Instructions */}
                    <AnimatePresence>
                      {showHelp && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border border-amber-500/20 bg-amber-950/15 rounded-2xl p-4 text-xs space-y-2.5 text-stone-300 font-mono leading-relaxed"
                        >
                          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                            <Info className="w-4 h-4" />
                            How to set up GitHub Gist Sync
                          </div>
                          <ol className="list-decimal pl-4 space-y-1.5 text-stone-400 text-[11px]">
                            <li>
                              Go to{' '}
                              <a
                                href="https://github.com/settings/tokens"
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber-400 hover:underline"
                              >
                                GitHub Personal Access Tokens (Classic)
                              </a>
                              .
                            </li>
                            <li>
                              Generate a new token with the{' '}
                              <strong className="text-stone-200">gist</strong> checkbox enabled.
                            </li>
                            <li>Paste the generated token into the PAT field below.</li>
                            <li>
                              Click <strong className="text-stone-200">Auto-Create Gist</strong> to
                              automatically initialize your private FlowDay backup.
                            </li>
                            <li>
                              Click <strong className="text-stone-200">Push to Cloud</strong> to save
                              your current data, or enter the same PAT &amp; Gist ID on your other
                              devices to <strong className="text-stone-200">Pull</strong>.
                            </li>
                          </ol>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Inputs */}
                    <div className="space-y-3 p-4 bg-stone-950/60 border border-stone-850 rounded-2xl">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 block">
                          GitHub Personal Access Token (PAT)
                        </label>
                        <div className="relative">
                          <input
                            type={showPat ? 'text' : 'password'}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            value={pat}
                            onChange={(e) => setPat(e.target.value)}
                            className="w-full bg-stone-900 border border-stone-800 hover:border-stone-700 focus:border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-600 font-mono focus:outline-none transition-all pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPat(!showPat)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
                          >
                            {showPat ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 block">
                          Gist ID
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. 8a6b2c4d..."
                            value={gistId}
                            onChange={(e) => setGistId(e.target.value)}
                            className="flex-1 bg-stone-900 border border-stone-800 hover:border-stone-700 focus:border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-600 font-mono focus:outline-none transition-all"
                          />
                          {!gistId.trim() && pat.trim() && (
                            <button
                              type="button"
                              onClick={handleAutoCreateGist}
                              className="px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
                            >
                              Auto-Create
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Save & Test Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSaveCredentials}
                          className="px-3.5 py-2 bg-stone-900 border border-stone-800 hover:border-stone-700 hover:bg-stone-850 text-stone-200 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Save Credentials</span>
                        </button>
                        <button
                          type="button"
                          onClick={testConnection}
                          className="px-3.5 py-2 bg-stone-900 border border-stone-800 hover:border-stone-700 hover:bg-stone-850 text-stone-400 hover:text-stone-200 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                        >
                          Test Connection
                        </button>
                      </div>
                    </div>

                    {/* Live Status Feedback */}
                    {status !== 'idle' && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-mono leading-relaxed ${
                          status === 'loading'
                            ? 'bg-stone-900 border-stone-800 text-stone-300'
                            : status === 'success'
                              ? 'bg-emerald-950/25 border-emerald-500/25 text-emerald-400'
                              : 'bg-red-950/25 border-red-500/25 text-red-400'
                        }`}
                      >
                        {status === 'loading' && (
                          <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-amber-400" />
                        )}
                        {status === 'success' && (
                          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                        )}
                        {status === 'error' && (
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                        )}
                        <span className="flex-1">{statusMsg}</span>
                      </motion.div>
                    )}

                    {/* Push / Pull Big Action Cards */}
                    {isConfigured && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setConfirmAction('push')}
                          className="flex flex-col items-center justify-center p-4 bg-stone-950/80 border border-stone-850 hover:border-amber-500/30 hover:bg-stone-900/60 rounded-2xl transition-all cursor-pointer group active:scale-[0.98]"
                        >
                          <UploadCloud className="w-6 h-6 text-stone-400 group-hover:text-amber-400 transition-colors mb-1.5" />
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                            Push to Cloud
                          </span>
                          <span className="text-[10px] font-mono text-stone-500 group-hover:text-stone-400 transition-colors mt-0.5 text-center">
                            Backup local data
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmAction('pull')}
                          className="flex flex-col items-center justify-center p-4 bg-stone-950/80 border border-stone-850 hover:border-sky-500/30 hover:bg-stone-900/60 rounded-2xl transition-all cursor-pointer group active:scale-[0.98]"
                        >
                          <DownloadCloud className="w-6 h-6 text-stone-400 group-hover:text-sky-400 transition-colors mb-1.5" />
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                            Pull from Cloud
                          </span>
                          <span className="text-[10px] font-mono text-stone-500 group-hover:text-stone-400 transition-colors mt-0.5 text-center">
                            Restore to this device
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Confirm Push/Pull Warning */}
                    <AnimatePresence>
                      {confirmAction && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 text-xs font-mono space-y-3"
                        >
                          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                            Are you sure you want to proceed?
                          </div>
                          <p className="text-stone-400 leading-relaxed text-[11px]">
                            {confirmAction === 'push'
                              ? 'This will overwrite your cloud Gist backup with current local data. Other devices will pull this version next time.'
                              : 'This will completely replace local data on this device with the latest backup in your GitHub Gist. Any unsaved local edits will be replaced.'}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const act = confirmAction;
                                setConfirmAction(null);
                                if (act === 'push') await pushToCloud();
                                else await pullFromCloud();
                              }}
                              className="px-3.5 py-1.5 bg-amber-500 text-stone-950 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-amber-400 active:scale-95 cursor-pointer"
                            >
                              Yes, proceed
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction(null)}
                              className="px-3.5 py-1.5 bg-stone-900 border border-stone-800 text-stone-400 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider hover:text-stone-200 active:scale-95 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ======================================================== */}
                {/* TAB 4: GUIDE & PHILOSOPHY                               */}
                {/* ======================================================== */}
                {activeTab === 'guide' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Guide Sub-tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-stone-950/80 border border-stone-850 rounded-xl overflow-x-auto scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setGuideSubTab('philosophy')}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          guideSubTab === 'philosophy'
                            ? 'bg-amber-500 text-stone-950 shadow-xs'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Philosophy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setGuideSubTab('types')}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          guideSubTab === 'types'
                            ? 'bg-indigo-500 text-white shadow-xs'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Entry Types</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setGuideSubTab('rules')}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          guideSubTab === 'rules'
                            ? 'bg-emerald-500 text-stone-950 shadow-xs'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>4 Golden Rules</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setGuideSubTab('syntax')}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          guideSubTab === 'syntax'
                            ? 'bg-sky-500 text-stone-950 shadow-xs'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Syntax &amp; Tips</span>
                      </button>
                    </div>

                    {/* ── SUB-TAB 1: PHILOSOPHY ────────────────────────────────── */}
                    {guideSubTab === 'philosophy' && (
                      <div className="space-y-4">
                        {/* Core Quote Banner */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30">
                          <p className="font-serif italic text-base md:text-lg text-amber-200 leading-relaxed mb-1">
                            &ldquo;Plan with light brushstrokes; record with honest precision.&rdquo;
                          </p>
                          <span className="text-[11px] font-mono text-amber-400/80 uppercase tracking-widest font-bold">
                            The Core Manifesto of FlowDay
                          </span>
                        </div>

                        {/* The Problem with Traditional Apps */}
                        <div className="space-y-2">
                          <h3 className="text-stone-100 font-serif font-bold text-sm flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>The Trap of Micro-Management</span>
                          </h3>
                          <p className="text-xs text-stone-400 leading-relaxed">
                            Traditional productivity software pushes us into two extremes:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80">
                              <span className="text-xs font-mono font-bold text-rose-400 block mb-1">
                                ❌ Hyper-Prescription
                              </span>
                              <p className="text-[11px] text-stone-400 leading-normal">
                                Specifying every 15-minute slice in rigid detail. The moment reality deviates, schedule guilt and overdue task fatigue collapse your momentum.
                              </p>
                            </div>
                            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80">
                              <span className="text-xs font-mono font-bold text-stone-400 block mb-1">
                                💤 Passive Retro-Logging
                              </span>
                              <p className="text-[11px] text-stone-400 leading-normal">
                                Merely recording history after it unfolds. Without intentional containers, you lose the clarity and focus required for deep output.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Principle of Light Brushstrokes */}
                        <div className="space-y-3 pt-1">
                          <h3 className="text-stone-100 font-serif font-bold text-sm">
                            The Principle of &ldquo;Light Brushstrokes&rdquo;
                          </h3>
                          <p className="text-xs text-stone-300 leading-relaxed">
                            Flow Day bridges this divide through <strong>Directional Intent + Frictionless Reality Capture</strong>:
                          </p>
                          <ul className="space-y-2 text-xs text-stone-400">
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 font-bold mt-0.5">•</span>
                              <span>
                                <strong className="text-stone-200">Time Blocks are intentional arenas</strong>, not rigid prisons. Titles like <code className="text-amber-300 bg-stone-800/80 px-1 py-0.5 rounded">Deep Work: Auth Module</code> establish cognitive boundaries without dictating every breath.
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 font-bold mt-0.5">•</span>
                              <span>
                                <strong className="text-stone-200">Tasks are milestones of intent</strong>, not microscopic manuals. Keeping titles lightweight lowers activation friction and stops perfectionist dread before you start.
                              </span>
                            </li>
                          </ul>

                          {/* Code comparison box */}
                          <div className="p-3 rounded-xl bg-stone-950/90 border border-stone-800 font-mono text-[11px] space-y-2">
                            <div className="text-rose-400 flex items-center gap-2">
                              <span className="font-bold">❌ Over-Prescriptive:</span>
                              <span className="text-stone-400 truncate">&ldquo;Refactor lines 40-120 of auth.ts and write 4 test cases for expired JWTs&rdquo;</span>
                            </div>
                            <div className="text-emerald-400 flex items-center gap-2">
                              <span className="font-bold">✅ Focused Intent:</span>
                              <span className="text-stone-200">&ldquo;Auth token refresh logic&rdquo;</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── SUB-TAB 2: ENTRY TYPES ───────────────────────────────── */}
                    {guideSubTab === 'types' && (
                      <div className="space-y-3">
                        <p className="text-xs text-stone-400 leading-relaxed">
                          Rather than forcing everything into a simple checklist, Flow Day separates your day into distinct cognitive layers:
                        </p>

                        <div className="space-y-2.5">
                          {/* Time Block */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-lg bg-amber-500/15 text-amber-400">
                                  <Clock className="w-3.5 h-3.5" />
                                </span>
                                <span className="font-mono font-bold text-xs text-amber-300 uppercase tracking-wider">
                                  Time Block (Container)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-stone-500">
                                Broad Scheduled Span
                              </span>
                            </div>
                            <p className="text-xs text-stone-300 mb-1.5">
                              Strategic arenas dedicated to deep focus sessions. Creates psychological space for uninterrupted work.
                            </p>
                            <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                              Example: <span className="text-amber-200">&ldquo;Deep Work (2:00 PM – 4:30 PM)&rdquo;</span>
                            </div>
                          </div>

                          {/* Task */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-indigo-500/20 hover:border-indigo-500/40 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-lg bg-indigo-500/15 text-indigo-400">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </span>
                                <span className="font-mono font-bold text-xs text-indigo-300 uppercase tracking-wider">
                                  Task (Milestone)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-stone-500">
                                Milestone of Intent
                              </span>
                            </div>
                            <p className="text-xs text-stone-300 mb-1.5">
                              Clear target you set out to accomplish. Can be scheduled to today or kept flexible in your backlog lists.
                            </p>
                            <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                              Example: <span className="text-indigo-200">&ldquo;Fix cache invalidation bug&rdquo;</span>
                            </div>
                          </div>

                          {/* Log */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400">
                                  <Activity className="w-3.5 h-3.5" />
                                </span>
                                <span className="font-mono font-bold text-xs text-emerald-300 uppercase tracking-wider">
                                  Log (Factual Reality)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-stone-500">
                                Timestamped Record
                              </span>
                            </div>
                            <p className="text-xs text-stone-300 mb-1.5">
                              Factual breadcrumb of what actually unfolded along the way (discoveries, micro-milestones, troubleshooting).
                            </p>
                            <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                              Example: <span className="text-emerald-200">&ldquo;Found memory leak in socket connection pool&rdquo;</span>
                            </div>
                          </div>

                          {/* Note */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-sky-500/20 hover:border-sky-500/40 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-lg bg-sky-500/15 text-sky-400">
                                  <FileText className="w-3.5 h-3.5" />
                                </span>
                                <span className="font-mono font-bold text-xs text-sky-300 uppercase tracking-wider">
                                  Note (Reflection &amp; Idea)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-stone-500">
                                Point-in-Time Synthesis
                              </span>
                            </div>
                            <p className="text-xs text-stone-300 mb-1.5">
                              Quick insights, sudden brainstorms, or retrospective summaries captured right in the flow of your day.
                            </p>
                            <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                              Example: <span className="text-sky-200">&ldquo;Idea: Use Redis hash sets for user sessions&rdquo;</span>
                            </div>
                          </div>

                          {/* Habit Log */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-rose-500/20 hover:border-rose-500/40 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-lg bg-rose-500/15 text-rose-400">
                                  <Flame className="w-3.5 h-3.5" />
                                </span>
                                <span className="font-mono font-bold text-xs text-rose-300 uppercase tracking-wider">
                                  Habit Pulse (Consistency)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-stone-500">
                                Daily Rituals
                              </span>
                            </div>
                            <p className="text-xs text-stone-300 mb-1.5">
                              Daily non-negotiable rituals and health commitments tracked effortlessly with visual streaks and heatmaps.
                            </p>
                            <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                              Example: <span className="text-rose-200">&ldquo;Zone 2 Cardio / Hydration completed&rdquo;</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── SUB-TAB 3: 4 GOLDEN RULES ────────────────────────────── */}
                    {guideSubTab === 'rules' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2.5">
                          {/* Rule 1 */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                I
                              </span>
                              <h4 className="font-serif font-bold text-stone-100 text-xs">
                                Capture Instantly, Schedule Deliberately
                              </h4>
                            </div>
                            <p className="text-xs text-stone-400 leading-relaxed pl-7">
                              Drop thoughts and tasks into the Day or Lists View without forcing an exact hour upfront. Use natural language (<code className="text-amber-300">@today</code>, <code className="text-amber-300">@tomorrow 2pm</code>) when timing is critical; leave them untethered when it is not.
                            </p>
                          </div>

                          {/* Rule 2 */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                II
                              </span>
                              <h4 className="font-serif font-bold text-stone-100 text-xs">
                                Respect the 3-Task Horizon
                              </h4>
                            </div>
                            <p className="text-xs text-stone-400 leading-relaxed pl-7">
                              Do not overwhelm today with 25 open items. Star your top 1–3 focus tasks to create visual priority cards. Protect your working memory from decision fatigue.
                            </p>
                          </div>

                          {/* Rule 3 */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                III
                              </span>
                              <h4 className="font-serif font-bold text-stone-100 text-xs">
                                Let Reality Shape the Timeline
                              </h4>
                            </div>
                            <p className="text-xs text-stone-400 leading-relaxed pl-7">
                              If a session took longer or wrapped up early, Flow Day&apos;s dynamic blocks let you adjust without guilt. Completed tasks automatically anchor to their true completion time, creating an authentic timeline of your output.
                            </p>
                          </div>

                          {/* Rule 4 */}
                          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                IV
                              </span>
                              <h4 className="font-serif font-bold text-stone-100 text-xs">
                                Journal As You Work
                              </h4>
                            </div>
                            <p className="text-xs text-stone-400 leading-relaxed pl-7">
                              Productivity is not just crossing boxes off a list; it is building clarity. Offload granular discoveries and reflections into real-time logs and notes, preserving valuable context for your future self.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── SUB-TAB 4: SYNTAX & TIPS ─────────────────────────────── */}
                    {guideSubTab === 'syntax' && (
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-stone-100 font-serif font-bold text-xs mb-1.5 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-sky-400" />
                            <span>Natural Language Input Bar Magic</span>
                          </h3>
                          <p className="text-xs text-stone-400 mb-2.5">
                            Type naturally in any input bar to parse time, date, duration, and categories:
                          </p>

                          <div className="space-y-1.5 font-mono text-xs">
                            <div className="p-2 rounded-xl bg-stone-950/80 border border-stone-850 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-amber-300">@today</span>
                                <span className="text-stone-500">or</span>
                                <span className="text-amber-300">@tomorrow 2pm</span>
                              </div>
                              <span className="text-stone-400 text-[10px]">Schedule Date &amp; Time</span>
                            </div>

                            <div className="p-2 rounded-xl bg-stone-950/80 border border-stone-850 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">!45m</span>
                                <span className="text-stone-500">or</span>
                                <span className="text-emerald-300">!1h30m</span>
                              </div>
                              <span className="text-stone-400 text-[10px]">Duration Estimate</span>
                            </div>

                            <div className="p-2 rounded-xl bg-stone-950/80 border border-stone-850 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-indigo-300">#work</span>
                                <span className="text-stone-500">or</span>
                                <span className="text-indigo-300">#health</span>
                              </div>
                              <span className="text-stone-400 text-[10px]">Category Assignment</span>
                            </div>

                            <div className="p-2 rounded-xl bg-stone-950/80 border border-stone-850 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Star className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-amber-300">*</span>
                                <span className="text-stone-500">or</span>
                                <span className="text-amber-300">paper</span>
                              </div>
                              <span className="text-stone-400 text-[10px]">Priority Focus Card</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
      </div>
    </>
  );

  return (
    <>
      {externalIsOpen === undefined && (
        <button
          id="settings-btn"
          type="button"
          onClick={handleOpen}
          className="p-2 bg-transparent text-stone-400 hover:text-stone-200 active:scale-95 transition-all h-9 w-9 rounded-xl hover:bg-stone-850 flex items-center justify-center cursor-pointer shrink-0 select-none"
          title="Open Settings (?)"
        >
          <SettingsIcon className="w-4.5 h-4.5 shrink-0" />
        </button>
      )}

      <AnimatePresence>
        {isOpen &&
          (isMobile ? (
            /* MOBILE FULL-SCREEN MODAL (Matching Scratchpad & Highlights) */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 bg-[#141414] flex flex-col font-sans overflow-hidden"
              style={{
                paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))',
                paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))',
              }}
            >
              {renderModalContent()}
            </motion.div>
          ) : (
            /* DESKTOP CENTERED MODAL */
            <div
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
              onClick={handleClose}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-stone-900 border border-stone-800 shadow-2xl relative flex flex-col overflow-hidden w-full max-w-2xl max-h-[85vh] rounded-2xl"
              >
                {renderModalContent()}
              </motion.div>
            </div>
          ))}
      </AnimatePresence>
    </>
  );
}
