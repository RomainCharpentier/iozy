import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

/** Mise en page racine : contenu scrollable + barre d'onglets fixe en bas
 * (équivalent du TabView racine de IozyCoreApp.swift). Pas de bouton
 * flottant : essayé pour "Évaluer un achat", mais un FAB signale
 * universellement "créer du nouveau" dans la plupart des apps - l'utiliser
 * pour autre chose n'était pas intuitif (voir ProfilePage, qui héberge
 * "Évaluer un achat" à la place). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">{children}</main>
      <TabBar />
    </div>
  )
}
