/**
 * Ports (interfaces) pour le stockage
 * Définit les contrats sans implémentation
 */

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}





