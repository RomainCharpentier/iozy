import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import './styles/category-manager.css'
import './styles/design-system.css'
import './styles/game-layout.css'
import './styles/settings.css'
import './styles/responsive.css'
import './services/settingsService' // Initialiser les settings au démarrage

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)






