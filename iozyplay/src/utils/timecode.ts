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
