/**
 * Implémentation concrète du port de stockage utilisant localStorage
 * Cette couche peut être remplacée par une autre implémentation (IndexedDB, API REST, etc.)
 */

import { StoragePort } from '../../ports/output/StoragePort';

export class LocalStorageAdapter implements StoragePort {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }
}







