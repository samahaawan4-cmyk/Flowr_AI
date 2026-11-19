import type {Conversation} from '../types/chat';

const LEGACY_STORAGE_KEYS = ['lumen_conversations_v1', 'flowr_conversations_v1'];
const PRIMARY_LS_KEY = 'flowr_conversations_v1';
const BG_PREFS_LS_KEY = 'flowr_bg_prefs_v1';
const DB_NAME = 'flowr_history_db';
const DB_VERSION = 2;
const STORE_NAME = 'conversations';
const PREFS_STORE_NAME = 'prefs';

export type BackgroundPresetId = 'aurora' | 'silk' | 'starlight' | 'obsidian' | 'custom';

export interface BackgroundPrefs {
  preset: BackgroundPresetId;
  dimOpacity: number; // 0.25 to 0.85
  blur: boolean;
  customImageUrl?: string;
}

export const DEFAULT_BG_PREFS: BackgroundPrefs = {
  preset: 'aurora',
  dimOpacity: 0.55,
  blur: false,
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(PREFS_STORE_NAME)) {
        db.createObjectStore(PREFS_STORE_NAME, {keyPath: 'key'});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export function loadLegacyConversationsSync(): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.id === 'string' && Array.isArray(item.messages)) {
            const existing = map.get(item.id);
            if (!existing || (item.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
              map.set(item.id, item as Conversation);
            }
          }
        }
      }
    } catch {
      // Ignore corrupt storage entries
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function loadConversationsFromHistory(): Promise<Conversation[]> {
  const legacy = loadLegacyConversationsSync();
  const merged = new Map<string, Conversation>();
  for (const conv of legacy) {
    merged.set(conv.id, conv);
  }

  try {
    const db = await openDatabase();
    const idbItems = await new Promise<Conversation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
    db.close();

    for (const conv of idbItems) {
      if (conv && typeof conv.id === 'string' && Array.isArray(conv.messages)) {
        const existing = merged.get(conv.id);
        if (!existing || (conv.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
          merged.set(conv.id, conv);
        }
      }
    }
  } catch {
    // Fallback to legacy localStorage only
  }

  return Array.from(merged.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function persistConversationsToHistory(conversations: Conversation[]): Promise<void> {
  // Save full history in IndexedDB (handles large histories and attachments cleanly)
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const conv of conversations) {
        store.put(conv);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IndexedDB errors
  }

  // Also keep a lightweight localStorage snapshot for instant initial hydration
  try {
    localStorage.setItem(PRIMARY_LS_KEY, JSON.stringify(conversations));
  } catch {
    try {
      const trimmed = conversations.slice(0, 40).map((conv, idx) => ({
        ...conv,
        messages: conv.messages.map((m) => ({
          ...m,
          attachments:
            idx === 0
              ? m.attachments
              : m.attachments?.map((att) =>
                  att.kind === 'image' ? {...att, data: '', previewUrl: undefined} : att,
                ),
        })),
      }));
      localStorage.setItem(PRIMARY_LS_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export function parseImportedConversations(rawJson: string): Conversation[] {
  const parsed = JSON.parse(rawJson);
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.conversations)
      ? parsed.conversations
      : [];

  return list.filter(
    (item: unknown): item is Conversation =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as Conversation).id === 'string' &&
          typeof (item as Conversation).title === 'string' &&
          Array.isArray((item as Conversation).messages),
      ),
  );
}

export function loadBackgroundPrefsSync(): BackgroundPrefs {
  try {
    const raw = localStorage.getItem(BG_PREFS_LS_KEY);
    if (!raw) return DEFAULT_BG_PREFS;
    const parsed = JSON.parse(raw) as Partial<BackgroundPrefs>;
    return {
      preset: parsed.preset ?? DEFAULT_BG_PREFS.preset,
      dimOpacity:
        typeof parsed.dimOpacity === 'number' ? parsed.dimOpacity : DEFAULT_BG_PREFS.dimOpacity,
      blur: Boolean(parsed.blur),
      customImageUrl: typeof parsed.customImageUrl === 'string' ? parsed.customImageUrl : undefined,
    };
  } catch {
    return DEFAULT_BG_PREFS;
  }
}

export async function loadBackgroundPrefs(): Promise<BackgroundPrefs> {
  const syncPrefs = loadBackgroundPrefsSync();
  try {
    const db = await openDatabase();
    const saved = await new Promise<BackgroundPrefs | null>((resolve, reject) => {
      const tx = db.transaction(PREFS_STORE_NAME, 'readonly');
      const store = tx.objectStore(PREFS_STORE_NAME);
      const req = store.get('background');
      req.onsuccess = () => {
        const record = req.result as {key: string; value?: BackgroundPrefs} | undefined;
        resolve(record?.value ?? null);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (saved) {
      return {
        preset: saved.preset ?? syncPrefs.preset,
        dimOpacity: typeof saved.dimOpacity === 'number' ? saved.dimOpacity : syncPrefs.dimOpacity,
        blur: typeof saved.blur === 'boolean' ? saved.blur : syncPrefs.blur,
        customImageUrl: saved.customImageUrl ?? syncPrefs.customImageUrl,
      };
    }
  } catch {
    // Fallback to sync localStorage prefs
  }
  return syncPrefs;
}

export async function persistBackgroundPrefs(prefs: BackgroundPrefs): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PREFS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PREFS_STORE_NAME);
      store.put({key: 'background', value: prefs});
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IndexedDB errors
  }

  try {
    localStorage.setItem(
      BG_PREFS_LS_KEY,
      JSON.stringify({
        preset: prefs.preset,
        dimOpacity: prefs.dimOpacity,
        blur: prefs.blur,
      }),
    );
  } catch {
    // Ignore quota errors
  }
}

