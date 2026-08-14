import { Link } from 'react-router-dom'
import { Tags, Upload, ChevronRight } from 'lucide-react'

interface AdminLink {
  to: string
  label: string
  description: string
  icon: typeof Tags
}

// "Administration avancée" (voir l'audit UX) : sépare ce qui configure
// l'app/gère les données brutes (technique, touché une fois puis oublié) de
// ce qu'on consulte pour sa collection (Profil) ou qu'on règle pour son
// confort d'usage (Paramètres) - la personnalisation des types de fiches ou
// l'import BGG n'ont pas leur place au même niveau qu'une wishlist ou des
// statistiques. Accessible uniquement depuis Paramètres, pas d'entrée
// dupliquée ailleurs (voir "réduction réelle de la charge cognitive").
const LINKS: AdminLink[] = [
  { to: '/types', label: 'Types de collection', description: 'Gérer les catégories (mangas, jeux vidéo...) et leurs champs', icon: Tags },
  { to: '/import-bgg', label: 'Importer depuis BGG', description: 'Récupérer tes jeux de société depuis BoardGameGeek', icon: Upload },
]

export function AdministrationPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-textPrimary">Administration avancée</h1>
        <p className="mt-1 text-sm text-textDim">Configuration technique et gestion des données - à toucher rarement.</p>
      </div>

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

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold text-textPrimary">Export de la collection</h2>
        <p className="text-sm text-textDim">
          Toute ta collection (séries, tomes, possessions, expériences, wishlist, relations, tags) dans un format
          ouvert, lisible sans cette app - pour garantir l'absence d'enfermement, même auto-hébergé.
        </p>
        <div className="mt-2 flex gap-2">
          <a
            href="/api/export/json"
            download
            className="rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary hover:bg-surface"
          >
            Télécharger en JSON
          </a>
          <a
            href="/api/export/csv"
            download
            className="rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary hover:bg-surface"
          >
            Télécharger en CSV (.zip)
          </a>
        </div>
      </section>
    </div>
  )
}
