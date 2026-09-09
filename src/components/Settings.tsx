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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGistSync } from '../hooks/useGistSync';
import { useTheme } from '../lib/theme';

export type SettingsTab = 'preferences' | 'sync' | 'shortcuts';

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

  // Listen to custom event for opening settings to specific tab
  useEffect(() => {
    const handleOpenSettingsEvent = (e: CustomEvent<{ tab?: SettingsTab }>) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
      setInternalIsOpen(true);
    };
    window.addEventListener('flowday-open-settings' as any, handleOpenSettingsEvent);
    return () => {
      window.removeEventListener('flowday-open-settings' as any, handleOpenSettingsEvent);
    };
  }, []);

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

  return (
    <>
      {externalIsOpen === undefined && (
        <button
          id="settings-btn"
          type="button"
          onClick={handleOpen}
          className="p-2 bg-transparent text-stone-400 hover:text-stone-200 active:scale-95 transition-all h-9 w-9 rounded-xl hover:bg-stone-850 flex items-center justify-center cursor-pointer shrink-0 select-none"
          title="Open Settings"
        >
          <SettingsIcon className="w-4.5 h-4.5 shrink-0" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <div
            className={`fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex font-sans ${
              isMobile ? 'items-end justify-center' : 'items-center justify-center p-4'
            }`}
            onClick={handleClose}
          >
            <motion.div
              initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
              exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-stone-900 border border-stone-800 shadow-2xl relative flex flex-col overflow-hidden w-full ${
                isMobile
                  ? 'max-h-[88vh] rounded-t-3xl border-b-0 pb-6'
                  : 'max-w-xl max-h-[85vh] rounded-2xl'
              }`}
              style={
                isMobile
                  ? { paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }
                  : undefined
              }
            >
              {/* Mobile Grab Handle */}
              {isMobile && (
                <div className="w-10 h-1 bg-stone-750 rounded-full self-center mt-3 shrink-0" />
              )}

              {/* Modal Header & Segmented Tabs */}
              <div className="flex flex-col border-b border-stone-800 shrink-0 bg-stone-900/90 backdrop-blur-sm pt-3 px-4 md:px-6">
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-500">
                      FlowDay
                    </span>
                    <span className="text-xs text-stone-500 font-mono">/</span>
                    <h2 className="text-stone-100 font-serif font-bold text-base">
                      Settings
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
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
                    {isConfigured && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
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
                </div>
              </div>

              {/* Tab Content Area */}
              <div className="overflow-y-auto flex-1 p-4 md:p-6 space-y-5">
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
                {/* TAB 3: SHORTCUTS & ABOUT                                */}
                {/* ======================================================== */}
                {activeTab === 'shortcuts' && (
                  <div className="space-y-4">
                    {/* Shortcuts Reference Table */}
                    <div className="p-4 bg-stone-950/60 border border-stone-850 rounded-2xl space-y-3">
                      <h4 className="text-stone-200 font-serif font-bold text-xs">
                        Keyboard Shortcuts
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/60 border border-stone-850/60">
                          <span className="text-stone-400">Quick Task Input</span>
                          <kbd className="px-2 py-0.5 bg-stone-950 border border-stone-800 rounded-md text-stone-300 text-[10px] font-bold">
                            Enter
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/60 border border-stone-850/60">
                          <span className="text-stone-400">Multi-select Tasks</span>
                          <kbd className="px-2 py-0.5 bg-stone-950 border border-stone-800 rounded-md text-stone-300 text-[10px] font-bold">
                            Ctrl / Cmd + Click
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/60 border border-stone-850/60">
                          <span className="text-stone-400">Range Select</span>
                          <kbd className="px-2 py-0.5 bg-stone-950 border border-stone-800 rounded-md text-stone-300 text-[10px] font-bold">
                            Shift + Click
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/60 border border-stone-850/60">
                          <span className="text-stone-400">Markdown Save</span>
                          <kbd className="px-2 py-0.5 bg-stone-950 border border-stone-800 rounded-md text-stone-300 text-[10px] font-bold">
                            Ctrl + Enter
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/60 border border-stone-850/60">
                          <span className="text-stone-400">Mindmap Child Node</span>
                          <kbd className="px-2 py-0.5 bg-stone-950 border border-stone-800 rounded-md text-stone-300 text-[10px] font-bold">
                            Tab
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/60 border border-stone-850/60">
                          <span className="text-stone-400">Mindmap Sibling Node</span>
                          <kbd className="px-2 py-0.5 bg-stone-950 border border-stone-800 rounded-md text-stone-300 text-[10px] font-bold">
                            Enter
                          </kbd>
                        </div>
                      </div>
                    </div>

                    {/* About & Philosophy */}
                    <div className="p-4 bg-stone-950/60 border border-stone-850 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-stone-200 font-serif font-bold text-xs">
                        <ShieldCheck className="w-4 h-4 text-amber-500" />
                        <span>Offline-First Privacy Architecture</span>
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 leading-relaxed">
                        FlowDay stores 100% of your tasks, habits, and timeline locally in your browser's IndexedDB. When Gist sync is configured, your backups are securely compressed and stored directly on your personal GitHub account.
                      </p>
                      <div className="pt-2 border-t border-stone-850/80 flex items-center justify-between text-[10px] font-mono text-stone-500">
                        <span>FlowDay v2.0</span>
                        <span>Plan with light brushstrokes; record with honest precision.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
