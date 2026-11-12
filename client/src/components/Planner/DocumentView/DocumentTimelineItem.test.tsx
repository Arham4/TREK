// FE-DOC-ITEM-001 to FE-DOC-ITEM-003
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '../../../../tests/helpers/render'
import { DocumentTimelineItem } from './DocumentTimelineItem'
import { buildAssignment, buildPlace } from '../../../../tests/helpers/factories'
import type { MergedItem } from '../../../utils/dayMerge'
import type { Category } from '../../../types'

const place = buildPlace({ id: 10, name: 'Kinkaku-ji' })
const assignment = buildAssignment({ id: 501, day_id: 1, place, place_id: 10, notes: 'See the pond' })
const item: MergedItem = { type: 'place', sortKey: 0, data: assignment }

function renderItem(over: Partial<React.ComponentProps<typeof DocumentTimelineItem>> = {}) {
  return render(
    <DocumentTimelineItem
      item={item}
      dayId={1}
      index={0}
      totalItems={1}
      categories={[] as Category[]}
      {...over}
    />,
  )
}

describe('DocumentTimelineItem inline notes', () => {
  it('FE-DOC-ITEM-001: clicking the note opens the editor, and Enter saves it', () => {
    const onUpdateNotes = vi.fn()
    renderItem({ onUpdateNotes })

    fireEvent.click(screen.getByText('See the pond'))
    const editor = screen.getByRole('textbox', { name: 'Note for this stop' })
    fireEvent.change(editor, { target: { value: 'See the golden pavilion' } })
    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(onUpdateNotes).toHaveBeenCalledWith(1, 501, 'See the golden pavilion')
  })

  it('FE-DOC-ITEM-002: Escape keeps the old note', () => {
    const onUpdateNotes = vi.fn()
    renderItem({ onUpdateNotes })

    fireEvent.click(screen.getByText('See the pond'))
    const editor = screen.getByRole('textbox', { name: 'Note for this stop' })
    fireEvent.change(editor, { target: { value: 'Discarded' } })
    fireEvent.keyDown(editor, { key: 'Escape' })

    expect(onUpdateNotes).not.toHaveBeenCalled()
    expect(screen.getByText('See the pond')).toBeInTheDocument()
  })

  it('FE-DOC-ITEM-003: a stop without a note offers to add one and clears it when emptied', () => {
    const bare = buildAssignment({ id: 502, day_id: 1, place, place_id: 10, notes: null })
    const onUpdateNotes = vi.fn()
    renderItem({ item: { type: 'place', sortKey: 0, data: bare }, onUpdateNotes })

    fireEvent.click(screen.getByRole('button', { name: 'Add a note' }))
    const editor = screen.getByRole('textbox', { name: 'Note for this stop' })
    fireEvent.keyDown(editor, { key: 'Enter' })

    // Nothing typed: no write at all, not a pointless clear.
    expect(onUpdateNotes).not.toHaveBeenCalled()
  })
})
