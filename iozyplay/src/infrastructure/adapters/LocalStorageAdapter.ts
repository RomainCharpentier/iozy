/**
 * Infrastructure : LocalStorageAdapter
 * Implémentation concrète du StoragePort utilisant localStorage
 */
import { StoragePort } from '../../ports/output/StoragePort'

export class LocalStorageAdapter implements StoragePort {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  }
}




