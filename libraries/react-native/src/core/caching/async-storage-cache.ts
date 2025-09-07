import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CacheAdapter } from './types';

export class AsyncStorageCacheAdapter implements CacheAdapter {
  async get(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}

export function asyncStorageCacheAdapter(): CacheAdapter {
  return new AsyncStorageCacheAdapter();
}
