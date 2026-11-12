import { test, expect, type APIRequestContext } from '@playwright/test'
import { dismissSystemNotices } from './helpers'

/**
 * Ergonomics pass verification (trip planner + Document View).
 *
 * Seeds its own trip through the API so it never touches the user's data: 17
 * days, a hotel, a tour, two stops on day one (one with a note) and an
 * unassigned place. The UI assertions then cover the roadmap's checklist.
 */

const TITLE = `E2E Ergonomics ${Date.now()}`
const START = '2027-03-01'
const END = '2027-03-17'

let tripId = 0
let dayIds: number[] = []
let secondStopName = ''
let firstStopName = ''
let dayOneId = 0

async function post<T = any>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const res = await request.post(url, { data })
  expect(res.ok(), `${url} → ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.json()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  const trip = await post<{ trip: { id: number } }>(request, '/api/trips', {
    title: TITLE,
    start_date: START,
    end_date: END,
    currency: 'EUR',
    reminder_days: 3,
  })
  tripId = trip.trip.id

  const hotelPlace = (await post<{ place: { id: number } }>(request, `/api/trips/${tripId}/places`, {
    name: 'E2E Grand Hotel', address: '1 Rue de Test, Paris', lat: 48.8566, lng: 2.3522,
  })).place
  const sightPlace = (await post<{ place: { id: number } }>(request, `/api/trips/${tripId}/places`, {
    name: 'E2E Louvre Stop', address: 'Rue de Rivoli, Paris', lat: 48.8606, lng: 2.3376,
  })).place
  const secondPlace = (await post<{ place: { id: number } }>(request, `/api/trips/${tripId}/places`, {
    name: 'E2E Montmartre Stop', address: 'Montmartre, Paris', lat: 48.8867, lng: 2.3431,
  })).place
  await post(request, `/api/trips/${tripId}/places`, {
    name: 'E2E Unassigned Palace', address: 'Versailles, France', lat: 48.8049, lng: 2.1204,
  })
  await post(request, `/api/trips/${tripId}/places`, {
    name: 'E2E Insert Stop', address: 'Latin Quarter, Paris', lat: 48.8496, lng: 2.3477,
  })

  await post(request, `/api/trips/${tripId}/guests`, { name: 'E2E Guest' })

  const daysRes = await request.get(`/api/trips/${tripId}/days`)
  expect(daysRes.ok()).toBeTruthy()
  const daysBody = await daysRes.json()
  const days = (daysBody.days || daysBody) as Array<{ id: number }>
  dayIds = days.map(d => d.id)
  dayOneId = dayIds[0]
  expect(dayIds.length).toBe(17)

  firstStopName = 'E2E Louvre Stop'
  secondStopName = 'E2E Montmartre Stop'

  await post(request, `/api/trips/${tripId}/days/${dayOneId}/assignments`, {
    place_id: sightPlace.id, notes: 'See the pond',
  })
  await post(request, `/api/trips/${tripId}/days/${dayOneId}/assignments`, {
    place_id: secondPlace.id,
  })
  // Every day carries a stop, so the printed document is genuinely long.
  for (const id of dayIds.slice(1)) {
    await post(request, `/api/trips/${tripId}/days/${id}/assignments`, { place_id: sightPlace.id })
  }

  const acc = await post<{ accommodation: { id: number } }>(request, `/api/trips/${tripId}/accommodations`, {
    place_id: hotelPlace.id,
    start_day_id: dayIds[1],
    end_day_id: dayIds[2],
    check_in: '15:00',
    check_out: '11:00',
  })

  await post(request, `/api/trips/${tripId}/reservations`, {
    title: 'Hotel Lutetia', type: 'hotel', status: 'confirmed',
    day_id: dayIds[1], end_day_id: dayIds[2], place_id: hotelPlace.id,
    accommodation_id: acc.accommodation.id,
    metadata: { check_in_time: '15:00', check_out_time: '11:00' },
  })
  await post(request, `/api/trips/${tripId}/reservations`, {
    title: 'Louvre tour', type: 'tour', status: 'confirmed',
    day_id: dayOneId, place_id: sightPlace.id,
  })
})

async function openPlan(page: import('@playwright/test').Page, mode: 'document' | 'map' = 'document') {
  await page.addInitScript(m => localStorage.setItem('trek_plan_view_mode', m), mode)
  await page.goto(`/trips/${tripId}`)
  await dismissSystemNotices(page)
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  if (mode === 'document') await expect(page.getByTestId('plan-document-stage')).toBeVisible({ timeout: 20_000 })
}

test('a hotel is searched, created and linked without leaving the day panel', async ({ page }) => {
  await page.route('**/api/maps/search**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      places: [{ name: 'E2E Grand Hotel', address: '1 Rue de Test, Paris', lat: 48.8566, lng: 2.3522 }],
      source: 'test',
    }),
  }))
  await openPlan(page, 'map')

  // The map's day rail opens the day card on its header. Day 5 keeps this stay
  // off day one, whose two stops the note/drag test relies on.
  await page.getByText('Day 5', { exact: true }).first().click()
  const addStay = page.getByRole('button', { name: 'Add accommodation' })
  await expect(addStay).toBeVisible()
  await addStay.click()

  const hotelDialog = page.getByRole('dialog').last()
  const search = hotelDialog.getByPlaceholder('Search any hotel or address...')
  await search.fill('E2E Grand Hotel Paris')
  const suggestions = page.getByTestId('hotel-place-suggestions')
  await expect(suggestions.getByText('E2E Grand Hotel')).toBeVisible()
  await suggestions.getByText('E2E Grand Hotel').click()

  // The pick is linked in this visit: no trip-place detour, no second panel.
  await expect(hotelDialog.getByText('E2E Grand Hotel').first()).toBeVisible()
  await hotelDialog.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByText('E2E Grand Hotel').first()).toBeVisible()
})

test('a hotel and a tour booked by address stand on the plan map as pins', async ({ page }) => {
  await openPlan(page, 'map')
  // The stay, its booking and the tour; the day-panel test may have added another stay.
  await expect.poll(() => page.locator('.trek-booking-point').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(3)

  // Two stays share the hotel's spot, so the top pin is covered by its twin;
  // dispatch the click rather than asking Playwright to hit-test the pile.
  await page.locator('.trek-booking-point').first().dispatchEvent('click')
  await expect(page.getByRole('dialog').filter({ hasText: /E2E Grand Hotel|Hotel Lutetia|Louvre tour/ })).toBeVisible()
})

test('All Days offers Add to Day with a day menu instead of a hidden action', async ({ page, request }) => {
  await openPlan(page, 'map')
  const clearDay = page.getByRole('button', { name: 'Show the whole trip' })
  if (await clearDay.isVisible().catch(() => false)) await clearDay.click()

  await page.getByText('E2E Unassigned Palace').first().click()
  const add = page.getByRole('button', { name: 'Add to Day', exact: true })
  await expect(add).toBeVisible()
  await add.click()

  await page.getByRole('menuitem', { name: /Day 3/ }).click()

  // The choice really lands on day 3, not merely closes the menu.
  await expect.poll(async () => {
    const res = await request.get(`/api/trips/${tripId}/days/${dayIds[2]}/assignments`)
    const body = await res.json()
    const list = (body.assignments || body) as Array<{ place?: { name?: string }; place_name?: string }>
    return list.map(a => a.place?.name || a.place_name)
  }, { timeout: 15_000 }).toContain('E2E Unassigned Palace')
})

test('the document prints across pages instead of clipping at page one', async ({ page }) => {
  await openPlan(page)
  await expect(page.locator('section[id^="doc-day-"]')).toHaveCount(17)

  await page.emulateMedia({ media: 'print' })
  // Let the print layout settle (the stage is unclipped by the print rules).
  await page.waitForTimeout(400)
  // A stop's note is content, not a control: it must survive the print rules
  // that hide the document's buttons.
  await expect(page.getByRole('button', { name: 'See the pond' })).toBeVisible()
  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  await test.info().attach('document-view.pdf', { body: pdf, contentType: 'application/pdf' })

  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
  expect(pages).toBeGreaterThan(2)
  await page.emulateMedia({ media: 'screen' })
})

test('a note is edited in place and a stop is dragged to a new position', async ({ page, request }) => {
  await openPlan(page)
  const day = page.locator(`section#doc-day-${dayOneId}`)
  await expect(day.getByText(firstStopName)).toBeVisible()

  // Inline note: click, type, Enter.
  await day.getByText('See the pond').click()
  const editor = day.getByRole('textbox', { name: 'Note for this stop' })
  await expect(editor).toBeVisible()
  await editor.fill('See the golden pavilion')
  await editor.press('Enter')
  await expect(day.getByText('See the golden pavilion')).toBeVisible()

  // Drag the first stop after the second. Chromium's synthetic drag from
  // dragTo does not carry a DataTransfer through React in every case, so the
  // HTML5 sequence is dispatched with a real one.
  await page.evaluate(({ fromSel, toSel }) => {
    const from = document.querySelector(fromSel) as HTMLElement | null
    const to = document.querySelector(toSel) as HTMLElement | null
    if (!from || !to) throw new Error('drag source or target missing')
    const dt = new DataTransfer()
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    to.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }))
    to.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }))
    from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
  }, {
    fromSel: `section#doc-day-${dayOneId} [title="Drag to reorder"]`,
    toSel: `[data-testid="doc-insert-${dayOneId}-2"]`,
  })

  await expect.poll(async () => {
    const res = await request.get(`/api/trips/${tripId}/days/${dayOneId}/assignments`)
    const body = await res.json()
    const list = (body.assignments || body) as Array<{ place?: { name?: string }; place_name?: string }>
    return list.map(a => a.place?.name || a.place_name).filter(Boolean)
  }, { timeout: 15_000 }).toEqual([secondStopName, firstStopName])
})

