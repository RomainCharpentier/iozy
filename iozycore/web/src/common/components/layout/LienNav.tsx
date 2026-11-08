import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { NavItem } from './navItems'

/**
 * One destination of the bars: a router link inside this app, a plain link to
 * another app of the site (each app has its own router and base path).
 *
 * <p>`Link` and not `NavLink`: NavLink recomputes `aria-current` from ITS
 * route match and would overwrite the one `activeWhen` decided.
 */
export function LienNav({
  item,
  active,
  className,
  children,
}: {
  item: NavItem
  active: boolean
  className: string
  children: ReactNode
}) {
  if (item.href) {
    return (
      <a href={item.href} className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={item.to ?? '/'} state={item.state} aria-current={active ? 'page' : undefined} className={className}>
      {children}
    </Link>
  )
}
