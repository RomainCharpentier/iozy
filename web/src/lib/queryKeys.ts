// Clés de requête TanStack Query centralisées, pour que les invalidations
// (ex: après une mutation) restent cohérentes entre écrans sans dupliquer
// des tableaux de clés à la main partout.
export const queryKeys = {
  entities: {
    all: ['entities'] as const,
    search: (params: { q?: string; entityTypeId?: string; tagId?: string }) =>
      ['entities', 'search', params] as const,
    detail: (id: string) => ['entities', id] as const,
  },
  ownerships: (entityId: string) => ['ownerships', entityId] as const,
  /** Toutes les Ownership (voir listAllOwnerships) - clé distincte de
   * ownerships(entityId) ci-dessus pour ne jamais collisionner en cache. */
  allOwnerships: ['ownerships', 'all'] as const,
  experiences: (entityId: string) => ['experiences', entityId] as const,
  tags: {
    all: ['tags'] as const,
  },
  relationships: {
    from: (entityId: string) => ['relationships', 'from', entityId] as const,
    to: (entityId: string) => ['relationships', 'to', entityId] as const,
  },
  wishlist: {
    all: ['wishlist'] as const,

  },
  // Partage d'espace - une seule clé, parce qu'il n'y a plus qu'un partage :
  // collection et envies en sont deux sections, pas deux liens.
  share: ['share'] as const,
  sharedSpace: (token: string) => ['share', 'shared', token] as const,
  insights: {
    stats: ['insights', 'stats'] as const,
    discover: (entityTypeCode: string) => ['insights', 'discover', entityTypeCode] as const,
    timeline: ['insights', 'timeline'] as const,
    yearlyRecap: (year: number) => ['insights', 'yearlyRecap', year] as const,
    value: ['insights', 'value'] as const,
    progress: ['insights', 'progress'] as const,
    /** Préfixée par `progress` À DESSEIN : les invalidations existantes
     *  (`insights.progress`) emportent donc aussi la progression d'une œuvre,
     *  sans avoir à les recenser une seconde fois. */
    progressOf: (entityId: string) => ['insights', 'progress', entityId] as const,
  },
  metadata: {
    search: (entityTypeId: string, query: string) => ['metadata', 'search', entityTypeId, query] as const,
    /** Les œuvres déjà connues comme sans tome, pour une page de résultats.
     *  Clé par la liste des titres interrogés : changer de recherche change la
     *  question, et deux pages de résultats n'ont pas la même réponse. */
    sansTomes: (entityTypeId: string, titres: string) => ['metadata', 'sansTomes', entityTypeId, titres] as const,
  },
  entityTypes: {
    all: ['entityTypes'] as const,
  },
  purchaseAnalysis: {
    history: ['purchaseAnalysis', 'history'] as const,
    detail: (id: string) => ['purchaseAnalysis', 'history', id] as const,
    edition: (seriesTitle: string, editionName: string) =>
      ['purchaseAnalysis', 'edition', seriesTitle, editionName] as const,
    allEditions: ['purchaseAnalysis', 'editions', 'all'] as const,
    completeness: (seriesTitle: string, editionName: string, volumes: number[]) =>
      ['purchaseAnalysis', 'completeness', seriesTitle, editionName, volumes] as const,
    nearCompleteSuggestions: ['purchaseAnalysis', 'nearCompleteSuggestions'] as const,
    /** Les prix relevés d'une édition (écran Éditions de référence). */
    marketObservations: (mangaEditionId: string) =>
      ['purchaseAnalysis', 'marketObservations', mangaEditionId] as const,
  },
  /** Les tomes qu'un fournisseur connaît pour une œuvre, que le catalogue n'a
   *  pas encore (voir useTomesProposes). Clé par type ET titre : c'est ce
   *  couple que la recherche interroge, et deux œuvres homonymes de types
   *  différents n'ont pas les mêmes tomes. */
  tomesProposes: (entityTypeId: string, titre: string) => ['tomesProposes', entityTypeId, titre] as const,
  /** L'édition suivie d'une série (voir api/followedEdition). Clé par série :
   *  la fiche, la grille de tomes et les cartes d'édition la lisent toutes,
   *  une seule requête pour les trois. */
  followedEdition: (entityId: string) => ['followedEdition', entityId] as const,
  /** Qui est connecté, et ce que l'instance permet (voir lib/useAuth). Deux
   *  clés distinctes : l'état de l'instance se lit sans compte, le compte non. */
  auth: {
    compte: ['auth', 'compte'] as const,
    etat: ['auth', 'etat'] as const,
  },
  tierLists: {
    general: (entityTypeId: string) => ['tierLists', 'general', entityTypeId] as const,
    // null = les listes transverses "toutes catégories" (voir TierListDto.entityTypeId) -
    // une famille à part, jamais mélangée avec celles d'un univers donné.
    custom: (entityTypeId: string | null) => ['tierLists', 'custom', entityTypeId ?? 'all-universes'] as const,
    detail: (id: string) => ['tierLists', 'detail', id] as const,
    entitySummary: (entityId: string) => ['tierLists', 'entitySummary', entityId] as const,
  },
} as const
