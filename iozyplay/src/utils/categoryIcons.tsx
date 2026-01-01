/**
 * Liste d'icônes disponibles pour les catégories
 * Permet de sélectionner directement des icônes react-icons
 */
import { 
  FaMusic, 
  FaTv, 
  FaFilm, 
  FaGamepad,
  FaQuestionCircle,
  FaBook,
  FaFutbol,
  FaCar,
  FaPizzaSlice,
  FaStar,
  FaHeart,
  FaGift,
  FaMobileAlt,
  FaHome,
  FaGraduationCap,
  FaGlobe,
  FaMountain,
  FaPalette,
  FaCamera,
  FaVideo,
  FaHeadphones,
  FaMicrophone,
  FaLaptop,
  FaDesktop,
  FaKeyboard,
  FaPhone,
  FaBuilding,
  FaMap,
  FaCompass,
  FaFire,
  FaSnowflake,
  FaRocket,
  FaTrophy,
  FaMedal,
  FaBookOpen,
  FaCrown,
  FaGlasses,
  FaCoins,
  FaChess,
  FaFlag,
  FaShip,
  FaPlane,
  FaTrain,
  FaBicycle,
  FaMotorcycle,
  FaBus,
  FaTaxi,
  FaDog,
  FaCat,
  FaHorse,
  FaFish,
} from 'react-icons/fa'
import { 
  GiNinjaMask,
  GiJapan,
  GiTempleGate,
  GiBamboo,
  GiCardPlay,
  GiPinata,
  GiTheater,
  GiGuitar,
  GiDrum,
  GiHamburger,
  GiDogBowl,
  GiCat,
  GiFox,
  GiBearFace,
  GiPanda,
  GiTiger,
  GiLion,
  GiElephant,
  GiMonkey,
  GiRabbit,
  GiSoccerBall,
  GiTennisRacket,
  GiBasketballBasket,
  GiAmericanFootballBall,
  GiBaseballBat,
  GiVolleyballBall,
  GiPizzaSlice,
  GiCookie,
  GiCakeSlice,
} from 'react-icons/gi'
import { IconType } from 'react-icons'

/**
 * Définition d'une icône de catégorie
 */
export interface CategoryIcon {
  id: string
  name: string
  icon: IconType
  group: string
}

/**
 * Liste complète des icônes disponibles pour les catégories
 */
