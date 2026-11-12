// FE-DOC-DAY-001 to FE-DOC-DAY-009
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '../../../../tests/helpers/render'
import { DocumentDaySection } from './DocumentDaySection'
import { buildAssignment, buildDay, buildPlace } from '../../../../tests/helpers/factories'
import type { MergedItem } from '../../../utils/dayMerge'
import type { Category } from '../../../types'

const day = buildDay({ id: 1, day_number: 1, title: 'Arrival', date: '2026-10-14' })
const kinkaku = buildPlace({ id: 10, name: 'Kinkaku-ji', lat: null, lng: null })
const gion = buildPlace({ id: 11, name: 'Gion Karyo', lat: null, lng: null })
const arashiyama = buildPlace({ id: 12, name: 'Arashiyama', lat: null, lng: null })

const a1 = buildAssignment({ id: 501, day_id: 1, place: kinkaku, place_id: 10, order_index: 0 })
const a2 = buildAssignment({ id: 502, day_id: 1, place: gion, place_id: 11, order_index: 1 })
const items: MergedItem[] = [
  { type: 'place', sortKey: 0, data: a1 },
  { type: 'place', sortKey: 1, data: a2 },
]

function renderSection(over: Partial<React.ComponentProps<typeof DocumentDaySection>> = {}) {
  return render(
    <DocumentDaySection
      day={day}
      index={0}
      items={items}
      categories={[] as Category[]}
      compactMode
      places={[kinkaku, gion, arashiyama]}
      onUpdateDayTitle={vi.fn()}
      onAssignToDay={vi.fn()}
      onReorderDay={vi.fn()}
      onMoveAssignment={vi.fn()}
      {...over}
    />,
  )
}

function dragData() {
  const store = new Map<string, string>()
  const types: string[] = []
  return {
    effectAllowed: '', dropEffect: '',
    types,
    setData(key: string, value: string) { store.set(key, value); if (!types.includes(key)) types.push(key) },
    getData(key: string) { return store.get(key) || '' },
  }
}

