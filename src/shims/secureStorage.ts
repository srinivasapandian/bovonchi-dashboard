/**
 * Web-only stand-in for `capacitor-secure-storage-plugin`.
 *
 * The portal code calls get/set/remove with `{ key }`. On web we back it with
 * localStorage (the portal already mirrors credentials there for its service
 * layer), and — like the real plugin — `get` rejects when the key is absent.
 */
export const SecureStoragePlugin = {
  async get({ key }: { key: string }): Promise<{ value: string }> {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error('Item with given key does not exist');
    return { value };
  },
  async set({ key, value }: { key: string; value: string }): Promise<{ value: boolean }> {
    localStorage.setItem(key, value);
    return { value: true };
  },
  async remove({ key }: { key: string }): Promise<{ value: boolean }> {
    localStorage.removeItem(key);
    return { value: true };
  },
  async clear(): Promise<{ value: boolean }> {
    return { value: true };
  },
};
