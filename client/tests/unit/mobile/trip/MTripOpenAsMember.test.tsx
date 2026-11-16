import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '../../../helpers/render'
import { buildPlanner, buildShell } from '../../../helpers/mobileTrip'
import { resetAllStores, seedStore } from '../../../helpers/store'
import { server } from '../../../helpers/msw/server'
import { buildPackingItem, buildTrip, buildUser } from '../../../helpers/factories'
import { useAuthStore } from '../../../../src/store/authStore'
import { useTripStore } from '../../../../src/store/tripStore'
import MListsTab from '../../../../src/mobile/screens/trip/tabs/MListsTab'

/**
 * Replay of Shanzeh opening trip 8 on her phone: member user, her 18 outfits
 * plus Arham's 17, ~120 packing items across 4 bags, empty store first (the
 * loading paint) then the loaded store (loadTrip landing). Any hook-order
 * crash (React #300/#310) in the lists tabs surfaces here as a throw.
 */

const ARHAM_ID = 2
const SHANZEH_ID = 3

function day(id: number, n: number, date: string, title: string) {
  return { id, trip_id: 8, day_number: n, date, title, notes: null, default_transport_mode: null, assignments: [], notes_items: [] }
}

function outfit(id: number, dayId: number, userId: number, title: string, itemNames: string[], base = 1000) {
  return {
    id, trip_id: 8, day_id: dayId, user_id: userId, title,
    time_of_day: null, notes: null, sort_order: 0,
    items: itemNames.map((name, i) => ({
      id: base + i, outfit_id: id, trip_id: 8, name,
      packing_item_id: null, category: null, sort_order: i,
      packing_item_checked: 0, packing_item_category: null,
    })),
  }
}

describe('trip open as Shanzeh (member) with production-shaped data', () => {
  beforeEach(() => {
    resetAllStores()
    seedStore(useAuthStore, { user: { ...buildUser(), id: SHANZEH_ID, username: 'shanzeh' } as never })
    server.use(
      http.get('/api/trips/:id/members', () =>
        HttpResponse.json({
          owner: { ...buildUser(), id: ARHAM_ID, username: 'Arham' },
          members: [{ ...buildUser(), id: SHANZEH_ID, username: 'shanzeh' }],
        }),
      ),
      http.get('/api/trips/:id/outfits/inventory', () => HttpResponse.json([])),
    )
  })

  it('outfits tab survives the empty-to-loaded transition', async () => {
    const days = Array.from({ length: 17 }, (_, i) =>
      day(38 + i, i + 1, `2026-11-${String(16 + i).padStart(2, '0')}`, `Day ${i + 1}`),
    )
    const herOutfits = days.map((d, i) => outfit(100 + i, d.id, SHANZEH_ID, 'Daywear', ['Pink Hijab', 'Thermal shirt']))
    const hisOutfits = days.map((d, i) => outfit(200 + i, d.id, ARHAM_ID, 'Travel Day', ['Dark jeans', 'Merrells']))

    seedStore(useTripStore, { days: [], outfits: [], packingItems: [], reservations: [] } as never)
    const planner = buildPlanner({
      tripId: 8,
      trip: buildTrip({ id: 8, title: 'Iceland + Spain' }),
      packingItems: [],
    })
    const shell = buildShell({ listsTab: 'outfits', trTab: 'listen' })
    const { rerender } = render(<MListsTab planner={planner} shell={shell} />)

    seedStore(useTripStore, { days, outfits: [...herOutfits, ...hisOutfits] } as never)
    rerender(<MListsTab planner={planner} shell={shell} />)

    await waitFor(() => expect(screen.getByText('Day 1')).toBeInTheDocument())
    expect(screen.getByText('Wardrobe Inventory')).toBeInTheDocument()
  })

  it('packing tab survives the empty-to-loaded transition with 100+ items', async () => {
    const mine = Array.from({ length: 50 }, (_, i) =>
      buildPackingItem({ id: 1000 + i, trip_id: 8, name: `Her item ${i}`, category: 'Clothes', is_private: 1, owner_id: SHANZEH_ID, bag_id: 1 }),
    )
    const common = [
      buildPackingItem({ id: 3000, trip_id: 8, name: 'Shared sunscreen', category: 'Toiletries', is_private: 0, owner_id: null, bag_id: 1 }),
    ]
    const his = Array.from({ length: 69 }, (_, i) =>
      buildPackingItem({ id: 2000 + i, trip_id: 8, name: `His item ${i}`, category: 'Clothes', is_private: 1, owner_id: ARHAM_ID, bag_id: 2 }),
    )
    const bags = [
      { id: 1, trip_id: 8, name: 'Backpack', color: 'blue', sort_order: 0, members: [{ user_id: SHANZEH_ID, username: 'shanzeh' }] },
      { id: 2, trip_id: 8, name: 'Carry-On Roller', color: 'red', sort_order: 1, members: [{ user_id: ARHAM_ID, username: 'Arham' }] },
    ]

    seedStore(useTripStore, { outfits: [] } as never)
    const planner = buildPlanner({
      tripId: 8,
      trip: buildTrip({ id: 8, title: 'Iceland + Spain' }),
      packingItems: [],
      tripMembers: [
        { id: ARHAM_ID, username: 'Arham' },
        { id: SHANZEH_ID, username: 'shanzeh' },
      ] as never,
    })
    const shell = buildShell({ listsTab: 'packing', trTab: 'listen' })
    const { rerender } = render(<MListsTab planner={planner} shell={shell} />)

    seedStore(useTripStore, { outfits: [] } as never)
    const loaded = buildPlanner({
      tripId: 8,
      trip: buildTrip({ id: 8, title: 'Iceland + Spain' }),
      packingItems: [...mine, ...his, ...common] as never,
      tripMembers: [
        { id: ARHAM_ID, username: 'Arham' },
        { id: SHANZEH_ID, username: 'shanzeh' },
      ] as never,
      bags: bags as never,
    })
    rerender(<MListsTab planner={loaded} shell={shell} />)

    await waitFor(() => expect(screen.getByText('Shared sunscreen')).toBeInTheDocument())
  })
})
