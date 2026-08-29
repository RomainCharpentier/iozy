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
}

export interface Compte {
  id: string
  email: string
  /** Unique sur l'instance, et le seul nom sous lequel on apparaît - jamais l'adresse. */
  pseudo: string
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