test('the in-between + inserts a stop at that exact position', async ({ page, request }) => {
  await openPlan(page)
  const day = page.locator(`section#doc-day-${dayOneId}`)

  // The divider between the day's two stops.
  const divider = page.getByTestId(`doc-insert-${dayOneId}-1`)
  await divider.getByRole('button', { name: 'Insert a stop here' }).click()

  const picker = page.getByTestId('doc-insert-picker')
  await picker.getByPlaceholder('Search places...').fill('E2E Insert')
  await picker.getByText('E2E Insert Stop').click()

  await expect(day.getByText('E2E Insert Stop')).toBeVisible()
  await expect.poll(async () => {
    const res = await request.get(`/api/trips/${tripId}/days/${dayOneId}/assignments`)
    const body = await res.json()
    const list = (body.assignments || body) as Array<{ place?: { name?: string }; place_name?: string }>
    return list.map(a => a.place?.name || a.place_name).filter(Boolean)
  }, { timeout: 15_000 }).toEqual([secondStopName, 'E2E Insert Stop', firstStopName])
})

test('a stop dragged onto another day moves there', async ({ page, request }) => {
  await openPlan(page)
  const targetDayId = dayIds[1]

  const dayOneRes = await request.get(`/api/trips/${tripId}/days/${dayOneId}/assignments`)
  const dayOneBody = await dayOneRes.json()
  const dayOneList = (dayOneBody.assignments || dayOneBody) as Array<{ place?: { name?: string }; place_name?: string }>
  const movingName = dayOneList.map(a => a.place?.name || a.place_name).filter(Boolean)[0]
  expect(movingName).toBeTruthy()

  const beforeRes = await request.get(`/api/trips/${tripId}/days/${targetDayId}/assignments`)
  const beforeBody = await beforeRes.json()
  const beforeList = (beforeBody.assignments || beforeBody) as Array<{ place?: { name?: string }; place_name?: string }>
  const beforeNames = beforeList.map(a => a.place?.name || a.place_name).filter(Boolean)

  await page.evaluate(({ fromDayId, toDayId, name }) => {
    const source = document.querySelector(`section#doc-day-${fromDayId}`) as HTMLElement | null
    const grip = [...(source?.querySelectorAll('[title="Drag to reorder"]') ?? [])]
      .find(el => el.closest('[class*="group/item"]')?.textContent?.includes(name)) as HTMLElement | undefined
    const target = document.querySelector(`[data-testid="doc-insert-${toDayId}-0"]`) as HTMLElement | null
    if (!grip || !target) throw new Error('drag source or target missing')
    const dt = new DataTransfer()
    grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }))
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }))
    grip.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
  }, { fromDayId: dayOneId, toDayId: targetDayId, name: movingName })

  await expect.poll(async () => {
    const res = await request.get(`/api/trips/${tripId}/days/${targetDayId}/assignments`)
    const body = await res.json()
    const list = (body.assignments || body) as Array<{ place?: { name?: string }; place_name?: string }>
    return list.map(a => a.place?.name || a.place_name).filter(Boolean)
  }, { timeout: 15_000 }).toEqual([movingName, ...beforeNames])

  await expect.poll(async () => {
    const res = await request.get(`/api/trips/${tripId}/days/${dayOneId}/assignments`)
    const body = await res.json()
    const list = (body.assignments || body) as Array<{ place?: { name?: string }; place_name?: string }>
    return list.map(a => a.place?.name || a.place_name)
  }, { timeout: 15_000 }).not.toContain(movingName)
})

