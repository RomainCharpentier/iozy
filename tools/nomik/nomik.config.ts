import { defineConfig } from '@nomik/core';

export default defineConfig({
  target: {
    // Le dépôt entier (ce fichier vit sous tools/nomik/).
    root: '../..',
    include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.md', '**/*.py', '**/*.rs'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts', '**/__pycache__/**', '**/target/**', '**/.venv/**'],
  },
  // Graph connection reads from .env (NOMIK_GRAPH_URI, NOMIK_GRAPH_USER, NOMIK_GRAPH_PASS)
  parser: {
    languages: ['typescript', 'python', 'rust'],
  },
});
