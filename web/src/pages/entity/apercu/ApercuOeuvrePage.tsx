import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { searchMetadata } from '@/common/api/metadata'
import { searchEntities } from '@/common/api/entities'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '@/common/lib/coverImage'
import { creatorFrom } from '@/pages/entity/creatorInfo'
import { isSeriesOngoing } from '@/pages/entity/seriesInfo'
import { useTeinteJaquette } from '@/pages/entity/useTeinteJaquette'
import { resolvePrimaryTitle, useTitleComposition } from '@/common/lib/titleLanguage'
import { gradientFor } from '@/common/theme/gradient'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { ColonneSource, InspecteurFiche, RangeeInspecteur } from '@/pages/entity/InspecteurFiche'
import type { MetadataCandidateDto } from '@/common/types/api'
import { FicheHero } from '@/pages/entity/FicheHero'
import { retourDepuis } from '@/common/lib/retour'
import { useCollecteParTome } from '@/common/lib/typeDeCollection'
import { usePropositionTomes } from '@/pages/entity/usePropositionTomes'

/**
 * L'aperçu d'une œuvre qu'on ne possède pas : la même page que sa fiche, mais
 * lue chez le fournisseur de métadonnées, sans rien écrire en base.
 *
 * <h2>Consulter n'écrit pas</h2>
 * Une version précédente créait l'Entity à l'ouverture, pour n'avoir qu'une
 * seule route. C'était pratique et faux : parcourir des résultats de recherche
 * remplissait le catalogue d'œuvres qu'on n'a jamais eu l'intention de
 * collectionner. Ici rien n'est écrit tant qu'un tome n'est pas coché puis
 * ajouté - c'est `quickAdd` qui crée la fiche à ce moment-là, et l'aperçu
 * bascule alors vers elle.
 *
 * <h2>Identifiée par l'URL, pas par un état de navigation</h2>
 * `?type=…&titre=…` : l'écran se recharge, se partage et revient en arrière.
 * L'ancien écran d'ajout ne vivait que par `location.state` et affichait
 * « Aucune sélection en cours » après un simple F5. La recherche de
 * métadonnées est refaite au chargement pour retrouver l'œuvre - un
 * aller-retour, contre une page qui ne se recharge pas.
 *
 * <h2>Ce qu'il n'affiche pas, et pourquoi</h2>
 * Ni classement, ni note, ni lecture, ni tag, ni relation : ces choses se
 * rattachent à une fiche, et il n'y en a pas encore. Les inventer en lecture
 * seule laisserait croire qu'on peut les renseigner ici.
 */
