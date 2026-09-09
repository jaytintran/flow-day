/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGistSync } from '../hooks/useGistSync';

interface QuickSyncSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullSettings: () => void;
}

export default function QuickSyncSheet({
  isOpen,
  onClose,
  onOpenFullSettings,
}: QuickSyncSheetProps) {
  const {
    isConfigured,
    lastSync,
    status,
    statusMsg,
    isDirty,
    pushToCloud,
    pullFromCloud,
  } = useGistSync();

  const [confirmPull, setConfirmPull] = useState(false);

  const handlePush = async () => {
    setConfirmPull(false);
    await pushToCloud();
  };

  const handlePull = async () => {
    if (!confirmPull) {
      setConfirmPull(true);
      return;
    }
    setConfirmPull(false);
    await pullFromCloud();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center font-sans"
          onClick={() => {
            setConfirmPull(false);
            onClose();
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-stone-900 border-t border-stone-800 rounded-t-3xl p-5 pb-8 shadow-2xl flex flex-col gap-4 relative max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
          >
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-stone-700 rounded-full self-center mb-1 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    status === 'loading'
                      ? 'bg-amber-400 animate-spin'
                      : !isConfigured
                        ? 'bg-stone-600'
                        : isDirty
                          ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                          : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  }`}
                />
                <h3 className="text-stone-100 font-serif font-bold text-base tracking-tight">
                  Cloud Sync
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFullSettings();
                  }}
                  className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                  title="Full Sync Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmPull(false);
                    onClose();
                  }}
                  className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Feedback / Sync Details */}
            <div className="p-3 bg-stone-950/70 border border-stone-850 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400 font-mono">Sync Status:</span>
                <span className="font-mono font-semibold">
                  {!isConfigured ? (
                    <span className="text-stone-500">Not configured</span>
                  ) : isDirty ? (
                    <span className="text-amber-400">Unpushed local changes</span>
                  ) : (
                    <span className="text-emerald-400">All changes synced</span>
                  )}
                </span>
              </div>

              {lastSync && (
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono border-t border-stone-900 pt-1.5 mt-0.5">
                  <span>Last Cloud Backup:</span>
                  <span className="text-stone-400">{lastSync}</span>
                </div>
              )}
            </div>

            {/* In-Flight Status Feedback Banner */}
            {status !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-mono leading-relaxed ${
                  status === 'loading'
                    ? 'bg-stone-900/80 border-stone-800 text-stone-300'
                    : status === 'success'
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-950/30 border-red-500/30 text-red-400'
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

            {!isConfigured ? (
              <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-stone-800 rounded-2xl bg-stone-950/40 gap-3">
                <ShieldCheck className="w-8 h-8 text-stone-500" />
                <div className="flex flex-col gap-1">
                  <span className="text-stone-200 text-sm font-semibold">
                    GitHub Gist Not Configured
                  </span>
                  <span className="text-xs text-stone-500 max-w-xs">
                    Set up your GitHub Personal Access Token to enable seamless cloud backup and multi-device sync.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFullSettings();
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm mt-1"
                >
                  Configure Gist Sync
                </button>
              </div>
            ) : (
              /* Sync Push & Pull Action Buttons */
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={status === 'loading'}
                  className={`w-full p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDirty
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
                      : 'bg-stone-950/80 border-stone-800 text-stone-200 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isDirty
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-stone-900 text-stone-400'
                      }`}
                    >
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-mono font-bold tracking-wide text-stone-100">
                        Push to Cloud
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono">
                        Backup current local data to GitHub
                      </span>
                    </div>
                  </div>
                  {isDirty && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Unpushed
                    </span>
                  )}
                </button>

                {confirmPull ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3.5 bg-amber-950/25 border border-amber-500/30 rounded-2xl flex flex-col gap-3 font-mono"
                  >
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Overwrite Local Data?</span>
                    </div>
                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      Pulling will replace all local tasks, logs, and habits with the version from GitHub Gist.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePull}
                        disabled={status === 'loading'}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Yes, Overwrite &amp; Pull
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPull(false)}
                        className="px-4 py-2 bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-300 text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    type="button"
                    onClick={handlePull}
                    disabled={status === 'loading'}
                    className="w-full p-3.5 rounded-2xl bg-stone-950/80 border border-stone-800 hover:border-stone-700 text-stone-200 transition-all cursor-pointer flex items-center justify-between active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-stone-900 text-stone-400">
                        <DownloadCloud className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-mono font-bold tracking-wide text-stone-100">
                          Pull from Cloud
                        </span>
                        <span className="text-[11px] text-stone-500 font-mono">
                          Restore latest data to this device
                        </span>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
