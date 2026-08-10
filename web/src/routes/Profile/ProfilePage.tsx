import { Link } from 'react-router-dom'
import { Star, BarChart3, Tags, Scale, ChevronRight } from 'lucide-react'

interface ProfileLink {
  to: string
  label: string
  description: string
  icon: typeof Star
}

// Regroupe tout ce qui n'est ni "consulter ma collection" ni "chercher un
// titre à ajouter" (voir TabBar.tsx) - pages/outils secondaires consultés
// ponctuellement plutôt qu'à chaque session, ça ne justifiait pas chacun
// son propre onglet (voir "trop de menus/sous-menus"). "Évaluer un achat"
// vivait avant dans un bouton flottant dédié - pas intuitif (un FAB signale
// "créer du nouveau", pas "analyser une annonce"), déplacé ici à la place.
const LINKS: ProfileLink[] = [
  { to: '/wishlist', label: 'Wishlist', description: 'Ce que tu veux ajouter à ta collection', icon: Star },
  { to: '/purchase-analysis', label: 'Évaluer un achat', description: "Analyser une annonce d'occasion avant de l'acheter", icon: Scale },
  { to: '/stats', label: 'Statistiques', description: 'Vue d\'ensemble de ta collection', icon: BarChart3 },
  { to: '/types', label: 'Types de collection', description: 'Gérer les catégories (mangas, jeux vidéo...)', icon: Tags },
]

export function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Mon profil</h1>
      <ul className="flex flex-col gap-2">
        {LINKS.map(({ to, label, description, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accent">
                <Icon size={18} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-textPrimary">{label}</span>
                <span className="block text-xs text-textDim">{description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-textDim" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
