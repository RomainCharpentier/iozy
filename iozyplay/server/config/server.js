/**
 * Configuration du serveur Express
 */

import express from 'express';
import cors from 'cors';

export function createExpressApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Routes API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}






