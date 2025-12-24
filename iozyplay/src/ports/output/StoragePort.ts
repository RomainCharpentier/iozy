/**
 * Output Port : StoragePort
 * Interface pour le stockage (Hexagonal Architecture)
 */
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}




