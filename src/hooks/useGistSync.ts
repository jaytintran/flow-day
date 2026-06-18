/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';

export const GIST_STORAGE_KEYS = {
  PAT: 'flow_day_github_pat',
  GIST_ID: 'flow_day_gist_id',
  LAST_SYNC: 'flow_day_last_sync',
  DIRTY: 'flow_day_dirty',
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

  // Dirty flag: true whenever local DB has changes that haven't been pushed yet.
  // Initialized from localStorage so it survives page refreshes.
  const [isDirty, setIsDirty] = useState<boolean>(
    () => localStorage.getItem(GIST_STORAGE_KEYS.DIRTY) === '1',
  );

  const isConfigured = pat.trim() !== '' && gistId.trim() !== '';

  /** Re-read credentials from localStorage (call this when the modal opens). */
  const reload = useCallback(() => {
    setPat(localStorage.getItem(GIST_STORAGE_KEYS.PAT) || '');
    setGistId(localStorage.getItem(GIST_STORAGE_KEYS.GIST_ID) || '');
    setLastSync(localStorage.getItem(GIST_STORAGE_KEYS.LAST_SYNC) || null);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Auto-detect local changes: hook into every Dexie write across all tables.
  // Uses Dexie's low-level table hooks so no manual wiring through components is needed.
  useEffect(() => {
    const onWrite = () => {
      localStorage.setItem(GIST_STORAGE_KEYS.DIRTY, '1');
      setIsDirty(true);
    };

    db.entries.hook('creating', onWrite);
    db.entries.hook('updating', onWrite);
    db.entries.hook('deleting', onWrite);
    db.habits.hook('creating', onWrite);
    db.habits.hook('updating', onWrite);
    db.habits.hook('deleting', onWrite);
    db.categories.hook('creating', onWrite);
    db.categories.hook('updating', onWrite);
    db.categories.hook('deleting', onWrite);
    db.purposes.hook('creating', onWrite);
    db.purposes.hook('updating', onWrite);
    db.purposes.hook('deleting', onWrite);
    db.domains.hook('creating', onWrite);
    db.domains.hook('updating', onWrite);
    db.domains.hook('deleting', onWrite);

    return () => {
      db.entries.hook('creating').unsubscribe(onWrite);
      db.entries.hook('updating').unsubscribe(onWrite);
      db.entries.hook('deleting').unsubscribe(onWrite);
      db.habits.hook('creating').unsubscribe(onWrite);
      db.habits.hook('updating').unsubscribe(onWrite);
      db.habits.hook('deleting').unsubscribe(onWrite);
      db.categories.hook('creating').unsubscribe(onWrite);
      db.categories.hook('updating').unsubscribe(onWrite);
      db.categories.hook('deleting').unsubscribe(onWrite);
      db.purposes.hook('creating').unsubscribe(onWrite);
      db.purposes.hook('updating').unsubscribe(onWrite);
      db.purposes.hook('deleting').unsubscribe(onWrite);
      db.domains.hook('creating').unsubscribe(onWrite);
      db.domains.hook('updating').unsubscribe(onWrite);
      db.domains.hook('deleting').unsubscribe(onWrite);
    };
  }, []);

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
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
      habits,
      categories,
      purposes,
      domains,
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

    const parsedPurposes = (data.purposes ?? []).map(parsePurposeDates);
    const parsedDomains = (data.domains ?? []).map(parseDomainDates);
    const parsedEntries = data.entries.map(parseEntryDates);
    const parsedHabits = data.habits.map(parseHabitDates);
    const parsedCategories = data.categories.map(parseCategoryDates);

    await db.transaction(
      'rw',
      [db.entries, db.habits, db.categories, db.purposes, db.domains],
      async () => {
        await db.entries.clear();
        await db.habits.clear();
        await db.categories.clear();
        await db.purposes.clear();
        await db.domains.clear();
        if (parsedEntries.length > 0) await db.entries.bulkAdd(parsedEntries);
        if (parsedHabits.length > 0) await db.habits.bulkAdd(parsedHabits);
        if (parsedCategories.length > 0) await db.categories.bulkAdd(parsedCategories);
        if (parsedPurposes.length > 0) await db.purposes.bulkAdd(parsedPurposes);
        if (parsedDomains.length > 0) await db.domains.bulkAdd(parsedDomains);
      },
    );
  };

  const pushToCloud = async (): Promise<boolean> => {
    if (!pat.trim() || !gistId.trim()) {
      showToast('PAT and Gist ID are required to sync', 'error');
      return false;
    }
    showToast('Uploading to cloud...', 'loading');
    try {
      const payload = await exportDatabase();

      // Serialize without whitespace, then compress if the browser supports it.
      // The file is wrapped in a small JSON envelope so the pull side can
      // detect the format and stay backward-compatible with old plain-JSON backups.
      const jsonStr = JSON.stringify(payload);
      let fileContent: string;
      if (typeof CompressionStream !== 'undefined') {
        const compressed = await compressToBase64(jsonStr);
        fileContent = JSON.stringify({ fmt: 'gzip-b64', v: 2, data: compressed });
      } else {
        // Fallback: browser lacks CompressionStream — store compact plain JSON
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
      const nowStr = new Date().toLocaleString();
      setLastSync(nowStr);
      localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC, nowStr);
      // Clear the dirty flag — local data is now in sync with the cloud
      localStorage.removeItem(GIST_STORAGE_KEYS.DIRTY);
      setIsDirty(false);
      showToast('Successfully backed up to cloud!', 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Sync upload failed', 'error');
      return false;
    }
  };

  const pullFromCloud = async (): Promise<boolean> => {
    if (!pat.trim() || !gistId.trim()) {
      showToast('PAT and Gist ID are required to sync', 'error');
      return false;
    }
    showToast('Downloading from cloud...', 'loading');
    try {
      const gist = await fetchGist(pat.trim(), gistId.trim());
      const file = gist.files['flow-day-backup.json'];
      if (!file) throw new Error('FlowDay backup file not found inside Gist');

      // Auto-detect format: compressed envelope vs. legacy plain JSON.
      // This ensures old backups (pushed before compression was added) still
      // restore correctly on any device, regardless of app version.
      let backupData: any;
      const envelope = JSON.parse(file.content);
      if (envelope && envelope.fmt === 'gzip-b64' && typeof envelope.data === 'string') {
        // New compressed format — decompress then parse the inner JSON
        const jsonStr = await decompressFromBase64(envelope.data);
        backupData = JSON.parse(jsonStr);
      } else {
        // Legacy plain-JSON format (v1) — envelope IS the backup payload
        backupData = envelope;
      }

      await importDatabase(backupData);
      const nowStr = new Date().toLocaleString();
      setLastSync(nowStr);
      localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC, nowStr);
      showToast('Successfully restored from cloud!', 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Sync restore failed', 'error');
      return false;
    }
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
    reload,
    pushToCloud,
    pullFromCloud,
    testConnection,
    handleAutoCreateGist,
    handleSaveCredentials,
    STORAGE_KEYS: GIST_STORAGE_KEYS,
  };
}