export function ApercuOeuvrePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const titleComposition = useTitleComposition()
  const entityTypeId = params.get('type') ?? ''
  const titre = params.get('titre') ?? ''

  const typesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const type = typesQuery.data?.find((t) => t.id === entityTypeId)

  /**
   * Cette œuvre a-t-elle DÉJÀ une fiche ?
   *
   * L'aperçu est une URL comme une autre : on peut y arriver par un signet,
   * par le bouton Précédent, ou par un lien reçu - y compris pour une œuvre
   * qu'on possède depuis longtemps. Sans cette vérification, il affirmait
   * « Cette œuvre n'est pas encore dans ta collection » devant une série de
   * 3 tomes possédés (reproduit sur Naruto). L'aperçu s'efface alors devant
   * la vraie fiche, en REMPLAÇANT l'entrée d'historique : revenir en arrière
   * doit ramener d'où l'on vient, pas à un aperçu qui redirigerait aussitôt.
   */
  const ficheExistanteQuery = useQuery({
    queryKey: queryKeys.entities.search({ q: titre }),
    queryFn: () => searchEntities({ q: titre }),
    enabled: entityTypeId !== '' && titre !== '',
  })
  const ficheExistante = ficheExistanteQuery.data?.find(
    (e) => e.entityTypeId === entityTypeId && e.title.trim().toLowerCase() === titre.trim().toLowerCase(),
  )
  useEffect(() => {
    if (ficheExistante) navigate(`/entity/${ficheExistante.id}`, { replace: true })
  }, [ficheExistante, navigate])

  // On refait la recherche pour retrouver les métadonnées de l'œuvre (auteur,
  // jaquette, année, identifiants). Même clé de cache que l'écran de
  // recherche : y revenir juste après ne relance rien.
  const rechercheQuery = useQuery({
    queryKey: queryKeys.metadata.search(entityTypeId, titre),
    queryFn: () => searchMetadata(entityTypeId, titre),
    enabled: entityTypeId !== '' && titre !== '',
  })

  // Le candidat déjà en main, quand on vient de le cliquer : un raccourci,
  // jamais une dépendance - au rechargement il est absent et la recherche
  // ci-dessus le retrouve. C'est ce qui distingue cet écran de l'ancien
  // brouillon, qui n'existait QUE par son `location.state`.
  const etatRecu = useLocation().state
  const candidatRecu = (etatRecu as { candidat?: MetadataCandidateDto } | null)?.candidat ?? null
  // La recherche d'où l'on vient, avec ce qui y était tapé (voir retourFiche).
  // Absente d'un lien reçu ou d'un F5 : le retour vise alors la recherche nue,
  // qui reste une destination valable.
  const retour = retourDepuis(etatRecu) ?? { to: '/add', libelle: 'Recherche' }
  // Un jeu n'a pas de tome : la phrase d'accueil ne peut pas demander d'en
  // cocher (voir lib/typeDeCollection).
  const parTome = useCollecteParTome(entityTypeId)

  // Sinon, celui dont un des titres correspond exactement à celui de l'URL.
  // Comparaison insensible à la casse, et sur le titre principal COMME sur le
  // titre brut : le premier peut venir d'une résolution française que cette
  // page ne refait pas. Aucun repli sur « le premier résultat » - un homonyme
  // afficherait l'auteur et la jaquette d'une autre œuvre.
  const memeTitre = (valeur: string) => valeur.trim().toLowerCase() === titre.trim().toLowerCase()
  const candidat =
    candidatRecu ??
    rechercheQuery.data?.find(
      (c) => memeTitre(resolvePrimaryTitle(c, titleComposition, undefined)) || memeTitre(c.title),
    ) ??
    null
  const attributs = candidat
    ? candidat.imageUrl
      ? { ...candidat.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidat.imageUrl }
      : candidat.attributes
    : {}

  const couvertureUrl = coverImageUrlFrom(attributs)
  const teinte = useTeinteJaquette(couvertureUrl)
  const ongoing = isSeriesOngoing(attributs)
  const startYear = typeof attributs.startYear === 'string' ? attributs.startYear : null
  const endYear = typeof attributs.endYear === 'string' ? attributs.endYear : null

  const proposition = usePropositionTomes({
    entityTypeId,
    titre,
    attributs,
    actif: entityTypeId !== '' && titre !== '',
    // Tant que la recherche n'a pas répondu, `attributs` est vide : ajouter
    // maintenant créerait une œuvre sans jaquette ni auteur.
    attributsEnCours: !candidatRecu && rechercheQuery.isLoading,
    // Le premier tome ajouté crée la fiche : on quitte l'aperçu pour elle,
    // en remplaçant l'entrée d'historique - revenir en arrière doit ramener
    // à la recherche, pas à un aperçu d'une œuvre désormais possédée.
    // Le retour voyage jusqu'à la fiche : après un ajout, « Recherche » doit
    // encore rouvrir la recherche telle qu'on l'avait laissée.
    onAjoute: (id) => navigate(`/entity/${id}`, { replace: true, state: { retour } }),
  })

  if (entityTypeId === '' || titre === '') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-textDim">Aucune œuvre à afficher.</p>
        <Link to={retour.to} className="w-fit text-sm font-semibold text-accentText">
          Retour à la recherche
        </Link>
      </div>
    )
  }

  return (
    <>
      <Link
        to={retour.to}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim hover:text-textPrimary"
      >
        <ArrowLeft size={15} />
        {retour.libelle}
      </Link>

      <FicheHero
        colleEnHaut={false}
        teinte={teinte}
        kicker={type?.label ?? null}
        titre={titre}
        auteur={creatorFrom(attributs)}
        statut={
          ongoing === null
            ? null
            : ongoing
              ? { libelle: 'En cours', couleur: 'var(--color-warning)' }
              : { libelle: 'Terminée', couleur: 'var(--color-ok)' }
        }
        annees={startYear ? (endYear ? `${startYear} → ${endYear}` : ongoing ? `Depuis ${startYear}` : startYear) : null}
        couvertureUrl={couvertureUrl}
        repliCouverture={
          <div className="absolute inset-0" style={{ background: gradientFor(titre) }} aria-hidden="true" />
        }
        editions={proposition.cartesEditions}
      />

      {rechercheQuery.isError && <ErrorBanner message={rechercheQuery.error.message} />}

      {/* Dire que cette œuvre n'est pas encore à soi, plutôt que de laisser
          l'absence de progression le suggérer. */}
      <p className="pt-4 text-sm text-textDim">
        {parTome
          ? "Cette œuvre n'est pas encore dans ta collection — coche les tomes que tu possèdes pour l'y ajouter."
          : "Cette œuvre n'est pas encore dans ta collection."}
      </p>

      {proposition.section}

      <div className="pt-6">
        <InspecteurFiche
          teinte={teinte}
          personnel={
            <p className="text-[13.5px] text-faint">
              Classement, note, lectures et tags apparaîtront ici une fois l'œuvre dans ta collection.
            </p>
          }
          oeuvre={
            <div className="flex flex-col">
              {creatorFrom(attributs) && (
                <RangeeInspecteur libelle={type?.code === 'MANGA' ? 'Mangaka' : 'Auteur'}>
                  {creatorFrom(attributs)}
                </RangeeInspecteur>
              )}
              {ongoing !== null && (
                <RangeeInspecteur libelle="Statut">{ongoing ? 'En cours' : 'Terminée'}</RangeeInspecteur>
              )}
              {startYear && <RangeeInspecteur libelle="Année de début">{startYear}</RangeeInspecteur>}
            </div>
          }
          source={<ColonneSource attributs={attributs} />}
        />
      </div>
    </>
  )
}
