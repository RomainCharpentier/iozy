import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

/** Mise en page racine : contenu scrollable + barre d'onglets fixe en bas
 * (équivalent du TabView racine de IozyCoreApp.swift). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">{children}</main>
      <TabBar />
    </div>
  )
}
