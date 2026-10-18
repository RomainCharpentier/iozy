/**
 * Back to where the gate was opened from.
 *
 * Another app of the site (IozyPlay) sends here to sign in with
 * `/core/?next=/play/...`: once signed in, the person goes back there. The
 * parameter comes from the address bar, so only a path of THIS site is
 * accepted - never another origin, never a scheme: a sign-in page that
 * forwards anywhere is a phishing tool.
 */
const BACKSLASH = String.fromCharCode(92)

export function destinationApresConnexion(search: string): string | null {
  const next = new URLSearchParams(search).get('next')
  if (!next || !next.startsWith('/')) return null
  // A second `/` or a backslash would make the browser read a host name.
  const second = next.charAt(1)
  if (second === '/' || second === BACKSLASH) return null
  return next
}

/** Leaves for the destination when there is one. Returns whether it did. */
export function retournerApresConnexion(): boolean {
  const destination = destinationApresConnexion(window.location.search)
  if (!destination) return false
  window.location.assign(destination)
  return true
}
