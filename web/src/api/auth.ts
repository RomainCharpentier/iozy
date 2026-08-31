import { get, post } from './client'

/**
 * Entrer, sortir, savoir qui l'on est.
 *
 * <p>Aucun jeton n'est manipulé ici : la session vit dans un cookie que le
 * navigateur envoie tout seul et que le JavaScript ne peut pas lire (voir
 * SecurityConfig côté serveur). Ce module ne fait donc que poser des questions
 * au serveur - c'est lui qui sait.
 */

/** L'état d'une instance, pour savoir quoi proposer avant même de connaître quelqu'un. */
export interface EtatAuth {
  /** Personne n'a encore de compte : c'est le tout premier démarrage. */
  aucunCompte: boolean
  /** Un compte de plus peut être créé (premier compte, ou code d'invitation configuré). */
  creationOuverte: boolean
  /**
   * Quelqu'un a ouvert sa collection aux visiteurs : on peut entrer sans
   * compte, en lecture seule. Faux par défaut, et faux sur toute instance dont
   * le propriétaire n'a rien coché.
   */
  visiteOuverte: boolean
}

export interface Compte {
  /** Pour une visite, la collection parcourue - il n'y a pas de compte à nommer. */
  id: string
  /** Nulle en visite : un visiteur n'a pas d'adresse, et celle de l'hôte ne le regarde pas. */
  email: string | null
  /** Unique sur l'instance, et le seul nom sous lequel on apparaît - jamais l'adresse. */
  pseudo: string
  /**
   * Peut administrer l'INSTANCE - voir qui a un compte, en supprimer un.
   * Aucun accès aux données de quiconque : l'isolation par propriétaire est
   * entière (voir `api/admin`).
   */
  admin: boolean
  /**
   * Une VISITE, pas un compte : `pseudo` est alors le nom de la personne dont
   * on parcourt la collection, et le serveur refuse toute écriture (403). La
   * même forme décrit les deux, pour qu'aucun écran n'ait à demander « lequel
   * des deux ? » avant de savoir s'il y a quelqu'un.
   */
  invite: boolean
}

export function lireEtatAuth(): Promise<EtatAuth> {
  return get<EtatAuth>('/auth/etat')
}

/** Le compte connecté. Rejette en 401 quand il n'y en a pas - ce n'est pas une panne. */
export function lireCompte(): Promise<Compte> {
  return get<Compte>('/auth/me')
}

export function seConnecter(email: string, motDePasse: string): Promise<Compte> {
  return post<Compte>('/auth/login', { email, motDePasse })
}

export function creerCompte(params: {
  email: string
  motDePasse: string
  pseudo: string
  codeInvitation?: string
}): Promise<Compte> {
  return post<Compte>('/auth/register', params)
}

export function seDeconnecter(): Promise<void> {
  return post<void>('/auth/logout')
}

/**
 * Entrer sans compte, sur la collection dont le propriétaire a ouvert les
 * portes. Rejette en 403 si personne n'en a ouvert - ce que l'écran de
 * connexion évite en ne proposant le bouton que si `visiteOuverte`.
 */
export function entrerEnVisite(): Promise<Compte> {
  return post<Compte>('/auth/visite')
}
