import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Envoi automatique de la réponse pendant la phase guess.
 *
 * Règle métier : une seule réponse par joueur et par question, modifiable jusqu'à la fin
 * du guess ; la réponse retenue est le CONTENU DU CHAMP, même sans Entrée. On transmet donc
 * la saisie au fil de l'eau :
 * - après un court délai sans frappe (`delayMs`), ou tout de suite si `delayMs` vaut 0 ;
 * - immédiatement sur Entrée ou choix d'une suggestion (`submit`) ;
 * - avant un vote « Passer » (`flush`, à appeler par l'appelant avant d'émettre le vote) ;
 * - à la fin du guess (`active` passe à false) : la saisie en attente part avant le gel.
 *
 * Champ vidé : la réponse vide est transmise (le serveur et le solo la comptent comme
 * « pas de réponse »), puisque c'est le contenu du champ qui compte. Rien n'est envoyé
 * tant que le joueur n'a rien saisi.
 *
 * Au démontage (changement de question), la saisie en attente est abandonnée : elle ne
 * doit jamais être enregistrée comme réponse à la question suivante.
 */

/** Délai sans frappe avant l'envoi automatique (en ligne) */
export const AUTO_SEND_DELAY_MS = 300
/** En dessous de ce temps restant (secondes), chaque modification part sans délai */
export const AUTO_SEND_IMMEDIATE_THRESHOLD_S = 3

interface UseAnswerAutoSendOptions {
  /** Phase guess en cours : en dehors, plus rien n'est transmis */
  active: boolean
  /** Délai avant envoi ; 0 = envoi à chaque modification */
  delayMs: number
  send: (answer: string) => void
}

export interface AnswerAutoSend {
  /** Le contenu du champ a changé */
  update: (value: string) => void
  /** Envoi immédiat (Entrée, suggestion choisie) */
  submit: (value: string) => void
  /** Envoie la saisie en attente, s'il y en a une */
  flush: () => void
  /** Dernière réponse transmise (trim), null si rien n'a encore été envoyé */
  lastSent: string | null
  /** Une saisie attend la fin du délai */
  hasPending: boolean
}

export function useAnswerAutoSend({
  active,
  delayMs,
  send,
}: UseAnswerAutoSendOptions): AnswerAutoSend {
  // Refs : les callbacks retournés restent stables et lisent toujours les dernières valeurs
  const sendRef = useRef(send)
  sendRef.current = send
  const activeRef = useRef(active)
  activeRef.current = active
  const delayRef = useRef(delayMs)
  delayRef.current = delayMs

  const lastSentRef = useRef<string | null>(null)
  const pendingRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [hasPending, setHasPending] = useState(false)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const sendPending = useCallback((force = false) => {
    clearTimer()
    const value = pendingRef.current
    pendingRef.current = null
    setHasPending(false)
    if (value === null) return
    if (!activeRef.current && !force) return
    if (value === (lastSentRef.current ?? '')) return
    lastSentRef.current = value
    setLastSent(value)
    sendRef.current(value)
  }, [])

  const update = useCallback(
    (raw: string) => {
      if (!activeRef.current) return
      const value = raw.trim()
      if (value === (lastSentRef.current ?? '')) {
        // Retour à la valeur déjà enregistrée : rien à envoyer
        clearTimer()
        pendingRef.current = null
        setHasPending(false)
        return
      }
      pendingRef.current = value
      if (delayRef.current <= 0) {
        sendPending()
        return
      }
      clearTimer()
      setHasPending(true)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        sendPending()
      }, delayRef.current)
    },
    [sendPending]
  )

  const submit = useCallback(
    (raw: string) => {
      if (!activeRef.current) return
      pendingRef.current = raw.trim()
      sendPending()
    },
    [sendPending]
  )

  const flush = useCallback(() => sendPending(), [sendPending])

  // Fin du guess : la dernière saisie part avant le gel du champ (le contenu compte)
  const wasActiveRef = useRef(active)
  useEffect(() => {
    if (wasActiveRef.current && !active) {
      sendPending(true)
    }
    wasActiveRef.current = active
  }, [active, sendPending])

  // Démontage (question suivante) : abandonner la saisie en attente
  useEffect(
    () => () => {
      clearTimer()
      pendingRef.current = null
    },
    []
  )

  return { update, submit, flush, lastSent, hasPending }
}