test('toggling to the map and back keeps the document scroll position', async ({ page }) => {
  await openPlan(page)
  const main = page.locator('[data-testid="plan-document-stage"] main')
  await main.evaluate(el => { el.scrollTop = 1200 })
  await page.waitForTimeout(800)

  // Alt+D is the host's own toggle event; the clickable pill is covered by the
  // map controls' portals at some scroll positions.
  await page.keyboard.press('Alt+d')
  await expect(page.getByTestId('plan-document-stage')).toHaveCount(0)
  await page.keyboard.press('Alt+d')

  await expect(page.getByTestId('plan-document-stage')).toBeVisible()
  await expect.poll(() => page.locator('[data-testid="plan-document-stage"] main').evaluate(el => el.scrollTop), { timeout: 5_000 })
    .toBeGreaterThan(1000)
})

test('an expense split by percentage can hand the remainder to its payer', async ({ page }) => {
  await openPlan(page, 'map')
  await page.getByRole('button', { name: 'Costs' }).click()
  await page.getByRole('button', { name: 'Add expense' }).first().click()

  const dialog = page.getByRole('dialog').last()
  await dialog.getByPlaceholder('e.g. Dinner, souvenirs, gas…').fill('E2E Split Dinner')
  await dialog.getByText('Total amount', { exact: true }).locator('..').locator('input').fill('90')
  await dialog.getByRole('button', { name: 'Custom' }).click()
  await dialog.getByRole('button', { name: '%' }).click()

  const percents = dialog.getByRole('textbox', { name: / %$/ })
  await percents.last().fill('60')
  await dialog.getByRole('button', { name: /Give the rest/i }).click()
  await expect(dialog.getByText('Split matches total')).toBeVisible()

  await dialog.getByRole('button', { name: 'Add expense' }).last().click()
  await expect(page.getByText('E2E Split Dinner')).toBeVisible()
})

