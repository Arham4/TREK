import { CircleDot, Flag, Hotel, MapPin, ParkingCircle, Ticket, UtensilsCrossed } from 'lucide-react'
import type { Place, Reservation } from '../../types'
import { TRANSPORT_META, type TransportType } from './transportHops'

/** A non-transport booking that has somewhere on the map to stand. */
export interface BookingPoint {
  res: Reservation
  lat: number
  lng: number
  name: string
  type: string
}

/** Icon and colour of each kind of point booking, shared by both renderers. */
export const BOOKING_POINT_META: Record<string, { icon: typeof MapPin; color: string }> = {
  hotel: { icon: Hotel, color: '#4f46e5' },
  restaurant: { icon: UtensilsCrossed, color: '#e11d48' },
  event: { icon: Ticket, color: '#d97706' },
  tour: { icon: Flag, color: '#0d9488' },
  parking: { icon: ParkingCircle, color: '#475569' },
  other: { icon: CircleDot, color: '#6b7280' }, // theme-lint-disable: fallback type colour, as on the booking cards
}

/** Whether a booking draws a route (and its endpoints) rather than a single pin. */
export function isTransportBooking(r: Reservation): boolean {
  return (r.type as TransportType) in TRANSPORT_META
}

/**
 * The coordinate a booking stands at when it draws no route.
 *
 * A booking knows its spot in one of two ways: the place it links (a restaurant,
 * a tour, a hotel's place) or a geocoded endpoint (an imported venue). Nothing
 * here looks at the street address text — guessing coordinates from it would put
 * a pin in the wrong city more often than it would help.
 */
export function bookingPointOf(r: Reservation, placesById: Map<number, Place>): { lat: number; lng: number } | null {
  // A hotel knows its spot two ways: the stay's place and its own place link.
  // On a copied trip the stay link can dangle at the source trip's stay (whose
  // place id is absent from this trip's places map), so a missed accommodation
  // lookup falls back to the booking's own place instead of giving up the pin.
  // Either link still needs real coordinates; only the geocoded endpoints are
  // consulted after both links miss.
  const candidates: (number | null | undefined)[] =
    r.type === 'hotel' ? [r.accommodation_place_id, r.place_id] : [r.place_id]
  for (const placeId of candidates) {
    const place = placeId != null ? placesById.get(placeId) : undefined
    if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      return { lat: place.lat as number, lng: place.lng as number }
    }
  }
  const endpoints = (r.endpoints || [])
    .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng))
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  const first = endpoints[0]
  return first ? { lat: first.lat, lng: first.lng } : null
}

/**
 * Every booking that should stand as a pin on the plan map: tours, activities,
 * hotels and restaurants with a linked place or a geocoded endpoint. Transports
 * are left to the route overlay — their endpoints already draw there.
 */
export function bookingPoints(reservations: readonly Reservation[] | undefined, places: readonly Place[] | undefined): BookingPoint[] {
  const placesById = new Map((places || []).map(p => [p.id, p]))
  const out: BookingPoint[] = []
  for (const r of reservations || []) {
    if (isTransportBooking(r)) continue
    const at = bookingPointOf(r, placesById)
    if (!at) continue
    out.push({
      res: r,
      lat: at.lat,
      lng: at.lng,
      name: r.title || (r.type === 'hotel' ? (r.accommodation_name || r.place_name) : (r.place_name || r.location)) || '',
      type: r.type,
    })
  }
  return out
}
