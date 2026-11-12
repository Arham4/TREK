// FE-PLANNER-BOOKCARD-001 to FE-PLANNER-BOOKCARD-003
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '../../../../tests/helpers/render'
import BookingCard from './BookingCard'
import { bookingFacts, type FactsContext } from './bookingFacts'
import { buildReservation } from '../../../../tests/helpers/factories'
import type { Reservation } from '../../../types'

const t: FactsContext['t'] = (key, params) => (params && 'count' in params ? `${key}#${params.count}` : key)

function ctx(over: Partial<FactsContext> = {}): FactsContext {
  return {
    t, locale: 'en-US', timeFormat: '24h', days: [], assignmentLookup: {},
    tripCurrency: 'EUR', hasLinkedCost: false, ...over,
  }
}

/** A two-night stay whose dates come from the booking's own timestamps. */
function stay(): Reservation {
  return buildReservation({
    type: 'hotel',
    reservation_time: '2026-11-17T15:00',
    reservation_end_time: '2026-11-19T11:00',
    metadata: JSON.stringify({ check_in_time: '15:00', check_out_time: '11:00' }),
  })
}

function mount(r: Reservation) {
  return render(
    <BookingCard
      r={r}
      facts={bookingFacts(r, ctx())}
      files={[]}
      costs={[]}
      tripId={1}
      canEdit={false}
      selected={false}
      onSelect={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onToggleStatus={vi.fn()}
      contributions={[]}
      detailPlugins={[]}
      showFrames={false}
    />,
  )
}

describe('BookingCard stay dates', () => {
  it('FE-PLANNER-BOOKCARD-001: a hotel card leads with check-in and check-out dates, not a clock time', () => {
    mount(stay())
    const band = screen.getByTestId('booking-stay-dates')
    expect(within(band).getByText('Nov 17')).toBeInTheDocument()
    expect(within(band).getByText('Nov 19')).toBeInTheDocument()
    expect(screen.getByText('Check-in 15:00')).toBeInTheDocument()
    expect(screen.getByText('Check-out 11:00')).toBeInTheDocument()
  })

  it('FE-PLANNER-BOOKCARD-002: the nights between the two dates are counted on the card', () => {
    mount(stay())
    const band = screen.getByTestId('booking-stay-dates')
    expect(within(band).getByText('2')).toBeInTheDocument()
    expect(within(band).getByText(/Nights/)).toBeInTheDocument()
  })

  it('FE-PLANNER-BOOKCARD-003: a non-stay keeps the ordinary date/time fields', () => {
    const train = buildReservation({
      type: 'train',
      reservation_time: '2026-11-17T09:20',
      reservation_end_time: '2026-11-17T11:05',
    })
    mount(train)
    expect(screen.queryByTestId('booking-stay-dates')).toBeNull()
  })
})