test('the to-do and packing lists take a new line straight from their footer input', async ({ page }) => {
  await openPlan(page, 'map')
  await page.getByRole('button', { name: 'Lists' }).click()

  await page.getByRole('button', { name: 'To-Do' }).click()
  const todo = page.getByTestId('todo-quick-add')
  await todo.fill('E2E Quick Task')
  await todo.press('Enter')
  await expect(page.getByText('E2E Quick Task')).toBeVisible()

  await page.getByRole('button', { name: 'Packing List' }).click()
  const packing = page.getByTestId('packing-quick-add')
  await packing.fill('E2E Quick Item')
  await packing.press('Enter')
  await expect(page.getByText('E2E Quick Item')).toBeVisible()
})

test('the outfits planner is back on the desktop Lists tab', async ({ page }) => {
  await openPlan(page, 'map')
  await page.getByRole('button', { name: 'Lists' }).click()

  const outfitsTab = page.getByRole('button', { name: /Outfits/ }).first()
  await expect(outfitsTab).toBeVisible()
  await outfitsTab.click()

  // The custom wardrobe planner mounts with its toolbar and wardrobe drawer.
  await expect(page.getByText('All Travelers')).toBeVisible()
  await expect(page.getByRole('button', { name: /Wardrobe Inventory/ })).toBeVisible()
})

test('a tablet gets a floating outline that opens the table of contents', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await openPlan(page)

  await page.getByTestId('doc-mobile-outline-toggle').click()
  const drawer = page.getByTestId('doc-mobile-outline-drawer')
  await expect(drawer).toBeVisible()

  await drawer.getByRole('button').filter({ hasText: 'Day 2' }).first().click()
  await expect(drawer).toHaveCount(0)
})
