/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sync Engine — Automatic GitHub Gist synchronization with record-level merging.
 *
 * This module handles:
 * - Pulling remote data from a GitHub Gist
 * - Record-level merging using `updated_at` timestamps
 * - Delete detection via `lastSyncTime` (no soft-delete needed)
 * - Auto-sync triggers (visibility change, online event, debounced writes)
 * - Offline resilience (fail silently, retry on reconnect)
 */

import Dexie from 'dexie';
import { db } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'error' | 'unconfigured';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: string | null; // ISO timestamp of last successful sync
  error: string | null;
}

interface SyncPayload {
  version: number;
  exportedAt: string;
  entries: any[];
  habits: any[];
  categories: any[];
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  PAT: 'flow_day_github_pat',
  GIST_ID: 'flow_day_gist_id',
  LAST_SYNC_TIME: 'flow_day_last_sync_time', // ISO timestamp used for merge logic
  LAST_SYNC: 'flow_day_last_sync', // display-friendly string (kept for Settings UI compat)
  AUTO_SYNC: 'flow_day_auto_sync',
};

// ---------------------------------------------------------------------------
// State & listeners
// ---------------------------------------------------------------------------

let currentState: SyncState = {
  status: 'unconfigured',
  lastSyncTime: null,
  error: null,
};

type SyncListener = (state: SyncState) => void;
const listeners: Set<SyncListener> = new Set();

function setState(partial: Partial<SyncState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach((fn) => fn(currentState));
}

export function getSyncState(): SyncState {
  return currentState;
}

export function subscribeSyncState(fn: SyncListener): () => void {
  listeners.add(fn);
  fn(currentState); // immediately emit current state
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Credentials helpers
// ---------------------------------------------------------------------------

function getCredentials(): { pat: string; gistId: string } | null {
  const pat = localStorage.getItem(STORAGE_KEYS.PAT)?.trim();
  const gistId = localStorage.getItem(STORAGE_KEYS.GIST_ID)?.trim();
  if (!pat || !gistId) return null;
  return { pat, gistId };
}

export function isAutoSyncEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEYS.AUTO_SYNC) !== 'false'; // default ON
}

export function setAutoSync(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, String(enabled));
  if (enabled) {
    initSync(); // re-initialize triggers
  }
}

// ---------------------------------------------------------------------------
// Gist API helpers
// ---------------------------------------------------------------------------

const GIST_FILENAME = 'flow-day-backup.json';

async function fetchGistData(
  pat: string,
  gistId: string,
): Promise<SyncPayload | null> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`Gist fetch failed (${res.status})`);
  const gist = await res.json();
  const file = gist.files[GIST_FILENAME];
  if (!file) return null;
  return JSON.parse(file.content) as SyncPayload;
}

