/**
 * Configuration du serveur Express
 */

import path from 'path';
import express from 'express';
import cors from 'cors';
import { getAllQuestions, createQuestion, removeQuestion, updateAllQuestions } from '../handlers/questionHandlers.js';
import { getAllCategories, createCategory, updateCategoryHandler, removeCategory } from '../handlers/categoryHandlers.js';
import { getPlaylistVideos, getVideoDuration } from '../handlers/youtubeHandlers.js';
import { getProfileHandler, createOrUpdateProfileHandler, deleteProfileHandler } from '../handlers/profileHandlers.js';

/**
 * @param basePath  le préfixe sous lequel tout est servi : '' à la racine,
 *                  '/play' quand IozyPlay vit à côté d'IozyCore (voir index.js)
 * @param staticDir le front construit à servir par ce serveur (image Docker) ;
 *                  null en dev, où Vite sert le front
 */
export function createExpressApp({ basePath = '', staticDir = null } = {}) {
  const app = express();

  // Configuration CORS pour production et développement
  const corsOptions = process.env.NODE_ENV === 'production'
    ? {
        origin: process.env.FRONTEND_URL || true, // Accepter l'URL du frontend ou toutes si non définie
        credentials: true
      }
    : {
        origin: true, // En développement, accepter toutes les origines
        credentials: true
      };

  app.use(cors(corsOptions));
  app.use(express.json());

  // Les routes API, montées sous le préfixe : le front les appelle en relatif.
  const api = express.Router();
  api.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Questions
  api.get('/questions', getAllQuestions);
  api.post('/questions', createQuestion);
  api.delete('/questions/:id', removeQuestion);
  api.put('/questions', updateAllQuestions);

  // Catégories
  api.get('/categories', getAllCategories);
  api.post('/categories', createCategory);
  api.put('/categories/:id', updateCategoryHandler);
  api.delete('/categories/:id', removeCategory);

  // YouTube
  api.get('/youtube/playlist/:playlistId', getPlaylistVideos);
  api.get('/youtube/duration/:videoId', getVideoDuration);

  // Profils
  api.get('/profile/:playerId', getProfileHandler);
  api.post('/profile', createOrUpdateProfileHandler);
  api.delete('/profile/:playerId', deleteProfileHandler);

  app.use(`${basePath}/api`, api);

  // Le front construit : les fichiers, puis index.html pour toute autre route
  // de l'app (React Router prend le relais). Vite a construit ces fichiers
  // avec le même préfixe (vite.config.ts, `base`).
  if (staticDir) {
    const mount = basePath || '/';
    app.use(mount, express.static(staticDir));
    app.use(mount, (req, res) => res.sendFile(path.resolve(staticDir, 'index.html')));
  }

  return app;
}







