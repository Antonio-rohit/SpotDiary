/**
 * Cross-platform Secure Storage Adapter for SpotDiary Mobile.
 * Uses expo-secure-store when available, with a resilient in-memory fallback for web/testing.
 */

let expoSecureStore: any = null;
try {
  expoSecureStore = require('expo-secure-store');
} catch {
  // expo-secure-store is not available in current environment (e.g. web/test)
}

const memoryStore = new Map<string, string>();

export const SecureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (expoSecureStore && typeof expoSecureStore.setItemAsync === 'function') {
        await expoSecureStore.setItemAsync(key, value);
        return;
      }
    } catch {
      // Fallback
    }
    memoryStore.set(key, value);
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (expoSecureStore && typeof expoSecureStore.getItemAsync === 'function') {
        const val = await expoSecureStore.getItemAsync(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch {
      // Fallback
    }
    return memoryStore.get(key) || null;
  },

  async deleteItem(key: string): Promise<void> {
    try {
      if (expoSecureStore && typeof expoSecureStore.deleteItemAsync === 'function') {
        await expoSecureStore.deleteItemAsync(key);
      }
    } catch {
      // Fallback
    }
    memoryStore.delete(key);
  },
};
