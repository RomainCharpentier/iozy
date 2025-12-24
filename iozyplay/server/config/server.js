/**
 * Configuration du serveur Express
 */

import express from 'express';
import cors from 'cors';
import { getAllQuestions, createQuestion, removeQuestion, updateAllQuestions } from '../handlers/questionHandlers.js';
import { getAllCategories, createCategory, updateCategoryHandler, removeCategory } from '../handlers/categoryHandlers.js';

export function createExpressApp() {
  const app = express();

  app.use(cors());
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

  return app;
}







