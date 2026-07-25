"use client";

const databaseName = "kasirkita-offline";
const databaseVersion = 1;
const recordStore = "records";

export type OfflineRecordKey = "products" | "transactions" | "checkoutQueue";

export type OfflineRecord<T> = {
  key: OfflineRecordKey;
  value: T;
  updatedAt: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(recordStore)) {
        database.createObjectStore(recordStore, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB tidak tersedia."));
    request.onblocked = () => reject(new Error("IndexedDB sedang dipakai versi aplikasi lama."));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

export async function readOfflineRecord<T>(key: OfflineRecordKey) {
  const database = await openDatabase().catch(() => null);
  if (!database) return null;

  return new Promise<OfflineRecord<T> | null>((resolve) => {
    const transaction = database.transaction(recordStore, "readonly");
    const request = transaction.objectStore(recordStore).get(key);
    request.onsuccess = () => resolve((request.result as OfflineRecord<T> | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

export function writeOfflineRecord<T>(key: OfflineRecordKey, value: T, updatedAt = Date.now()) {
  writeChain = writeChain.then(async () => {
    const database = await openDatabase().catch(() => null);
    if (!database) return;

    await new Promise<void>((resolve) => {
      const transaction = database.transaction(recordStore, "readwrite");
      transaction.objectStore(recordStore).put({ key, value, updatedAt } satisfies OfflineRecord<T>);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  });

  return writeChain;
}

export async function clearOfflineRecords() {
  await writeChain;
  const database = await openDatabase().catch(() => null);
  if (!database) return;

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(recordStore, "readwrite");
    transaction.objectStore(recordStore).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

export async function requestPersistentOfflineStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
