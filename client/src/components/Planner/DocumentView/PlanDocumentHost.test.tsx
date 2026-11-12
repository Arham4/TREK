import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '../../../../tests/helpers/render'
import PlanDocumentHost from './PlanDocumentHost'
import type { Trip, Day, Place, Category, AssignmentsMap } from '../../../../types'

const MOCK_TRIP: Trip = {
  id: 101,
  title: 'Autumn in Kyoto',
  start_date: '2026-10-14',
  end_date: '2026-10-20',
  currency: 'JPY',
  user_id: 1,
  created_at: '2026-01-01',
}

const MOCK_DAYS: Day[] = [
  { id: 1, trip_id: 101, day_number: 1, date: '2026-10-14', title: 'Arrival & Gion' },
  { id: 2, trip_id: 101, day_number: 2, date: '2026-10-15', title: 'Arashiyama Bamboo Grove' },
]

const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Sight', color: '#3b82f6', icon: 'camera' },
  { id: 2, name: 'Food', color: '#ef4444', icon: 'utensils' },
]

const MOCK_PLACES: Place[] = [
  { id: 10, trip_id: 101, name: 'Kinkaku-ji', category_id: 1, lat: 35.0394, lng: 135.7292, address: 'Kyoto, Japan' },
  { id: 11, trip_id: 101, name: 'Gion Karyo', category_id: 2, lat: 35.0037, lng: 135.7772, address: 'Gion, Kyoto' },
  { id: 12, trip_id: 101, name: 'Fushimi Inari Shrine', category_id: 1, lat: 34.9671, lng: 135.7727, address: 'Fushimi, Kyoto' },
]

const MOCK_ASSIGNMENTS: AssignmentsMap = {
  '1': [
    {
      id: 501,
      day_id: 1,
      place_id: 10,
      order_index: 0,
      place: MOCK_PLACES[0],
      place_time: '14:00',
      notes: 'Remember to see the golden reflection in the pond.',
    },
    {
      id: 502,
      day_id: 1,
      place_id: 11,
      order_index: 1,
      place: MOCK_PLACES[1],
      place_time: '19:00',
      notes: 'Kaiseki reservation under Smith.',
    },
  ],
  '2': [],
}

