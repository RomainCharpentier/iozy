import { del, post } from './client'
import type { CalendarSubscriptionDto } from '@/common/types/api'

/** The active calendar link, created when there is none. Idempotent: the same link comes back until revoked. */
export function subscribeToCalendar(): Promise<CalendarSubscriptionDto> {
  return post<CalendarSubscriptionDto>('/calendar/subscription')
}

/** Revokes the link at once: agendas stop receiving releases, and the next link is a new one. */
export function revokeCalendarSubscription(): Promise<void> {
  return del<void>('/calendar/subscription')
}
