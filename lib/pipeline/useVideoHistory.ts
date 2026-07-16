import { useCallback, useEffect, useState } from 'react';
import type { GeneratedVideo } from './types';

const DB_NAME = 'video-generator-history';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllVideos(): Promise<GeneratedVideo[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as GeneratedVideo[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function putVideo(video: GeneratedVideo): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(video);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteVideo(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

interface UseVideoHistoryResult {
  videos: GeneratedVideo[];
  isLoading: boolean;
  addVideo: (video: GeneratedVideo) => Promise<void>;
  removeVideo: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/** Client-side history of generated videos, persisted in IndexedDB. */
export function useVideoHistory(): UseVideoHistoryResult {
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setVideos(await getAllVideos());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      refresh();
    }, 0);
  }, [refresh]);

  const addVideo = useCallback(
    async (video: GeneratedVideo) => {
      await putVideo(video);
      await refresh();
    },
    [refresh],
  );

  const removeVideo = useCallback(
    async (id: string) => {
      await deleteVideo(id);
      await refresh();
    },
    [refresh],
  );

  return { videos, isLoading, addVideo, removeVideo, refresh };
}
