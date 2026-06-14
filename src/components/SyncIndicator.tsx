/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, CloudOff, Cloud } from 'lucide-react';
import { subscribeSyncState, SyncState, syncNow } from '../syncEngine';

export default function SyncIndicator() {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'unconfigured',
    lastSyncTime: null,
    error: null,
  });

  useEffect(() => {
    return subscribeSyncState((state) => {
      setSyncState(state);
    });
  }, []);

  if (syncState.status === 'unconfigured') {
    return null;
  }

  const getStatusContent = () => {
    switch (syncState.status) {
      case 'syncing':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-stone-400 animate-spin" />,
          text: 'Syncing...',
          color: 'text-stone-400',
          title: 'Synchronizing with GitHub Gist',
        };
      case 'synced':
        return {
          icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
          text: 'Synced',
          color: 'text-emerald-500/80',
          title: syncState.lastSyncTime
            ? `Synced: ${new Date(syncState.lastSyncTime).toLocaleTimeString()}`
            : 'Synced',
        };
      case 'pending':
        return {
          icon: <CloudOff className="w-3.5 h-3.5 text-amber-500" />,
          text: 'Pending',
          color: 'text-amber-500/80',
          title: 'Offline or waiting to sync changes',
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
          text: 'Sync Error',
          color: 'text-red-500/80',
          title: syncState.error || 'Click to retry sync',
        };
      case 'idle':
      default:
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-stone-500" />,
          text: 'Idle',
          color: 'text-stone-500',
          title: 'Sync configured and idle',
        };
    }
  };

  const content = getStatusContent();

  return (
    <button
      onClick={() => syncNow()}
      disabled={syncState.status === 'syncing'}
      title={content.title}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border border-stone-850 bg-stone-900/40 hover:bg-stone-850/80 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 select-none ${content.color}`}
    >
      {content.icon}
      <span className="hidden sm:inline">{content.text}</span>
    </button>
  );
}
