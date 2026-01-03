/**
 * Configuration du serveur Express
 */

import express from 'express';
import cors from 'cors';
import { getAllQuestions, createQuestion, removeQuestion, updateAllQuestions } from '../handlers/questionHandlers.js';
import { getAllCategories, createCategory, updateCategoryHandler, removeCategory } from '../handlers/categoryHandlers.js';
import { getPlaylistVideos } from '../handlers/youtubeHandlers.js';
import { getProfileHandler, createOrUpdateProfileHandler, deleteProfileHandler } from '../handlers/profileHandlers.js';

export function createExpressApp() {
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

  // Routes API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Routes API Questions
  app.get('/api/questions', getAllQuestions);
  app.post('/api/questions', createQuestion);
  app.delete('/api/questions/:id', removeQuestion);
  app.put('/api/questions', updateAllQuestions);

  // Routes API Categories
  app.get('/api/categories', getAllCategories);
  app.post('/api/categories', createCategory);
  app.put('/api/categories/:id', updateCategoryHandler);
  app.delete('/api/categories/:id', removeCategory);

  // Routes API YouTube
  app.get('/api/youtube/playlist/:playlistId', getPlaylistVideos);

  // Routes API Profiles
  app.get('/api/profile/:playerId', getProfileHandler);
  app.post('/api/profile', createOrUpdateProfileHandler);
  app.delete('/api/profile/:playerId', deleteProfileHandler);

  return app;
}