async function pushGistData(
  pat: string,
  gistId: string,
  payload: SyncPayload,
): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(payload, null, 2),
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gist push failed (${res.status})`);
}

// ---------------------------------------------------------------------------
// Local DB helpers
// ---------------------------------------------------------------------------

async function getLocalData(): Promise<SyncPayload> {
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
}

/**
 * Parse date strings back into Date objects for Dexie compatibility.
 */
function parseDates(record: any): any {
  const dateFields = [
    'created_at',
    'updated_at',
    'carried_to',
    'scheduled_at',
    'timestamp',
    'start_at',
    'end_at',
    'completed_at',
    'achieved_at',
  ];
  const result = { ...record };
  for (const field of dateFields) {
    if (result[field]) result[field] = new Date(result[field]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Merge algorithm
// ---------------------------------------------------------------------------

/**
 * Merge two arrays of records using `updated_at` timestamps and `lastSyncTime`
 * for delete detection.
 *
 * Rules:
 * - Both exist  → keep whichever has newer `updated_at`
 * - Only local  → if `updated_at > lastSyncTime` → new local (keep)
 *                  if `updated_at <= lastSyncTime` → deleted on remote (discard)
 * - Only remote → if `updated_at > lastSyncTime` → new from remote (keep)
 *                  if `updated_at <= lastSyncTime` → deleted locally (discard)
 *
 * On first sync (no lastSyncTime), all records from both sides are kept.
 */
function mergeRecords(
  localRecords: any[],
  remoteRecords: any[],
  lastSyncTime: Date | null,
): { merged: any[]; hasChanges: boolean } {
  const localMap = new Map<string, any>();
  for (const r of localRecords) localMap.set(r.id, r);

  const remoteMap = new Map<string, any>();
  for (const r of remoteRecords) remoteMap.set(r.id, r);

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const merged: any[] = [];
  let hasChanges = false;

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (local && remote) {
      // Both exist — keep the one with newer updated_at
      const localTime = new Date(local.updated_at).getTime();
      const remoteTime = new Date(remote.updated_at).getTime();
      if (remoteTime > localTime) {
        merged.push(parseDates(remote));
        hasChanges = true;
      } else {
        merged.push(local);
        if (localTime > remoteTime) hasChanges = true; // local is newer → need to push
      }
    } else if (local && !remote) {
      // Only local
      if (!lastSyncTime || new Date(local.updated_at).getTime() > lastSyncTime.getTime()) {
        // New local record OR modified after last sync → keep
        merged.push(local);
        hasChanges = true; // need to push this to remote
      }
      // else: existed at last sync but not in remote → deleted on remote → discard
      else {
        hasChanges = true; // local needs to remove this
      }
    } else if (!local && remote) {
      // Only remote
      if (!lastSyncTime || new Date(remote.updated_at).getTime() > lastSyncTime.getTime()) {
        // New remote record OR modified after last sync → add locally
        merged.push(parseDates(remote));
        hasChanges = true;
      }
      // else: existed at last sync but not locally → deleted locally → discard
      else {
        hasChanges = true; // remote needs to remove this
      }
    }
  }

  return { merged, hasChanges };
}

// ---------------------------------------------------------------------------
// Core sync function
// ---------------------------------------------------------------------------

let isSyncing = false;

export async function syncNow(): Promise<void> {
  // Guard: don't run if already syncing, offline, or unconfigured
  if (isSyncing) return;
  const creds = getCredentials();
  if (!creds) {
    setState({ status: 'unconfigured', error: null });
    return;
  }
  if (!navigator.onLine) {
    setState({ status: 'pending', error: null });
    return;
  }

  isSyncing = true;
  setState({ status: 'syncing', error: null });

  try {
    // 1. Get local data
    const localData = await getLocalData();

    // 2. Get remote data
    const remoteData = await fetchGistData(creds.pat, creds.gistId);

    // 3. Get last sync time
    const lastSyncStr = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
    const lastSyncTime = lastSyncStr ? new Date(lastSyncStr) : null;

    if (!remoteData) {
      // No remote data — just push everything (first sync or empty Gist)
      const payload: SyncPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        entries: localData.entries,
        habits: localData.habits,
        categories: localData.categories,
      };
      await pushGistData(creds.pat, creds.gistId, payload);
    } else {
      // 4. Merge each table
      const entriesResult = mergeRecords(localData.entries, remoteData.entries || [], lastSyncTime);
      const habitsResult = mergeRecords(localData.habits, remoteData.habits || [], lastSyncTime);
      const categoriesResult = mergeRecords(
        localData.categories,
        remoteData.categories || [],
        lastSyncTime,
      );

      const somethingChanged =
        entriesResult.hasChanges || habitsResult.hasChanges || categoriesResult.hasChanges;

      if (somethingChanged) {
        // 5. Write merged result to local DB
        await db.transaction('rw', [db.entries, db.habits, db.categories], async () => {
          // Clear tables but prevent triggers from triggering sync engine recursion
          // Dexie transactions let us set transactional options/keys
          (Dexie.currentTransaction as any)._isSyncEngineImport = true;
          
          await db.entries.clear();
          await db.habits.clear();
          await db.categories.clear();

          if (entriesResult.merged.length > 0) {
            // Add custom flag to prevent hook modification
            const items = entriesResult.merged.map(item => ({ ...item, __skipUpdatedAt: true }));
            await db.entries.bulkAdd(items);
          }
          if (habitsResult.merged.length > 0) {
            const items = habitsResult.merged.map(item => ({ ...item, __skipUpdatedAt: true }));
            await db.habits.bulkAdd(items);
          }
          if (categoriesResult.merged.length > 0) {
            const items = categoriesResult.merged.map(item => ({ ...item, __skipUpdatedAt: true }));
            await db.categories.bulkAdd(items);
          }
        });

        // 6. Push merged result to Gist
        const mergedPayload: SyncPayload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          entries: entriesResult.merged,
          habits: habitsResult.merged,
          categories: categoriesResult.merged,
        };
        await pushGistData(creds.pat, creds.gistId, mergedPayload);
      }
    }

    // 7. Update sync timestamps
    const now = new Date();
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now.toISOString());
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, now.toLocaleString());
    setState({ status: 'synced', lastSyncTime: now.toISOString(), error: null });
  } catch (err: any) {
    console.error('[SyncEngine] Sync failed:', err);
    setState({
      status: 'error',
      error: err.message || 'Sync failed',
    });
  } finally {
    isSyncing = false;
  }
}

// ---------------------------------------------------------------------------
// Debounced sync (called after local DB writes)
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function notifyLocalChange(): void {
  if (!isAutoSyncEnabled()) return;
  const creds = getCredentials();
  if (!creds) return;

  // Mark as pending immediately
  if (currentState.status === 'synced' || currentState.status === 'idle') {
    setState({ status: 'pending' });
  }

  // Debounce: wait 3 seconds of inactivity before syncing
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncNow();
  }, 3000);
}

// ---------------------------------------------------------------------------
// Auto-sync initialization (event listeners)
// ---------------------------------------------------------------------------

let initialized = false;

export function initSync(): void {
  // Check credentials on init
  const creds = getCredentials();
  if (!creds) {
    setState({ status: 'unconfigured', error: null });
  } else {
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
    setState({
      status: lastSync ? 'synced' : 'idle',
      lastSyncTime: lastSync,
      error: null,
    });
  }

  if (initialized) return;
  initialized = true;

  // Auto-pull on app foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isAutoSyncEnabled()) {
      syncNow();
    }
  });

  // Auto-sync when coming back online
  window.addEventListener('online', () => {
    if (isAutoSyncEnabled() && currentState.status === 'pending') {
      syncNow();
    }
  });

  // Mark as pending when going offline (if there were changes)
  window.addEventListener('offline', () => {
    if (currentState.status === 'syncing') {
      setState({ status: 'pending' });
    }
  });

  // Initial sync on startup (if configured and online)
  if (creds && isAutoSyncEnabled() && navigator.onLine) {
    // Small delay to not block app startup
    setTimeout(() => syncNow(), 1500);
  }
}
