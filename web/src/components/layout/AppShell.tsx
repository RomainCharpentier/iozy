import type { ReactNode } from 'react'
import { TabBar } from './TabBar'
import { FloatingAddButton } from './FloatingAddButton'

/** Mise en page racine : contenu scrollable + bouton flottant "Ajouter" +
 * barre d'onglets fixe en bas (équivalent du TabView racine de
 * IozyCoreApp.swift, complété du bouton flottant qui n'existe pas encore
 * côté iOS - voir FloatingAddButton). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">{children}</main>
      <FloatingAddButton />
      <TabBar />
    </div>
  )
}
