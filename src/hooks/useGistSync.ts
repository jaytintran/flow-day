/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../db';

export const GIST_STORAGE_KEYS = {
  PAT: 'flow_day_github_pat',
  GIST_ID: 'flow_day_gist_id',
  LAST_SYNC: 'flow_day_last_sync',
  LAST_SYNC_ISO: 'flow_day_last_sync_iso',
  DIRTY: 'flow_day_dirty',
  AUTO_SYNC: 'flow_day_auto_sync',
};

export type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Compression helpers (gzip via built-in CompressionStream API)
// ---------------------------------------------------------------------------

/**
 * Gzip-compress a string and return it as a base64-encoded string.
 * Uses a loop instead of spread to avoid call-stack overflow on large payloads.
 */
async function compressToBase64(str: string): Promise<string> {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(str));
  writer.close();
  const buf = await new Response(stream.readable).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decompress a base64-encoded gzip blob back to a plain string.
 */
async function decompressFromBase64(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(stream.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}

// ---------------------------------------------------------------------------

export function useGistSync() {
  const [pat, setPat] = useState('');
  const [gistId, setGistId] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Auto-Sync toggle flag (default: true if previously enabled, false otherwise)
  const [isAutoSyncEnabled, setIsAutoSyncEnabledState] = useState<boolean>(
    () => localStorage.getItem(GIST_STORAGE_KEYS.AUTO_SYNC) === '1',
  );

  // Dirty flag: true whenever local DB has changes that haven't been pushed yet.
  // Initialized from localStorage so it survives page refreshes.
  const [isDirty, setIsDirty] = useState<boolean>(
    () => localStorage.getItem(GIST_STORAGE_KEYS.DIRTY) === '1',
  );

  const isConfigured = pat.trim() !== '' && gistId.trim() !== '';

  // Mutex locks to prevent concurrent sync operations and infinite sync loops
  const isSyncingRef = useRef(false);
  const isImportingRef = useRef(false);
  const autoPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusCheckRef = useRef<number>(0);

  /** Re-read credentials from localStorage (call this when modal opens or settings change). */
  const reload = useCallback(() => {
    setPat(localStorage.getItem(GIST_STORAGE_KEYS.PAT) || '');
    setGistId(localStorage.getItem(GIST_STORAGE_KEYS.GIST_ID) || '');
    setLastSync(localStorage.getItem(GIST_STORAGE_KEYS.LAST_SYNC) || null);
    setIsAutoSyncEnabledState(localStorage.getItem(GIST_STORAGE_KEYS.AUTO_SYNC) === '1');
    setIsDirty(localStorage.getItem(GIST_STORAGE_KEYS.DIRTY) === '1');
  }, []);

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(GIST_STORAGE_KEYS.AUTO_SYNC, enabled ? '1' : '0');
    setIsAutoSyncEnabledState(enabled);
    window.dispatchEvent(new CustomEvent('flowday-autosync-change', { detail: { enabled } }));
  }, []);

  useEffect(() => {
    reload();

    const handleAutoSyncChange = () => {
      setIsAutoSyncEnabledState(localStorage.getItem(GIST_STORAGE_KEYS.AUTO_SYNC) === '1');
    };

    window.addEventListener('flowday-autosync-change', handleAutoSyncChange);
    return () => {
      window.removeEventListener('flowday-autosync-change', handleAutoSyncChange);
    };
  }, [reload]);

  const showToast = useCallback((msg: string, type: SyncStatus = 'success') => {
    setStatus(type);
    setStatusMsg(msg);
    if (type !== 'loading') {
      setTimeout(() => {
        setStatus('idle');
        setStatusMsg('');
      }, 4000);
    }
  }, []);

  const fetchGist = async (token: string, id: string) => {
    const res = await fetch(`https://api.github.com/gists/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch Gist (${res.status})`);
    return await res.json();
  };

  const exportDatabase = async () => {
    const entries = await db.entries.toArray();
    const habits = await db.habits.toArray();
    const categories = await db.categories.toArray();
    const purposes = await db.purposes.toArray();
    const domains = await db.domains.toArray();
    const list_folders = await db.list_folders.toArray();
    const entities = await db.entities.toArray();
    const entity_types = await db.entity_types.toArray();

    // Include Day Scratchpad data in backup (pads, today_pad, and legacy items)
    let scratchpadPads = [];
    let scratchpadItems = [];
    let todayPad = null;
    try {
      const rawPads = localStorage.getItem('flowday_scratchpad_pads_v1');
      if (rawPads) {
        scratchpadPads = JSON.parse(rawPads);
      }
      const rawToday = localStorage.getItem('flowday_today_pad_v1');
      if (rawToday) {
        todayPad = JSON.parse(rawToday);
      }
      const rawScratch = localStorage.getItem('flowday_day_scratchpad_items_v1');
      if (rawScratch) {
        scratchpadItems = JSON.parse(rawScratch);
      }
    } catch {}

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries,
      habits,
      categories,
      purposes,
      domains,
      list_folders,
      entities,
      entity_types,
      scratchpad_pads: scratchpadPads,
      today_pad: todayPad,
      scratchpad_items: scratchpadItems,
    };
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

    // Set importing lock to mute Dexie hooks from flagging dirty or scheduling auto-pushes
    isImportingRef.current = true;

    try {
      // Restore Today Pad data if present in backup
      if (data.today_pad) {
        try {
          localStorage.setItem('flowday_today_pad_v1', JSON.stringify(data.today_pad));
        } catch {}
      }

      // Restore Day Scratchpad pads/items if present in backup
      if (Array.isArray(data.scratchpad_pads)) {
        try {
          localStorage.setItem(
            'flowday_scratchpad_pads_v1',
            JSON.stringify(data.scratchpad_pads),
          );
          window.dispatchEvent(new Event('scratchpad_sync_update'));
        } catch {}
      } else if (Array.isArray(data.scratchpad_items)) {
        try {
          localStorage.setItem(
            'flowday_day_scratchpad_items_v1',
            JSON.stringify(data.scratchpad_items),
          );
          window.dispatchEvent(new Event('scratchpad_sync_update'));
        } catch {}
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
      const parsePurposeDates = (p: any) => {
        if (p.created_at) p.created_at = new Date(p.created_at);
        return p;
      };
      const parseDomainDates = (d: any) => {
        if (d.created_at) d.created_at = new Date(d.created_at);
        return d;
      };
      const parseFolderDates = (f: any) => {
        if (f.created_at) f.created_at = new Date(f.created_at);
        return f;
      };
      const parseEntityDates = (e: any) => {
        if (e.created_at) e.created_at = new Date(e.created_at);
        if (e.scheduled_at) e.scheduled_at = new Date(e.scheduled_at);
        return e;
      };

      const parsedPurposes = (data.purposes ?? []).map(parsePurposeDates);
      const parsedDomains = (data.domains ?? []).map(parseDomainDates);
      const parsedEntries = data.entries.map(parseEntryDates);
      const parsedHabits = data.habits.map(parseHabitDates);
      const parsedCategories = data.categories.map(parseCategoryDates);
      const parsedFolders = (data.list_folders ?? []).map(parseFolderDates);
      const parsedEntities = (data.entities ?? []).map(parseEntityDates);
      const parsedEntityTypes = data.entity_types ?? [];

      await db.transaction(
        'rw',
        [
          db.entries,
          db.habits,
          db.categories,
          db.purposes,
          db.domains,
          db.list_folders,
          db.entities,
          db.entity_types,
        ],
        async () => {
          await db.entries.clear();
          await db.habits.clear();
          await db.categories.clear();
          await db.purposes.clear();
          await db.domains.clear();
          await db.list_folders.clear();
          await db.entities.clear();
          await db.entity_types.clear();

          if (parsedEntries.length > 0) await db.entries.bulkAdd(parsedEntries);
          if (parsedHabits.length > 0) await db.habits.bulkAdd(parsedHabits);
          if (parsedCategories.length > 0) await db.categories.bulkAdd(parsedCategories);
          if (parsedPurposes.length > 0) await db.purposes.bulkAdd(parsedPurposes);
          if (parsedDomains.length > 0) await db.domains.bulkAdd(parsedDomains);
          if (parsedFolders.length > 0) await db.list_folders.bulkAdd(parsedFolders);
          if (parsedEntities.length > 0) await db.entities.bulkAdd(parsedEntities);
          if (parsedEntityTypes.length > 0) await db.entity_types.bulkAdd(parsedEntityTypes);
        },
      );
    } finally {
      // Re-enable hooks shortly after transaction completes
      setTimeout(() => {
        isImportingRef.current = false;
      }, 500);
    }
  };

  const pushToCloud = async (options?: { silent?: boolean }): Promise<boolean> => {
    const isSilent = options?.silent ?? false;
    if (!pat.trim() || !gistId.trim()) {
      if (!isSilent) showToast('PAT and Gist ID are required to sync', 'error');
      return false;
    }

    if (isSyncingRef.current) return false;
    isSyncingRef.current = true;

    if (!isSilent) showToast('Uploading to cloud...', 'loading');
    else setStatus('loading');

    try {
      const payload = await exportDatabase();
      const jsonStr = JSON.stringify(payload);
      let fileContent: string;
      if (typeof CompressionStream !== 'undefined') {
        const compressed = await compressToBase64(jsonStr);
        fileContent = JSON.stringify({ fmt: 'gzip-b64', v: 2, data: compressed });
      } else {
        fileContent = jsonStr;
      }

      const body = {
        files: {
          'flow-day-backup.json': {
            content: fileContent,
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
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const now = new Date();
      const nowStr = now.toLocaleString();
      const nowIso = now.toISOString();
      setLastSync(nowStr);
      localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC, nowStr);
      localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC_ISO, nowIso);
      // Clear the dirty flag — local data is now in sync with the cloud
      localStorage.removeItem(GIST_STORAGE_KEYS.DIRTY);
      setIsDirty(false);

      if (!isSilent) {
        showToast('Successfully backed up to cloud!', 'success');
      } else {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2500);
      }
      return true;
    } catch (err: any) {
      if (!isSilent) showToast(err.message || 'Sync upload failed', 'error');
      else {
        setStatus('error');
        setStatusMsg(err.message || 'Sync upload failed');
        setTimeout(() => setStatus('idle'), 4000);
      }
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  };

  const pullFromCloud = async (options?: { silent?: boolean }): Promise<boolean> => {
    const isSilent = options?.silent ?? false;
    if (!pat.trim() || !gistId.trim()) {
      if (!isSilent) showToast('PAT and Gist ID are required to sync', 'error');
      return false;
    }

    if (isSyncingRef.current) return false;
    isSyncingRef.current = true;

    if (!isSilent) showToast('Downloading from cloud...', 'loading');
    else setStatus('loading');

    try {
      const gist = await fetchGist(pat.trim(), gistId.trim());
      const file = gist.files['flow-day-backup.json'];
      if (!file) throw new Error('FlowDay backup file not found inside Gist');

      let backupData: any;
      const envelope = JSON.parse(file.content);
      if (envelope && envelope.fmt === 'gzip-b64' && typeof envelope.data === 'string') {
        const jsonStr = await decompressFromBase64(envelope.data);
        backupData = JSON.parse(jsonStr);
      } else {
        backupData = envelope;
      }

      await importDatabase(backupData);
      const now = new Date();
      const nowStr = now.toLocaleString();
      const nowIso = now.toISOString();
      setLastSync(nowStr);
      localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC, nowStr);
      localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC_ISO, nowIso);
      localStorage.removeItem(GIST_STORAGE_KEYS.DIRTY);
      setIsDirty(false);

      if (!isSilent) {
        showToast('Successfully restored from cloud!', 'success');
      } else {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2500);
      }
      return true;
    } catch (err: any) {
      if (!isSilent) showToast(err.message || 'Sync restore failed', 'error');
      else {
        setStatus('error');
        setStatusMsg(err.message || 'Sync restore failed');
        setTimeout(() => setStatus('idle'), 4000);
      }
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Auto-detect local changes: hook into every Dexie write across all tables.
  useEffect(() => {
    const onWrite = () => {
      // If currently importing remote data, skip dirty flag & auto-push
      if (isImportingRef.current) return;

      localStorage.setItem(GIST_STORAGE_KEYS.DIRTY, '1');
      setIsDirty(true);

      // Debounced Auto-Push if Auto-Sync is enabled
      const autoSyncOn = localStorage.getItem(GIST_STORAGE_KEYS.AUTO_SYNC) === '1';
      const storedPat = localStorage.getItem(GIST_STORAGE_KEYS.PAT) || '';
      const storedGistId = localStorage.getItem(GIST_STORAGE_KEYS.GIST_ID) || '';

      if (autoSyncOn && storedPat.trim() && storedGistId.trim()) {
        if (autoPushTimerRef.current) {
          clearTimeout(autoPushTimerRef.current);
        }
        autoPushTimerRef.current = setTimeout(() => {
          pushToCloud({ silent: true });
        }, 20000); // 20-second debounce
      }
    };

    const tables = [
      db.entries,
      db.habits,
      db.categories,
      db.purposes,
      db.domains,
      db.list_folders,
      db.entities,
      db.entity_types,
    ];

    tables.forEach((t) => {
      t.hook('creating', onWrite);
      t.hook('updating', onWrite);
      t.hook('deleting', onWrite);
    });

    window.addEventListener('scratchpad_sync_update', onWrite);

    return () => {
      tables.forEach((t) => {
        t.hook('creating').unsubscribe(onWrite);
        t.hook('updating').unsubscribe(onWrite);
        t.hook('deleting').unsubscribe(onWrite);
      });
      window.removeEventListener('scratchpad_sync_update', onWrite);
      if (autoPushTimerRef.current) {
        clearTimeout(autoPushTimerRef.current);
      }
    };
  }, [pat, gistId, isAutoSyncEnabled]);

  // Ambient Auto-Pull on Tab Focus / App Visibility / Online Reconnect
  useEffect(() => {
    const checkAndAutoPull = async () => {
      const autoSyncOn = localStorage.getItem(GIST_STORAGE_KEYS.AUTO_SYNC) === '1';
      const storedPat = localStorage.getItem(GIST_STORAGE_KEYS.PAT) || '';
      const storedGistId = localStorage.getItem(GIST_STORAGE_KEYS.GIST_ID) || '';
      const dirty = localStorage.getItem(GIST_STORAGE_KEYS.DIRTY) === '1';

      if (!autoSyncOn || !storedPat.trim() || !storedGistId.trim()) return;
      if (isSyncingRef.current || dirty) return; // Never overwrite pending unpushed local changes

      // Throttle focus checks (at least 30 seconds between checks)
      const now = Date.now();
      if (now - lastFocusCheckRef.current < 30000) return;
      lastFocusCheckRef.current = now;

      try {
        const gist = await fetchGist(storedPat.trim(), storedGistId.trim());
        const remoteUpdated = new Date(gist.updated_at).getTime();
        const localSyncIso = localStorage.getItem(GIST_STORAGE_KEYS.LAST_SYNC_ISO);
        const localUpdated = localSyncIso ? new Date(localSyncIso).getTime() : 0;

        // If remote Gist has newer commits than our last sync (with 5s clock buffer)
        if (remoteUpdated > localUpdated + 5000) {
          await pullFromCloud({ silent: true });
        }
      } catch {
        // Silently ignore background check errors (network blips, etc.)
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndAutoPull();
      }
    };

    const handleFocus = () => {
      checkAndAutoPull();
    };

    const handleOnline = () => {
      checkAndAutoPull();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [pat, gistId, isAutoSyncEnabled]);

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
      const payload = await exportDatabase();
      const jsonStr = JSON.stringify(payload);
      let fileContent: string;
      if (typeof CompressionStream !== 'undefined') {
        const compressed = await compressToBase64(jsonStr);
        fileContent = JSON.stringify({ fmt: 'gzip-b64', v: 2, data: compressed });
      } else {
        fileContent = jsonStr;
      }
      const body = {
        description: 'FlowDay Sync Data (Private)',
        public: false,
        files: {
          'flow-day-backup.json': {
            content: fileContent,
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
      if (!res.ok) throw new Error(`Failed to create gist (${res.status})`);
      const gist = await res.json();
      setGistId(gist.id);
      localStorage.setItem(GIST_STORAGE_KEYS.PAT, pat.trim());
      localStorage.setItem(GIST_STORAGE_KEYS.GIST_ID, gist.id);
      showToast('Private Gist created and saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to auto-create Gist', 'error');
    }
  };

  const handleSaveCredentials = () => {
    localStorage.setItem(GIST_STORAGE_KEYS.PAT, pat.trim());
    localStorage.setItem(GIST_STORAGE_KEYS.GIST_ID, gistId.trim());
    showToast('Credentials saved!', 'success');
  };

  return {
    pat,
    setPat,
    gistId,
    setGistId,
    lastSync,
    status,
    statusMsg,
    showToast,
    isConfigured,
    isDirty,
    isAutoSyncEnabled,
    setAutoSyncEnabled,
    reload,
    pushToCloud,
    pullFromCloud,
    testConnection,
    handleAutoCreateGist,
    handleSaveCredentials,
    STORAGE_KEYS: GIST_STORAGE_KEYS,
  };
}
