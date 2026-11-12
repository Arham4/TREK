// FE-COMP-BOOKINGPOINTS-001 to FE-COMP-BOOKINGPOINTS-006
import { describe, expect, it } from 'vitest'
import { buildPlace, buildReservation } from '../../../tests/helpers/factories'
import { bookingPointOf, bookingPoints, isTransportBooking } from './bookingPoints'

const hotelPlace = buildPlace({ id: 21, name: 'Hotel Lutetia', lat: 48.85, lng: 2.32 })
const tourPlace = buildPlace({ id: 22, name: 'Louvre', lat: 48.86, lng: 2.33 })
const places = [hotelPlace, tourPlace]
const byId = new Map(places.map(p => [p.id, p]))

describe('bookingPoints', () => {
  it('FE-COMP-BOOKINGPOINTS-001: a transport draws no pin of its own', () => {
    expect(isTransportBooking(buildReservation({ type: 'flight' }))).toBe(true)
    expect(isTransportBooking(buildReservation({ type: 'hotel' }))).toBe(false)
    expect(bookingPoints([buildReservation({ type: 'train', place_id: 22 })], places)).toEqual([])
  })

  it('FE-COMP-BOOKINGPOINTS-002: a hotel takes its accommodation place, then its own place', () => {
    const stay = buildReservation({ type: 'hotel', accommodation_place_id: 21, place_id: null })
    expect(bookingPointOf(stay, byId)).toEqual({ lat: 48.85, lng: 2.32 })
    const byPlace = buildReservation({ type: 'hotel', accommodation_place_id: null, place_id: 22 })
    expect(bookingPointOf(byPlace, byId)).toEqual({ lat: 48.86, lng: 2.33 })
  })

  it('FE-COMP-BOOKINGPOINTS-003: a tour or restaurant stands on its linked place', () => {
    const points = bookingPoints([
      buildReservation({ id: 1, type: 'tour', place_id: 22, title: 'Louvre tour' }),
      buildReservation({ id: 2, type: 'restaurant', place_id: 21, title: 'Dinner' }),
    ], places)
    expect(points.map(p => [p.res.id, p.lat, p.lng])).toEqual([[1, 48.86, 2.33], [2, 48.85, 2.32]])
    expect(points[0].name).toBe('Louvre tour')
  })

  it('FE-COMP-BOOKINGPOINTS-004: an imported venue without a place uses its geocoded endpoint', () => {
    const imported = buildReservation({
      type: 'event',
      endpoints: [
        { role: 'from', sequence: 0, name: 'Venue', code: null, lat: 51.5, lng: -0.12, timezone: null, local_time: null, local_date: null },
        { role: 'from', sequence: 0, name: 'No coords', code: null, lat: Number.NaN, lng: Number.NaN, timezone: null, local_time: null, local_date: null },
      ],
    })
    expect(bookingPointOf(imported, byId)).toEqual({ lat: 51.5, lng: -0.12 })
  })

  it('FE-COMP-BOOKINGPOINTS-005: a place without coordinates does not invent a pin', () => {
    const bare = buildPlace({ id: 23, name: 'Somewhere', lat: null, lng: null })
    const r = buildReservation({ type: 'hotel', place_id: 23 })
    expect(bookingPointOf(r, new Map([[23, bare]]))).toBeNull()
    expect(bookingPoints([r], [bare])).toEqual([])
  })

  it('FE-COMP-BOOKINGPOINTS-006: a hotel pin is named after its booking title', () => {
    const points = bookingPoints([
      buildReservation({ type: 'hotel', place_id: 21, accommodation_name: 'Lutetia', title: 'Booking' }),
    ], places)
    expect(points[0].name).toBe('Booking')
    expect(points[0].type).toBe('hotel')
  })

  it('FE-COMP-BOOKINGPOINTS-007: a cloned trip hotel falls back to its own place when the stay link dangles', () => {
    // Trip 11's hotels kept accommodation_place_id values (1.0–10.0) pointing at
    // Trip 8's stays, whose place ids are absent from Trip 11's places map.
    // The pin must stand on the booking's own place instead of vanishing.
    const ghost = buildReservation({ type: 'hotel', accommodation_place_id: 999, place_id: 22 })
    expect(bookingPointOf(ghost, byId)).toEqual({ lat: 48.86, lng: 2.33 })
    // Both links missing still falls through to the geocoded endpoints.
    const endpointOnly = buildReservation({
      type: 'hotel',
      accommodation_place_id: 999,
      place_id: null,
      endpoints: [
        { role: 'from', sequence: 0, name: 'Venue', code: null, lat: 51.5, lng: -0.12, timezone: null, local_time: null, local_date: null },
      ],
    })
    expect(bookingPointOf(endpointOnly, byId)).toEqual({ lat: 51.5, lng: -0.12 })
  })
})
