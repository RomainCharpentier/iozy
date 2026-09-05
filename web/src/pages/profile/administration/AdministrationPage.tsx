import { Link } from 'react-router-dom'
import { Tags, ChevronRight, BookMarked, Users, Hash } from 'lucide-react'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { useAuth } from '@/common/hooks/useAuth'

interface AdminLink {
  to: string
  label: string
  description: string
  icon: typeof Tags
}

/**
 * Ce qui n'est ni un réglage de compte, ni un réglage d'appareil.
 *
 * <h2>Deux sections, deux échelles</h2>
 * <b>Ma collection</b> : ce qui la DÉCRIT - les catégories qu'elle accepte, les
 * éditions de référence qui rendent les « X/Y » possibles, et les tags posés
 * sur les œuvres. Ça se configure une fois puis s'oublie, contrairement au
 * thème ou à la langue des titres, qui restent dans Paramètres.
 * <p>
 * Les <b>tags</b> n'y sont que pour un administrateur, contrairement aux deux
 * autres : ils décrivent une œuvre du catalogue PARTAGÉ, et les poser engage
 * donc tous les comptes (voir TagController). Les lire, en revanche, est
 * ouvert - c'est ce qui rend le filtre de Ma collection utilisable.
 *
 * <p><b>Cette instance</b> : la machine, pas les données. Une seule entrée -
 * les comptes - et elle n'apparaît que pour un administrateur.
 *
 * <h2>Ce qui a quitté cet écran</h2>
 * L'<b>export</b> : il vivait ici, à côté des catégories de collection, comme
 * si télécharger sa collection était de la configuration technique. C'est le
 * contraire - c'est la garantie de pouvoir partir avec ses données, et ça
 * appartient au compte qui les possède, donc à <b>Paramètres ▸ Mon compte</b>.
 *
 * <p>L'<b>import BGG</b> : récupérer ses jeux depuis BoardGameGeek, c'est
 * AJOUTER à sa collection - la même intention que taper un titre ou scanner un
 * code-barres, avec une troisième source. Il a rejoint <b>Rechercher</b>, à
 * côté de Scanner. Rien d'administratif là-dedans.
 *
 * <p>Ces deux départs disent la même chose : cet écran décrit ou configure, il
 * ne fait rien à la place de l'utilisateur.
 */
const MA_COLLECTION: AdminLink[] = [
  {
    to: '/types',
    label: 'Catégories de collection',
    description: 'Mangas, jeux vidéo, jeux de société... et les champs de chacune',
    icon: Tags,
  },
  {
    to: '/editions',
    label: 'Éditions de référence',
    description: "Nombre de tomes et éditeur par édition - c'est de là que vient la progression X/Y",
    icon: BookMarked,
  },
]

/**
 * Réservé aux administrateurs, et absent pour les autres.
 * <p>
 * Le masquer n'est PAS ce qui protège : le serveur répond 403 sur
 * {@code /api/admin/**} quel que soit l'écran (voir SecurityConfig). Ce qui se
 * joue ici est autre chose - ne pas proposer une porte qui ne s'ouvrira pas.
 */
/** Réservé aux administrateurs, comme les comptes - et pour la même raison :
 *  ce qu'on y fait engage les autres. */
const TAGS: AdminLink = {
  to: '/administration/tags',
  label: 'Tags',
  description: "Les étiquettes posées sur les œuvres - renommer, supprimer, voir ce qu'elles servent",
  icon: Hash,
}

const CETTE_INSTANCE: AdminLink[] = [
  {
    to: '/administration/comptes',
    label: 'Comptes',
    description: "Qui a un compte ici, et en supprimer un - jamais le contenu de leur collection",
    icon: Users,
  },
]

export function AdministrationPage() {
  const { compte } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <EnTeteSection
        niveau={1}
        titre="Administration"
        sousTitre="Ce qui décrit ta collection, et la machine qui l'héberge — à toucher rarement."
      />

      <Groupe titre="Ma collection" liens={compte?.admin ? [...MA_COLLECTION, TAGS] : MA_COLLECTION} />
      {compte?.admin && <Groupe titre="Cette instance" liens={CETTE_INSTANCE} />}
    </div>
  )
}

function Groupe({ titre, liens }: { titre: string; liens: AdminLink[] }) {
  // `aria-labelledby` et non un simple titre visuel : sans nom accessible, une
  // <section> n'est pas un repère - un lecteur d'écran la traverse sans pouvoir
  // sauter d'un groupe à l'autre, et les deux échelles redeviennent une seule
  // liste plate, exactement ce qu'on vient de démêler.
  const id = `groupe-${titre.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-display text-lg font-semibold text-textPrimary">
        {titre}
      </h2>
      <ul className="flex flex-col gap-2">
        {liens.map(({ to, label, description, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accentText">
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
    </section>
  )
}
