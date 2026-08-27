// Tiny OPFS store for book files and cover images. Metadata lives in Dexie;
// the heavy bytes live here so we never load a whole book into memory.

const root = navigator.storage.getDirectory();

export async function saveFile(key: string, file: Blob | File): Promise<void> {
  const handle = await (await root).getFileHandle(key, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file);
  await writable.close();
}

export async function readFile(key: string): Promise<File | null> {
  try {
    const handle = await (await root).getFileHandle(key);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await (await root).removeEntry(key);
  } catch {
    // already gone
  }
}

/** Read a file and return a temporary object URL (caller revokes it). */
export async function readObjectUrl(key: string): Promise<string | null> {
  const file = await readFile(key);
  return file ? URL.createObjectURL(file) : null;
}

/** Clear all stored files in OPFS. */
export async function clearAllFiles(): Promise<void> {
  try {
    const dir = await root;
    for await (const [name] of (dir as any).entries()) {
      await dir.removeEntry(name, { recursive: true });
    }
  } catch {
    // ignore
  }
}
