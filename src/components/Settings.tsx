/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Check,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';

const STORAGE_KEYS = {
  PAT: 'flow_day_github_pat',
  GIST_ID: 'flow_day_gist_id',
  LAST_SYNC: 'flow_day_last_sync',
};

export default function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [pat, setPat] = useState('');
  const [gistId, setGistId] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Status management
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<'push' | 'pull' | null>(null);

  // Load credentials on mount
  useEffect(() => {
    setPat(localStorage.getItem(STORAGE_KEYS.PAT) || '');
    setGistId(localStorage.getItem(STORAGE_KEYS.GIST_ID) || '');
    setLastSync(localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || null);
  }, [isOpen]);

  const handleSaveCredentials = () => {
    localStorage.setItem(STORAGE_KEYS.PAT, pat.trim());
    localStorage.setItem(STORAGE_KEYS.GIST_ID, gistId.trim());
    showToast('Credentials saved!', 'success');
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'loading' | 'idle' = 'success') => {
    setStatus(type);
    setStatusMsg(msg);
    if (type !== 'loading') {
      setTimeout(() => {
        setStatus('idle');
        setStatusMsg('');
      }, 4000);
    }
  };

  // Helper to fetch Gist or perform operations
  const fetchGist = async (token: string, id: string) => {
    const res = await fetch(`https://api.github.com/gists/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Gist (${res.status})`);
    }
    return await res.json();
  };

  const testConnection = async () => {
    if (!pat.trim() || !gistId.trim()) {
      showToast('Please enter both PAT and Gist ID', 'error');
      return;
    }
    showToast('Testing connection...', 'loading');
    try {
      await fetchGist(pat.trim(), gistId.trim());
      showToast('Connection successful!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to connect to Gist', 'error');
    }
  };

  const handleAutoCreateGist = async () => {
    if (!pat.trim()) {
      showToast('Personal Access Token (PAT) is required first', 'error');
      return;
    }
    showToast('Creating Gist...', 'loading');

    try {
      // Export current data as initial content
      const payload = await exportDatabase();
      const body = {
        description: 'FlowDay Sync Data (Private)',
        public: false,
        files: {
          'flow-day-backup.json': {
            content: JSON.stringify(payload, null, 2),
          },
        },
      };

      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pat.trim()}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Failed to create gist (${res.status})`);
      }

      const gist = await res.json();
      setGistId(gist.id);
      localStorage.setItem(STORAGE_KEYS.PAT, pat.trim());
      localStorage.setItem(STORAGE_KEYS.GIST_ID, gist.id);
      showToast('Private Gist created and saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to auto-create Gist', 'error');
    }
  };

  const exportDatabase = async () => {
    const entries = await db.entries.toArray();
    const habits = await db.habits.toArray();
    const categories = await db.categories.toArray();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
      habits,
      categories,
    };
  };

  const pushToCloud = async () => {
    if (!pat.trim() || !gistId.trim()) {
      showToast('PAT and Gist ID are required to sync', 'error');
      return;
    }
    setConfirmAction(null);
    showToast('Uploading to cloud...', 'loading');

    try {
      const payload = await exportDatabase();
      const body = {
        files: {
          'flow-day-backup.json': {
            content: JSON.stringify(payload, null, 2),
          },
        },
      };

      const res = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${pat.trim()}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }

      const nowStr = new Date().toLocaleString();
      setLastSync(nowStr);
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, nowStr);
      showToast('Successfully backed up to cloud!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Sync upload failed', 'error');
    }
  };

  const pullFromCloud = async () => {
    if (!pat.trim() || !gistId.trim()) {
      showToast('PAT and Gist ID are required to sync', 'error');
      return;
    }
    setConfirmAction(null);
    showToast('Downloading from cloud...', 'loading');

    try {
      const gist = await fetchGist(pat.trim(), gistId.trim());
      const file = gist.files['flow-day-backup.json'];
      if (!file) {
        throw new Error('FlowDay backup file not found inside Gist');
      }

      const backupData = JSON.parse(file.content);
      await importDatabase(backupData);

      const nowStr = new Date().toLocaleString();
      setLastSync(nowStr);
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, nowStr);
      showToast('Successfully restored from cloud!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Sync restore failed', 'error');
    }
  };

  const importDatabase = async (data: any) => {
    if (
      !data ||
      !Array.isArray(data.entries) ||
      !Array.isArray(data.habits) ||
      !Array.isArray(data.categories)
    ) {
      throw new Error('Invalid Gist backup payload');
    }

    const parseEntryDates = (e: any) => {
      if (e.created_at) e.created_at = new Date(e.created_at);
      if (e.carried_to) e.carried_to = new Date(e.carried_to);
      if (e.scheduled_at) e.scheduled_at = new Date(e.scheduled_at);
      if (e.timestamp) e.timestamp = new Date(e.timestamp);
      if (e.start_at) e.start_at = new Date(e.start_at);
      if (e.end_at) e.end_at = new Date(e.end_at);
      if (e.completed_at) e.completed_at = new Date(e.completed_at);
      return e;
    };

    const parseHabitDates = (h: any) => {
      if (h.created_at) h.created_at = new Date(h.created_at);
      return h;
    };

    const parseCategoryDates = (c: any) => {
      if (c.created_at) c.created_at = new Date(c.created_at);
      return c;
    };

    const parsedEntries = data.entries.map(parseEntryDates);
    const parsedHabits = data.habits.map(parseHabitDates);
    const parsedCategories = data.categories.map(parseCategoryDates);

    await db.transaction('rw', [db.entries, db.habits, db.categories], async () => {
      await db.entries.clear();
      await db.habits.clear();
      await db.categories.clear();

      if (parsedEntries.length > 0) await db.entries.bulkAdd(parsedEntries);
      if (parsedHabits.length > 0) await db.habits.bulkAdd(parsedHabits);
      if (parsedCategories.length > 0) await db.categories.bulkAdd(parsedCategories);
    });
  };

  return (
    <>
      <button
        id="settings-btn"
        type="button"
        onClick={() => setIsOpen(true)}
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
                          On your other device (mobile/web), enter the same PAT & Gist ID, and click{' '}
                          <strong className="text-stone-300">Pull from Cloud</strong> to load your
                          data.
                        </li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                  {pat.trim() && gistId.trim() && (
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
