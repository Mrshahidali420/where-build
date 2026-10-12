/**
 * One moment as the clock time of thirty countries, for the airing time
 * card (types/airtime.mjs).
 *
 * Every time is worked out by Intl.DateTimeFormat from a real IANA zone, so
 * daylight saving is right for the day in question, not for today. A country
 * with several zones is shown by the one most of its people live in (USA and
 * Canada by Eastern time, Australia by Sydney, Brazil by Sao Paulo, Mexico
 * by Mexico City, Indonesia by Jakarta).
 *
 * Pure: the moment is passed in.
 */
import { dateOf, timeOf } from './when.mjs'

/** In the order the card shows them, column by column. `code` names the flag file (flags/). */
export const COUNTRIES = [
  { code: 'us', name: 'USA', zone: 'America/New_York' },
  { code: 'ca', name: 'Canada', zone: 'America/Toronto' },
  { code: 'mx', name: 'Mexico', zone: 'America/Mexico_City' },
  { code: 'co', name: 'Colombia', zone: 'America/Bogota' },
  { code: 'br', name: 'Brazil', zone: 'America/Sao_Paulo' },
  { code: 'ar', name: 'Argentina', zone: 'America/Argentina/Buenos_Aires' },
  { code: 'gb', name: 'UK', zone: 'Europe/London' },
  { code: 'ie', name: 'Ireland', zone: 'Europe/Dublin' },
  { code: 'fr', name: 'France', zone: 'Europe/Paris' },
  { code: 'es', name: 'Spain', zone: 'Europe/Madrid' },
  { code: 'de', name: 'Germany', zone: 'Europe/Berlin' },
  { code: 'it', name: 'Italy', zone: 'Europe/Rome' },
  { code: 'nl', name: 'Netherlands', zone: 'Europe/Amsterdam' },
  { code: 'ma', name: 'Morocco', zone: 'Africa/Casablanca' },
  { code: 'za', name: 'S. Africa', zone: 'Africa/Johannesburg' },
  { code: 'tr', name: 'Turkey', zone: 'Europe/Istanbul' },
  { code: 'sa', name: 'Saudi Arabia', zone: 'Asia/Riyadh' },
  { code: 'ae', name: 'UAE', zone: 'Asia/Dubai' },
  { code: 'pk', name: 'Pakistan', zone: 'Asia/Karachi' },
  { code: 'in', name: 'India', zone: 'Asia/Kolkata' },
  { code: 'bd', name: 'Bangladesh', zone: 'Asia/Dhaka' },
  { code: 'vn', name: 'Vietnam', zone: 'Asia/Ho_Chi_Minh' },
  { code: 'id', name: 'Indonesia', zone: 'Asia/Jakarta' },
  { code: 'my', name: 'Malaysia', zone: 'Asia/Kuala_Lumpur' },
  { code: 'sg', name: 'Singapore', zone: 'Asia/Singapore' },
  { code: 'ph', name: 'Philippines', zone: 'Asia/Manila' },
  { code: 'kr', name: 'S. Korea', zone: 'Asia/Seoul' },
  { code: 'jp', name: 'Japan', zone: 'Asia/Tokyo' },
  { code: 'au', name: 'Australia', zone: 'Australia/Sydney' },
  { code: 'nz', name: 'New Zealand', zone: 'Pacific/Auckland' },
]

const DAY_MS = 86_400_000
const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY_MS

/**
 * The moment `at` in every country.
 * @param at milliseconds
 * @param base the zone the card's own date is written in; `shift` counts days from that date
 * @returns [{ code, name, zone, time: '8:15 PM', shift: -1 | 0 | 1 }]
 */
export function localTimes(at, base, countries = COUNTRIES) {
  const home = dayNumber(dateOf(at, base))
  return countries.map((c) => ({ ...c, time: timeOf(at, c.zone), shift: dayNumber(dateOf(at, c.zone)) - home }))
}

/** "+1" for the day after the card's date, "-1" for the day before, nothing for the same day. */
export const shiftMark = (shift) => (shift > 0 ? `+${shift}` : shift < 0 ? String(shift) : '')

/** The time in one country by its code, or null. */
export const timeIn = (times, code) => times.find((t) => t.code === code) || null
