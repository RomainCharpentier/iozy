import { get } from './client'

/**
 * Which release is running - on the server side, and on the interface side.
 *
 * <h2>Two versions, because there are two images</h2>
 * The API and the web app are built and published separately, then pulled
 * separately by the NAS. They come from the same commit in the vast majority
 * of cases - but not always: a service worker that keeps the old shell,
 * one image out of two that was not pulled, and the screen lies without knowing it.
 * Showing only the server one would present it as the app one,
 * which is wrong exactly when it matters.
 */

/**
 * The release number, frozen when the bundle is compiled (see
 * web/Dockerfile). Outside a container, vite.config.ts derives it from the commits and
 * adds the suffix `-dev` ("1.1.0-dev"): we know which commit we start from, and that we
 * are not looking at a release.
 */
export const VERSION_INTERFACE: string = import.meta.env.VITE_VERSION ?? 'dev'

export interface Version {
  /** The number of the release served by the API, or `dev` outside a container. */
  version: string
}

export function lireVersionServeur(): Promise<Version> {
  return get<Version>('/version')
}

/**
 * What can be read at a glance.
 *
 * A Major.Minor.Patch is already short, and it can be compared - 1.3.1 comes
 * after 1.2.0 - so it comes out as it is. What remains are the forms that cannot be
 * compared and to which we do not invent an order: `dev` outside a container, and the SHA
 * of 40 characters of images built BEFORE any numbering. That one is
 * cut to 7, the short form used by git and GitHub - this is the only case
 * where the app still shows a SHA, and it disappears as soon as the two images have
 * been withdrawn once.
 */
export function versionCourte(version: string): string {
  return /^[0-9a-f]{40}$/.test(version) ? version.slice(0, 7) : version
}

/**
 * A local build is not a release, and so is not compared to
 * anything.
 *
 * `dev` and `1.1.0-dev` come from a workstation: the first from an image
 * built by hand, the second from the development server. Comparing them
 * to what the API returns - "interface 1.1.0-dev, server dev, reload" -
 * would flag a mismatch on every screen while there is nothing to fix: they
 * are two drafts, and they have no reason to match.
 */
export function estUneLivraison(version: string): boolean {
  return !version.endsWith('dev')
}
