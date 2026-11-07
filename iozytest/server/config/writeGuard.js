/**
 * Garde des écritures REST de la banque de questions (questions, catégories).
 *
 * Une écriture passe dans l'un de ces cas, dans cet ordre :
 *  1. l'en-tête `X-Iozytest-Admin-Token` vaut `IOZYTEST_ADMIN_TOKEN` (scripts,
 *     IozyTest seul sans IozyCore) ;
 *  2. le cookie de la requête ouvre un compte Iozy non invité : on le relaie à
 *     `${IOZYCORE_API_URL}/api/auth/me` (même site, le cookie suit sous /test) ;
 *  3. hors production, si aucun jeton n'est réglé : tout passe, avec un
 *     avertissement dans le journal (dev local).
 * Sinon : 401 avec un message en français. Les lectures (GET) ne sont pas
 * gardées ici.
 */

import { timingSafeEqual } from 'crypto';

const TOKEN_HEADER = 'x-iozytest-admin-token';
const DEFAULT_IOZYCORE_API_URL = 'http://iozycore-api:8080';
const ME_TIMEOUT_MS = 3000;

export const UNAUTHORIZED_MESSAGE =
  'Connecte-toi à ton compte Iozy pour modifier les questions et les catégories.';

function sameToken(given, expected) {
  if (typeof given !== 'string' || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vrai si le cookie ouvre un compte Iozy non invité ; faux sur toute erreur. */
async function hasIozyAccount(cookie, apiUrl, fetchImpl) {
  if (!cookie) return false;
  try {
    const response = await fetchImpl(`${apiUrl.replace(/\/+$/, '')}/api/auth/me`, {
      headers: { cookie, accept: 'application/json' },
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });
    if (response.status !== 200) return false;
    const account = await response.json();
    return !!account && account.invite === false;
  } catch {
    return false;
  }
}

/**
 * @param env       les variables lues (process.env par défaut ; injectables en test)
 * @param fetchImpl le fetch utilisé pour joindre IozyCore (injectable en test)
 * @param log       où écrire l'avertissement du mode ouvert
 */
export function createWriteGuard({ env = process.env, fetchImpl = globalThis.fetch, log = console.warn } = {}) {
  const token = env.IOZYTEST_ADMIN_TOKEN || '';
  const apiUrl = env.IOZYCORE_API_URL || DEFAULT_IOZYCORE_API_URL;
  const openInDev = env.NODE_ENV !== 'production' && !token;
  let warned = false;

  return async function writeGuard(req, res, next) {
    // Une écriture avec un corps doit être du JSON : un formulaire d'un autre
    // site (requête « simple », sans pré-vol CORS) ne passe pas.
    if (req.method !== 'DELETE' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Le corps de la requête doit être du JSON.' });
    }
    if (token && sameToken(req.get(TOKEN_HEADER), token)) return next();
    if (await hasIozyAccount(req.get('cookie'), apiUrl, fetchImpl)) return next();
    if (openInDev) {
      if (!warned) {
        warned = true;
        log('⚠️  Écritures de la banque de questions ouvertes à tous (hors production, IOZYTEST_ADMIN_TOKEN absent).');
      }
      return next();
    }
    return res.status(401).json({ error: UNAUTHORIZED_MESSAGE });
  };
}
