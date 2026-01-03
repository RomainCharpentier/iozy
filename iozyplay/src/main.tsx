import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/design-tokens.css' // Design tokens en premier
import './styles/index.css'
import './styles/category-manager.css'
import './styles/category-selector.css'
import './styles/confirm-dialog.css'
import './styles/design-system.css'
import './styles/game-layout.css'
import './styles/answer-input.css'
import './styles/settings.css'
import './styles/settings-menu.css'
import './styles/responsive.css'
import './styles/logo.css'
import './styles/error-boundary.css'
import './services/settingsService' // Initialiser les settings au démarrage
import { registerServiceWorker } from './utils/serviceWorker'

// Enregistrer le service worker pour le cache offline
// En développement aussi pour tester
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)






