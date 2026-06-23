/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGistSync } from '../hooks/useGistSync';

export default function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPat, setShowPat] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'push' | 'pull' | null>(null);

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

  // Reload credentials whenever the modal opens
  const handleOpen = () => {
    reload();
    setIsOpen(true);
  };

  return (
    <>
      <button
        id="settings-btn"
        type="button"
        onClick={handleOpen}
        className="px-2 bg-transparent text-stone-400 hover:text-stone-200 active:scale-95 transition-all h-[46px] flex items-center justify-center cursor-pointer shrink-0 select-none"
        title="Open Settings"
      >
        <SettingsIcon className="w-5.5 h-5.5 shrink-0" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999] p-4 font-sans"
            onClick={() => {
              setIsOpen(false);
              setShowHelp(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121212] border border-stone-850 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-850 p-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border border-stone-800 text-stone-400">
                    Settings
                  </span>
                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-mono font-bold uppercase tracking-wider ${
                      showHelp
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                        : 'text-stone-500 hover:text-stone-300 hover:bg-stone-850 border border-transparent'
                    }`}
                    title="How to Setup Sync"
                  >
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Guide</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowHelp(false);
                  }}
                  className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Content Area */}
              <div className="overflow-y-auto flex-1 p-5 md:p-6 space-y-6">
                {/* HELP GUIDE / TOOLTIP DRAWER */}
                <AnimatePresence>
                  {showHelp && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border border-amber-500/20 bg-amber-950/10 rounded-xl p-4 text-xs space-y-2.5 text-stone-300 font-mono leading-relaxed"
                    >
                      <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                        <Info className="w-4 h-4 text-amber-400" />
                        Setup Sync Instructions
                      </div>
                      <ol className="list-decimal pl-4 space-y-1.5 text-stone-400">
                        <li>
                          Visit{' '}
                          <a
                            href="https://github.com/settings/tokens"
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-500 hover:underline"
                          >
                            GitHub Personal Access Tokens
                          </a>
                          .
                        </li>
                        <li>
                          Generate a token (Classic) with the{' '}
                          <strong className="text-stone-300">gist</strong> scope checked.
                        </li>
                        <li>Copy and paste your generated PAT below.</li>
                        <li>
                          Click <strong className="text-stone-300">Auto-Create Gist</strong> to
                          initialize a new private Gist for FlowDay.
                        </li>
                        <li>
                          Once your Gist is created, click{' '}
                          <strong className="text-stone-300">Push to Cloud</strong> to save your
                          current local database.
                        </li>
                        <li>
                          On your other device (mobile/web), enter the same PAT &amp; Gist ID, and click{' '}
                          <strong className="text-stone-300">Pull from Cloud</strong> to load your
                          data.
                        </li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* PREFERENCES SECTION */}
                <div className="space-y-4 border-b border-stone-850 pb-6">
                  <h3 className="text-stone-200 font-serif font-bold text-sm">
                    Preferences
                  </h3>
                  <div className="flex items-center justify-between p-3.5 bg-stone-900/40 border border-stone-850 rounded-xl">
                    <div className="flex flex-col gap-1 pr-4">
                      <span className="text-xs text-stone-200 font-semibold font-sans">Show Entry Details</span>
                      <span className="text-[10px] font-mono text-stone-500">Show content details under task, note, and event titles on the timeline.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showTimelineContent}
                        onChange={(e) => handleToggleTimelineContent(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-stone-800 rounded-full peer peer-focus:outline-none peer-checked:bg-amber-500/80 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-500 peer-checked:after:bg-stone-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-stone-900/40 border border-stone-850 rounded-xl">
                    <div className="flex flex-col gap-1 pr-4">
                      <span className="text-xs text-stone-200 font-semibold font-sans">When Do You Sleep?</span>
                      <span className="text-[10px] font-mono text-stone-500">Specify your bedtime to display countdown on the timeline.</span>
                    </div>
                    <input
                      type="time"
                      value={sleepTime}
                      onChange={(e) => handleSaveSleepTime(e.target.value)}
                      className="bg-[#0a0a0a] border border-stone-850 hover:border-stone-800 focus:border-amber-500/35 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:bg-stone-950 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* SYNC SECTION */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-stone-200 font-serif font-bold text-sm">
                      GitHub Gist Synchronization
                    </h3>
                    {lastSync && (
                      <span className="text-[9px] font-mono text-stone-500 tracking-wider">
                        Last synced: {lastSync}
                      </span>
                    )}
                  </div>

                  {/* Inputs */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 block">
                        GitHub Personal Access Token (PAT)
                      </label>
                      <div className="relative">
                        <input
                          type={showPat ? 'text' : 'password'}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          value={pat}
                          onChange={(e) => setPat(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-stone-850 hover:border-stone-800 focus:border-amber-500/35 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-700 font-mono focus:outline-none focus:bg-stone-950 transition-all pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPat(!showPat)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                        >
                          {showPat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 block">
                        Gist ID
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. 8a6b2c4d..."
                          value={gistId}
                          onChange={(e) => setGistId(e.target.value)}
                          className="flex-1 bg-[#0a0a0a] border border-stone-850 hover:border-stone-800 focus:border-amber-500/35 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-700 font-mono focus:outline-none focus:bg-stone-950 transition-all"
                        />
                        {!gistId.trim() && pat.trim() && (
                          <button
                            type="button"
                            onClick={handleAutoCreateGist}
                            className="px-3 bg-stone-900 border border-stone-800 hover:border-stone-700 hover:bg-stone-850 text-stone-350 hover:text-amber-500 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
                          >
                            Auto-Create
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Feedback banner */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveCredentials}
                      className="px-4 py-2.5 bg-stone-900 border border-stone-800 hover:border-stone-700 hover:bg-stone-850 text-stone-300 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                    >
                      Save Credentials
                    </button>
                    <button
                      type="button"
                      onClick={testConnection}
                      className="px-4 py-2.5 bg-stone-900 border border-stone-800 hover:border-stone-700 hover:bg-stone-850 text-stone-300 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                    >
                      Test Connection
                    </button>
                  </div>

                  {/* Dynamic Status Bar */}
                  {status !== 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-mono leading-relaxed ${
                        status === 'loading'
                          ? 'bg-stone-900/60 border-stone-800 text-stone-400'
                          : status === 'success'
                            ? 'bg-emerald-950/15 border-emerald-500/25 text-emerald-400'
                            : 'bg-red-950/15 border-red-500/25 text-red-400'
                      }`}
                    >
                      {status === 'loading' && (
                        <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-stone-400" />
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

                  {/* Sync Push/Pull Panel */}
                  {isConfigured && (
                    <div className="border-t border-stone-850 pt-4 mt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setConfirmAction('push')}
                          className="flex flex-col items-center justify-center p-3.5 bg-stone-900 border border-stone-800/80 hover:border-amber-500/25 hover:bg-stone-900/60 rounded-xl transition-all cursor-pointer group active:scale-[0.98]"
                        >
                          <UploadCloud className="w-5 h-5 text-stone-500 group-hover:text-amber-500 transition-colors mb-1.5" />
                          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-300">
                            Push to Cloud
                          </span>
                          <span className="text-[8px] font-mono text-stone-600 group-hover:text-stone-500 transition-colors mt-0.5">
                            Backup local data
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmAction('pull')}
                          className="flex flex-col items-center justify-center p-3.5 bg-stone-900 border border-stone-800/80 hover:border-amber-500/25 hover:bg-stone-900/60 rounded-xl transition-all cursor-pointer group active:scale-[0.98]"
                        >
                          <DownloadCloud className="w-5 h-5 text-stone-500 group-hover:text-amber-500 transition-colors mb-1.5" />
                          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-300">
                            Pull from Cloud
                          </span>
                          <span className="text-[8px] font-mono text-stone-600 group-hover:text-stone-500 transition-colors mt-0.5">
                            Restore to this device
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Confirmations */}
                  <AnimatePresence>
                    {confirmAction && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-amber-950/15 border border-amber-500/20 rounded-xl p-4 text-xs font-mono space-y-3"
                      >
                        <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-wider text-[10px]">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                          Are you sure?
                        </div>
                        <p className="text-stone-400 leading-relaxed">
                          {confirmAction === 'push'
                            ? 'This will OVERWRITE the cloud backup with your current local data. Your other devices will pull this version next time.'
                            : 'This will OVERWRITE all local data on this device with the version stored in the cloud. Your unsaved local edits will be lost.'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={confirmAction === 'push' ? pushToCloud : pullFromCloud}
                            className="px-3.5 py-1.5 bg-amber-500 text-stone-950 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider hover:bg-amber-400 active:scale-95 cursor-pointer"
                          >
                            Yes, proceed
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction(null)}
                            className="px-3.5 py-1.5 bg-stone-900 border border-stone-800 text-stone-400 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider hover:text-stone-250 active:scale-95 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
