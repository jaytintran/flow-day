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
};

export type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

export function useGistSync() {
  const [pat, setPat] = useState('');
  const [gistId, setGistId] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

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

  const showToast = useCallback(
    (msg: string, type: SyncStatus = 'success') => {
      setStatus(type);
      setStatusMsg(msg);
      if (type !== 'loading') {
        setTimeout(() => {
          setStatus('idle');
          setStatusMsg('');
        }, 4000);
      }
    },
    [],
  );

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
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
      habits,
      categories,
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

  const pushToCloud = async (): Promise<boolean> => {
    if (!pat.trim() || !gistId.trim()) {
      showToast('PAT and Gist ID are required to sync', 'error');
      return false;
    }
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
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const nowStr = new Date().toLocaleString();
      setLastSync(nowStr);
      localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC, nowStr);
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
      const backupData = JSON.parse(file.content);
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
    reload,
    pushToCloud,
    pullFromCloud,
    testConnection,
    handleAutoCreateGist,
    handleSaveCredentials,
    STORAGE_KEYS: GIST_STORAGE_KEYS,
  };
}