export const CATEGORY_ICONS: CategoryIcon[] = [
  // Musique
  { id: 'FaMusic', name: 'Musique', icon: FaMusic, group: 'Musique' },
  { id: 'FaMicrophone', name: 'Micro', icon: FaMicrophone, group: 'Musique' },
  { id: 'FaHeadphones', name: 'Casque', icon: FaHeadphones, group: 'Musique' },
  { id: 'GiGuitar', name: 'Guitare', icon: GiGuitar, group: 'Musique' },
  { id: 'GiDrum', name: 'Batterie', icon: GiDrum, group: 'Musique' },
  
  // TV & Films
  { id: 'FaTv', name: 'TV', icon: FaTv, group: 'Média' },
  { id: 'FaFilm', name: 'Film', icon: FaFilm, group: 'Média' },
  { id: 'FaVideo', name: 'Vidéo', icon: FaVideo, group: 'Média' },
  { id: 'FaCamera', name: 'Photo', icon: FaCamera, group: 'Média' },
  { id: 'GiTheater', name: 'Théâtre', icon: GiTheater, group: 'Média' },
  
  // Jeux
  { id: 'FaGamepad', name: 'Jeu vidéo', icon: FaGamepad, group: 'Jeux' },
  { id: 'GiCardPlay', name: 'Carte', icon: GiCardPlay, group: 'Jeux' },
  { id: 'FaChess', name: 'Échecs', icon: FaChess, group: 'Jeux' },
  
  // Livres & Éducation
  { id: 'FaBook', name: 'Livre', icon: FaBook, group: 'Éducation' },
  { id: 'FaBookOpen', name: 'Livre ouvert', icon: FaBookOpen, group: 'Éducation' },
  { id: 'FaGraduationCap', name: 'Diplôme', icon: FaGraduationCap, group: 'Éducation' },
  
  // Sports
  { id: 'FaFutbol', name: 'Football', icon: FaFutbol, group: 'Sports' },
  { id: 'GiSoccerBall', name: 'Football', icon: GiSoccerBall, group: 'Sports' },
  { id: 'GiBasketballBasket', name: 'Basketball', icon: GiBasketballBasket, group: 'Sports' },
  { id: 'GiAmericanFootballBall', name: 'Football américain', icon: GiAmericanFootballBall, group: 'Sports' },
  { id: 'GiBaseballBat', name: 'Baseball', icon: GiBaseballBat, group: 'Sports' },
  { id: 'GiTennisRacket', name: 'Tennis', icon: GiTennisRacket, group: 'Sports' },
  { id: 'GiVolleyballBall', name: 'Volleyball', icon: GiVolleyballBall, group: 'Sports' },
  
  // Nourriture
  { id: 'FaPizzaSlice', name: 'Pizza', icon: FaPizzaSlice, group: 'Nourriture' },
  { id: 'GiHamburger', name: 'Hamburger', icon: GiHamburger, group: 'Nourriture' },
  { id: 'GiPizzaSlice', name: 'Pizza', icon: GiPizzaSlice, group: 'Nourriture' },
  { id: 'GiCookie', name: 'Cookie', icon: GiCookie, group: 'Nourriture' },
  { id: 'GiCakeSlice', name: 'Gâteau', icon: GiCakeSlice, group: 'Nourriture' },
  
  // Transport
  { id: 'FaCar', name: 'Voiture', icon: FaCar, group: 'Transport' },
  { id: 'FaShip', name: 'Bateau', icon: FaShip, group: 'Transport' },
  { id: 'FaPlane', name: 'Avion', icon: FaPlane, group: 'Transport' },
  { id: 'FaTrain', name: 'Train', icon: FaTrain, group: 'Transport' },
  { id: 'FaBicycle', name: 'Vélo', icon: FaBicycle, group: 'Transport' },
  { id: 'FaMotorcycle', name: 'Moto', icon: FaMotorcycle, group: 'Transport' },
  { id: 'FaBus', name: 'Bus', icon: FaBus, group: 'Transport' },
  { id: 'FaTaxi', name: 'Taxi', icon: FaTaxi, group: 'Transport' },
  
  // Animaux
  { id: 'GiDogBowl', name: 'Chien', icon: GiDogBowl, group: 'Animaux' },
  { id: 'GiCat', name: 'Chat', icon: GiCat, group: 'Animaux' },
  { id: 'GiFox', name: 'Renard', icon: GiFox, group: 'Animaux' },
  { id: 'GiBearFace', name: 'Ours', icon: GiBearFace, group: 'Animaux' },
  { id: 'GiPanda', name: 'Panda', icon: GiPanda, group: 'Animaux' },
  { id: 'GiTiger', name: 'Tigre', icon: GiTiger, group: 'Animaux' },
  { id: 'GiLion', name: 'Lion', icon: GiLion, group: 'Animaux' },
  { id: 'GiElephant', name: 'Éléphant', icon: GiElephant, group: 'Animaux' },
  { id: 'FaHorse', name: 'Cheval', icon: FaHorse, group: 'Animaux' },
  { id: 'GiRabbit', name: 'Lapin', icon: GiRabbit, group: 'Animaux' },
  { id: 'FaFish', name: 'Poisson', icon: FaFish, group: 'Animaux' },
  { id: 'FaDog', name: 'Chien', icon: FaDog, group: 'Animaux' },
  { id: 'FaCat', name: 'Chat', icon: FaCat, group: 'Animaux' },
  
  // Géographie & Nature
  { id: 'FaGlobe', name: 'Globe', icon: FaGlobe, group: 'Nature' },
  { id: 'FaMap', name: 'Carte', icon: FaMap, group: 'Nature' },
  { id: 'FaCompass', name: 'Boussole', icon: FaCompass, group: 'Nature' },
  { id: 'FaMountain', name: 'Montagne', icon: FaMountain, group: 'Nature' },
  
  // Émotions & Symboles
  { id: 'FaStar', name: 'Étoile', icon: FaStar, group: 'Symboles' },
  { id: 'FaHeart', name: 'Cœur', icon: FaHeart, group: 'Symboles' },
  { id: 'FaFire', name: 'Feu', icon: FaFire, group: 'Symboles' },
  { id: 'FaTrophy', name: 'Trophée', icon: FaTrophy, group: 'Symboles' },
  { id: 'FaGift', name: 'Cadeau', icon: FaGift, group: 'Symboles' },
  { id: 'FaCrown', name: 'Couronne', icon: FaCrown, group: 'Symboles' },
  { id: 'FaMedal', name: 'Médaille', icon: FaMedal, group: 'Symboles' },
  { id: 'FaCoins', name: 'Pièces', icon: FaCoins, group: 'Symboles' },
  { id: 'FaFlag', name: 'Drapeau', icon: FaFlag, group: 'Symboles' },
  { id: 'FaSnowflake', name: 'Flocon', icon: FaSnowflake, group: 'Symboles' },
  { id: 'FaRocket', name: 'Fusée', icon: FaRocket, group: 'Symboles' },
  
  // Technologie
  { id: 'FaMobileAlt', name: 'Téléphone', icon: FaMobileAlt, group: 'Technologie' },
  { id: 'FaLaptop', name: 'Ordinateur portable', icon: FaLaptop, group: 'Technologie' },
  { id: 'FaDesktop', name: 'Ordinateur', icon: FaDesktop, group: 'Technologie' },
  { id: 'FaKeyboard', name: 'Clavier', icon: FaKeyboard, group: 'Technologie' },
  { id: 'FaPhone', name: 'Téléphone', icon: FaPhone, group: 'Technologie' },
  
  // Lieux
  { id: 'FaHome', name: 'Maison', icon: FaHome, group: 'Lieux' },
  { id: 'FaBuilding', name: 'Bâtiment', icon: FaBuilding, group: 'Lieux' },
  { id: 'GiJapan', name: 'Japon', icon: GiJapan, group: 'Lieux' },
  { id: 'GiTempleGate', name: 'Temple', icon: GiTempleGate, group: 'Lieux' },
  { id: 'GiBamboo', name: 'Bambou', icon: GiBamboo, group: 'Lieux' },
  { id: 'GiPinata', name: 'Piñata', icon: GiPinata, group: 'Lieux' },
  
  // Divers
  { id: 'FaPalette', name: 'Art', icon: FaPalette, group: 'Divers' },
  { id: 'FaGlasses', name: 'Lunettes', icon: FaGlasses, group: 'Divers' },
  { id: 'FaGlasses', name: 'Lunettes de soleil', icon: FaGlasses, group: 'Divers' },
  { id: 'FaQuestionCircle', name: 'Question', icon: FaQuestionCircle, group: 'Divers' },
  { id: 'GiNinjaMask', name: 'Ninja', icon: GiNinjaMask, group: 'Divers' },
]

/**
 * Obtient une icône par son ID
 */
export function getIconById(iconId: string): IconType {
  const iconDef = CATEGORY_ICONS.find(icon => icon.id === iconId)
  return iconDef ? iconDef.icon : FaQuestionCircle
}

/**
 * Obtient une icône par son ID (retourne la définition complète)
 */
export function getIconDefinition(iconId: string): CategoryIcon | undefined {
  return CATEGORY_ICONS.find(icon => icon.id === iconId)
}