describe('DocumentDaySection editing', () => {
  it('FE-DOC-DAY-001: clicking the day title edits it in place and Enter saves', () => {
    const onUpdateDayTitle = vi.fn()
    renderSection({ onUpdateDayTitle })

    fireEvent.click(screen.getByText('Arrival'))
    const input = screen.getByDisplayValue('Arrival')
    fireEvent.change(input, { target: { value: 'Arrival in Kyoto' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onUpdateDayTitle).toHaveBeenCalledWith(1, 'Arrival in Kyoto')
  })

  it('FE-DOC-DAY-002: Escape leaves the title alone', () => {
    const onUpdateDayTitle = vi.fn()
    renderSection({ onUpdateDayTitle })

    fireEvent.click(screen.getByText('Arrival'))
    const input = screen.getByDisplayValue('Arrival')
    fireEvent.change(input, { target: { value: 'Never saved' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onUpdateDayTitle).not.toHaveBeenCalled()
    expect(screen.getByText('Arrival')).toBeInTheDocument()
  })

  it('FE-DOC-DAY-003: the in-between + inserts an existing place at that position', () => {
    const onAssignToDay = vi.fn()
    renderSection({ onAssignToDay })

    const divider = screen.getByTestId('doc-insert-1-1')
    fireEvent.click(within(divider).getByRole('button', { name: 'Insert a stop here' }))
    fireEvent.click(screen.getByText('Arashiyama'))

    expect(onAssignToDay).toHaveBeenCalledWith(12, 1, 1)
  })

  it('FE-DOC-DAY-004: places already on the day are not offered again', () => {
    renderSection()
    const divider = screen.getByTestId('doc-insert-1-0')
    fireEvent.click(within(divider).getByRole('button', { name: 'Insert a stop here' }))
    const picker = screen.getByTestId('doc-insert-picker')
    expect(within(picker).queryByText('Kinkaku-ji')).toBeNull()
    expect(within(picker).getByText('Arashiyama')).toBeInTheDocument()
  })

  it('FE-DOC-DAY-005: dropping a stop after the last one reorders the day', () => {
    const onReorderDay = vi.fn()
    renderSection({ onReorderDay })

    const grip = screen.getAllByTitle('Drag to reorder')[0]
    const data = dragData()
    fireEvent.dragStart(grip, { dataTransfer: data })
    fireEvent.drop(screen.getByTestId('doc-insert-1-2'), { dataTransfer: data })

    expect(onReorderDay).toHaveBeenCalledWith(1, [502, 501])
  })

  it('FE-DOC-DAY-006: dropping on another day moves the stop there at its position', () => {
    const onMoveAssignment = vi.fn()
    renderSection({ onMoveAssignment })

    const data = dragData()
    data.setData('application/x-trek-doc-stop', JSON.stringify({ assignmentId: 501, dayId: 2 }))
    fireEvent.drop(screen.getByTestId('doc-insert-1-1'), { dataTransfer: data })

    expect(onMoveAssignment).toHaveBeenCalledWith(501, 2, 1, 1)
  })

  it('FE-DOC-DAY-007: dropping a timed stop out of time order asks to drop its start time', async () => {
    const early = buildAssignment({
      id: 601, day_id: 1, place_id: 10, order_index: 0,
      place: { ...kinkaku, place_time: '09:00' },
    })
    const late = buildAssignment({
      id: 602, day_id: 1, place_id: 11, order_index: 1,
      place: { ...gion, place_time: '18:00' },
    })
    const timedItems: MergedItem[] = [
      { type: 'place', sortKey: 0, data: early },
      { type: 'place', sortKey: 1, data: late },
    ]
    const onReorderDay = vi.fn()
    const onClearAssignmentTime = vi.fn()
    renderSection({ items: timedItems, onReorderDay, onClearAssignmentTime })

    // Drag the 09:00 stop after the 18:00 one: drawing by clock would snap it
    // back, so the section holds the move behind a confirm instead.
    const grip = screen.getAllByTitle('Drag to reorder')[0]
    const data = dragData()
    fireEvent.dragStart(grip, { dataTransfer: data })
    fireEvent.drop(screen.getByTestId('doc-insert-1-2'), { dataTransfer: data })

    expect(onReorderDay).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove time & move' }))
    expect(onClearAssignmentTime).toHaveBeenCalledWith(1, 601)
    // The reorder follows the time clear (awaited through the promise).
    await vi.waitFor(() => expect(onReorderDay).toHaveBeenCalledWith(1, [602, 601]))
  })

  it('FE-DOC-DAY-008: keeping the time abandons a timed reorder', () => {
    const early = buildAssignment({
      id: 601, day_id: 1, place_id: 10, order_index: 0,
      place: { ...kinkaku, place_time: '09:00' },
    })
    const late = buildAssignment({
      id: 602, day_id: 1, place_id: 11, order_index: 1,
      place: { ...gion, place_time: '18:00' },
    })
    const timedItems: MergedItem[] = [
      { type: 'place', sortKey: 0, data: early },
      { type: 'place', sortKey: 1, data: late },
    ]
    const onReorderDay = vi.fn()
    renderSection({ items: timedItems, onReorderDay, onClearAssignmentTime: vi.fn() })

    const grip = screen.getAllByTitle('Drag to reorder')[0]
    const data = dragData()
    fireEvent.dragStart(grip, { dataTransfer: data })
    fireEvent.drop(screen.getByTestId('doc-insert-1-2'), { dataTransfer: data })

    fireEvent.click(screen.getByRole('button', { name: 'Keep time' }))
    expect(onReorderDay).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('FE-DOC-DAY-009: the picker offers to create an unmatched search as a stop at that slot', () => {
    const onCreatePlaceAt = vi.fn()
    renderSection({ onCreatePlaceAt })

    const divider = screen.getByTestId('doc-insert-1-0')
    fireEvent.click(within(divider).getByRole('button', { name: 'Insert a stop here' }))
    fireEvent.change(screen.getByPlaceholderText('Search places...'), { target: { value: 'Brand New Cove' } })

    const create = screen.getByTestId('doc-insert-create')
    expect(create).toHaveTextContent('Brand New Cove')
    fireEvent.click(create)
    expect(onCreatePlaceAt).toHaveBeenCalledWith('Brand New Cove', 1, 0)
  })
})