describe('PlanDocumentHost', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('FE-DOCVIEW-001: returns null when master feature flag is disabled', () => {
    localStorage.setItem('trek_doc_view_enabled', 'false')
    const { container } = render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('FE-DOCVIEW-002: renders floating button when in map mode', () => {
    localStorage.setItem('trek_plan_view_mode', 'map')
    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )

    const switchBtn = screen.getByRole('button', { name: /Document Plan/i })
    expect(switchBtn).toBeInTheDocument()
    expect(screen.queryByTestId('plan-document-stage')).not.toBeInTheDocument()
  })

  it('FE-DOCVIEW-003: clicking the floating pill switches into Document mode', () => {
    localStorage.setItem('trek_plan_view_mode', 'map')
    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )

    const switchBtn = screen.getByRole('button', { name: /Document Plan/i })
    fireEvent.click(switchBtn)

    expect(screen.getByTestId('plan-document-stage')).toBeInTheDocument()
    // The title appears in the hero and in the outline rail.
    expect(screen.getAllByText('Autumn in Kyoto').length).toBeGreaterThan(0)
    expect(screen.getByText('Kinkaku-ji')).toBeInTheDocument()
    expect(screen.getByText('Gion Karyo')).toBeInTheDocument()
    expect(screen.getByText('Remember to see the golden reflection in the pond.')).toBeInTheDocument()
  })

  it('FE-DOCVIEW-004: clicking "Map View" in document view returns to map mode', () => {
    localStorage.setItem('trek_plan_view_mode', 'document')
    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )

    expect(screen.getByTestId('plan-document-stage')).toBeInTheDocument()

    // Find the Map View switcher button
    const toMapBtns = screen.getAllByRole('button', { name: /Map View|View on map/i })
    fireEvent.click(toMapBtns[0])

    expect(screen.queryByTestId('plan-document-stage')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Document Plan/i })).toBeInTheDocument()
  })

  it('FE-DOCVIEW-005: Alt+D shortcut toggles between Map and Document mode', () => {
    localStorage.setItem('trek_plan_view_mode', 'map')
    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )

    expect(screen.queryByTestId('plan-document-stage')).not.toBeInTheDocument()

    // Fire Alt+D
    fireEvent.keyDown(window, { key: 'd', altKey: true })
    expect(screen.getByTestId('plan-document-stage')).toBeInTheDocument()

    // Fire Alt+D again
    fireEvent.keyDown(window, { key: 'd', altKey: true })
    expect(screen.queryByTestId('plan-document-stage')).not.toBeInTheDocument()
  })

  it('FE-DOCVIEW-006: clicking a place calls onPlaceClick with place and assignment IDs', () => {
    localStorage.setItem('trek_plan_view_mode', 'document')
    const handlePlaceClick = vi.fn()

    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
        onPlaceClick={handlePlaceClick}
      />
    )

    const placeTitle = screen.getByText('Kinkaku-ji')
    fireEvent.click(placeTitle)

    expect(handlePlaceClick).toHaveBeenCalledWith(10, 501)
  })

  it('FE-DOCVIEW-007: shows unassigned places count and opens unassigned drawer', () => {
    localStorage.setItem('trek_plan_view_mode', 'document')
    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )

    // Fushimi Inari Shrine is unassigned (not in MOCK_ASSIGNMENTS)
    const unassignedButtons = screen.getAllByRole('button', { name: /Unassigned Places|Unplanned/i })
    fireEvent.click(unassignedButtons[0])

    expect(screen.getByText('Unassigned Places & Ideas')).toBeInTheDocument()
    expect(screen.getByText('Fushimi Inari Shrine')).toBeInTheDocument()
  })

  it('FE-DOCVIEW-009: the print flow class follows the visible view, not the saved preference', () => {
    localStorage.setItem('trek_plan_view_mode', 'map')
    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )
    expect(document.body.classList.contains('trek-doc-print')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Document Plan/i }))
    expect(document.body.classList.contains('trek-doc-print')).toBe(true)

    fireEvent.click(screen.getAllByRole('button', { name: /Map View|View on map/i })[0])
    expect(document.body.classList.contains('trek-doc-print')).toBe(false)
  })

  it('FE-DOCVIEW-010: the phone outline button opens the drawer and a day closes it', () => {
    localStorage.setItem('trek_plan_view_mode', 'document')
    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
      />
    )

    expect(screen.queryByTestId('doc-mobile-outline-drawer')).toBeNull()
    fireEvent.click(screen.getByTestId('doc-mobile-outline-toggle'))
    expect(screen.getByTestId('doc-mobile-outline-drawer')).toBeInTheDocument()

    fireEvent.click(within(screen.getByTestId('doc-mobile-outline-drawer')).getAllByText('Arashiyama Bamboo Grove')[0])
    expect(screen.queryByTestId('doc-mobile-outline-drawer')).toBeNull()
  })

  it('FE-DOCVIEW-008: handles transport reservations and accommodations safely without errors', () => {
    localStorage.setItem('trek_plan_view_mode', 'document')
    const mockReservations = [
      {
        id: 701,
        trip_id: 101,
        day_id: 1,
        type: 'flight',
        carrier: 'Japan Airlines',
        reservation_code: 'JL123',
        location: 'KIX -> ITM',
        assignment_id: 501,
      },
      {
        id: 702,
        trip_id: 101,
        day_id: 1,
        type: 'hotel',
        place_name: 'Ryokan Kyoto',
        start_day_id: 1,
        end_day_id: 2,
        check_in: '15:00',
        check_out: '11:00',
      },
    ] as any

    render(
      <PlanDocumentHost
        tripId={101}
        trip={MOCK_TRIP}
        days={MOCK_DAYS}
        places={MOCK_PLACES}
        categories={MOCK_CATEGORIES}
        assignments={MOCK_ASSIGNMENTS}
        reservations={mockReservations}
      />
    )

    expect(screen.getByTestId('plan-document-stage')).toBeInTheDocument()
    expect(screen.getAllByText('Autumn in Kyoto').length).toBeGreaterThan(0)
  })
})
