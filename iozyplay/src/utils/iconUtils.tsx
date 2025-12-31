/**
 * Utilitaires pour les icônes - Remplace les emojis par des icônes react-icons
 * pour un rendu cohérent sur tous les systèmes
 */
import { 
  FaQuestionCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaLightbulb,
  FaClock,
  FaTrophy,
  FaStar,
  FaThumbsUp,
  FaHome,
  FaUser,
  FaUsers,
  FaPlay,
  FaVideo,
  FaPause,
  FaStop,
  FaSpinner,
  FaFlag,
  FaCog
} from 'react-icons/fa'
import { IconType } from 'react-icons'
import { getIconById } from './categoryIcons'

/**
 * Fonction pour obtenir l'icône d'une catégorie par son ID
 * Note: Cette fonction est utilisée pour les catégories qui ont déjà leur icône stockée
 * dans le champ emoji. Utilisez getIconById directement si vous avez l'ID de l'icône.
 */
export function getCategoryIcon(categoryId: string): IconType {
  // Cette fonction est maintenant obsolète - utilisez getIconById avec category.emoji
  // On garde pour compatibilité mais elle retourne toujours FaQuestionCircle
  // car les catégories stockent maintenant l'ID de l'icône dans emoji
  return FaQuestionCircle
}

/**
 * Icônes pour les actions et états
 */
export const UI_ICONS = {
  settings: FaCog,
  check: FaCheckCircle,
  error: FaTimesCircle,
  warning: FaExclamationTriangle,
  hint: FaLightbulb,
  timer: FaClock,
  trophy: FaTrophy,
  star: FaStar,
  thumbsUp: FaThumbsUp,
  home: FaHome,
  user: FaUser,
  users: FaUsers,
  play: FaPlay,
  video: FaVideo,
  pause: FaPause,
  stop: FaStop,
  loading: FaSpinner,
  flag: FaFlag,
} as const

/**
 * Messages de score sans emojis
 */
export const SCORE_MESSAGES = {
  perfect: 'Parfait !',
  excellent: 'Excellent !',
  good: 'Bien joué !',
  notBad: 'Pas mal !',
  continue: 'Continue comme ça !',
} as const

