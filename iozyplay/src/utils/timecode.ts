/**
 * Conversion des points de départ des extraits (secondes ↔ « mm:ss »)
 */
import type { Question } from '@/types'
import { extractYouTubeStartTime } from '@/utils/youtube'

// Borne haute du point de départ (24 h), alignée sur le serveur (server/domain/questionMedia.js)
export const START_TIME_MAX = 86400

/**
 * Vérifie qu'une valeur est un point de départ valide : entier ≥ 0 et ≤ START_TIME_MAX
 */
export function isValidStartTime(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= START_TIME_MAX
  )
}

/**
 * Normalise un point de départ reçu de l'extérieur (question, payload serveur).
 * Toute valeur absente ou invalide vaut 0 (début du média).
 */
export function normalizeStartTime(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  const rounded = Math.floor(value)
  return rounded <= START_TIME_MAX ? rounded : 0
}

/**
 * Point de départ réellement jouable : l'extrait doit durer jusqu'à la fin du chrono.
 * Si le départ est trop tard dans la vidéo (départ + durée de lecture > durée du média),
 * il est avancé à « durée − durée de lecture » ; si le média est plus court que la durée
 * de lecture, on part du début. Durée inconnue (métadonnées pas encore chargées) : départ
 * inchangé.
 */
export function fitStartToDuration(
  start: number,
  mediaDuration: number | undefined,
  playSeconds: number | undefined
): number {
  return pickPlayableStart(start, mediaDuration, playSeconds)
}

/**
 * Point de départ de la partie en cours, en secondes.
 * - `minStart` : départ minimum de la question (startTime de l'éditeur ou t= de l'URL) ;
 * - `fraction` (aléatoire, dans [0, 1)) : position du départ entre `minStart` et le dernier
 *   départ jouable « durée − chrono ». Même fraction + même média → même départ pour tous.
 * Sans fraction : `minStart`, avancé si trop tardif (fitStartToDuration). Durée inconnue :
 * `minStart` (le départ est recalculé quand la durée est connue).
 */
export function pickPlayableStart(
  minStart: number,
  mediaDuration: number | undefined,
  playSeconds: number | undefined,
  fraction?: number
): number {
  const safeStart = normalizeStartTime(minStart)
  if (!mediaDuration || !Number.isFinite(mediaDuration) || mediaDuration <= 0) return safeStart
  const play = playSeconds && playSeconds > 0 ? playSeconds : 0
  const latest = Math.max(0, Math.floor(mediaDuration - play))
  const earliest = Math.min(safeStart, latest)
  if (typeof fraction !== 'number' || !Number.isFinite(fraction)) return earliest
  const clamped = Math.min(Math.max(fraction, 0), 0.9999)
  return Math.min(latest, earliest + Math.floor(clamped * (latest - earliest + 1)))
}

/** Fraction de départ aléatoire (solo ; en ligne, c'est le serveur qui la tire) */
export function randomStartFraction(random: () => number = Math.random): number {
  return Math.min(0.9999, Math.max(0, Math.floor(random() * 10000) / 10000))
}

/**
 * Convertit une saisie utilisateur en secondes.
 * Formats acceptés : « 90 », « 1:30 », « 01:30 », « 1:02:03 » (h:mm:ss).
 * Une saisie vide vaut 0. Retourne null si la saisie est invalide.
 */
export function parseTimecode(input: string): number | null {
  const value = input.trim()
  if (value === '') return 0

  // Secondes seules
  if (/^\d+$/.test(value)) {
    const seconds = Number(value)
    return isValidStartTime(seconds) ? seconds : null
  }

  // mm:ss ou h:mm:ss (les secondes et minutes intermédiaires sont sur 2 chiffres max, < 60)
  const match = value.match(/^(?:(\d+):)?(\d+):(\d{1,2})$/)
  if (!match) return null
  const hours = match[1] !== undefined ? Number(match[1]) : 0
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (seconds >= 60) return null
  if (match[1] !== undefined && minutes >= 60) return null

  const total = hours * 3600 + minutes * 60 + seconds
  return isValidStartTime(total) ? total : null
}

/**
 * Formate des secondes en « m:ss » (ou « h:mm:ss » au-delà d'une heure)
 */
export function formatTimecode(totalSeconds: number): string {
  const safe = normalizeStartTime(totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const ss = seconds.toString().padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`
  }
  return `${minutes}:${ss}`
}

/**
 * Point de départ effectif d'une question, en secondes :
 * `startTime` s'il est valide, sinon le `t=` / `start=` de l'URL YouTube, sinon 0.
 */
export function getQuestionStartTime(question: Pick<Question, 'startTime' | 'mediaUrl'>): number {
  if (isValidStartTime(question.startTime)) return question.startTime
  return normalizeStartTime(extractYouTubeStartTime(question.mediaUrl ?? '') ?? 0)
}
