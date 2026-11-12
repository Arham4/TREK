import { useRef, useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import { AnchoredMenu } from '../shared/AnchoredMenu'
import type { PackingState } from './usePackingListPanel'
import { KategorieGruppe } from './PackingListPanelCategoryGroup'
import EmptyState from '../shared/EmptyState'

export function PackingList(S: PackingState) {
  const {
    items, gruppiert, t, tripId, allCategories, handleRenameCategory, handleDeleteCategory, handleDeleteItem,
    handleAddItemToCategory, categoryAssignees, tripMembers, handleSetAssignees,
    bagTrackingEnabled, bags, handleCreateBagByName, canEdit, reorderPackingItems,
    currentUserId, handleSetSharing, handleCloneItem, handleJoinItem, handleLeaveItem, sort, moveCategory,
  } = S
  // Which category is being dragged and which card it is over. Held here, above
  // the cards, because the drag starts in one card and ends in another.
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null)
  const [overCategory, setOverCategory] = useState<string | null>(null)
  const endCategoryDrag = () => { setDraggedCategory(null); setOverCategory(null) }
  // One composer at the foot of the whole list, beside the per-card ones: type a
  // name, press Enter, and it lands in the category the select shows.
  const [quickName, setQuickName] = useState('')
  const [quickCategory, setQuickCategory] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [catMenuOpen, setCatMenuOpen] = useState(false)
  const catAnchorRef = useRef<HTMLButtonElement | null>(null)
  const category = allCategories.includes(quickCategory) ? quickCategory : (allCategories[0] ?? t('packing.defaultCategory'))
  const quickAdd = async () => {
    const name = quickName.trim()
    if (!name || quickSaving) return
    setQuickSaving(true)
    try {
      await handleAddItemToCategory(category, name)
      setQuickName('')
    } finally {
      setQuickSaving(false)
    }
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0 16px' }}>
      {items.length === 0 ? (
        <EmptyState scene="packing" title={t('packing.emptyTitle')} />
      ) : Object.keys(gruppiert).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)' }}>
          <p style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', margin: 0 }}>{t('packing.emptyFiltered')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(gruppiert).map(([kat, katItems]) => (
            <KategorieGruppe
              key={kat}
              kategorie={kat}
              items={katItems}
              tripId={tripId}
              allCategories={allCategories}
              onRename={handleRenameCategory}
              onDeleteAll={handleDeleteCategory}
              onDeleteItem={handleDeleteItem}
              onAddItem={handleAddItemToCategory}
              assignees={categoryAssignees[kat] || []}
              tripMembers={tripMembers}
              onSetAssignees={handleSetAssignees}
              bagTrackingEnabled={bagTrackingEnabled}
              bags={bags}
              onCreateBag={handleCreateBagByName}
              canEdit={canEdit}
              allItems={items}
              onReorder={(orderedIds) => reorderPackingItems(tripId, orderedIds)}
              reorderable={sort === 'manual'}
              categoryDrag={canEdit ? {
                isDragging: draggedCategory === kat,
                isOver: overCategory === kat && draggedCategory !== null && draggedCategory !== kat,
                onStart: () => { setDraggedCategory(kat); setOverCategory(null) },
                onOver: () => setOverCategory(kat),
                onEnd: endCategoryDrag,
                onDrop: (dragged) => { moveCategory(dragged, kat); endCategoryDrag() },
              } : undefined}
              currentUserId={currentUserId}
              onSetSharing={handleSetSharing}
              onClone={handleCloneItem}
              onJoin={handleJoinItem}
              onLeave={handleLeaveItem}
            />
          ))}
        </div>
      )}
      {canEdit && (
        <form
          onSubmit={e => { e.preventDefault(); void quickAdd() }}
          className="sticky bottom-0 mx-2 mt-3 flex items-center gap-2 rounded-2xl border border-edge bg-surface-card/95 px-3 py-2 shadow-lg backdrop-blur-md"
        >
          <Plus size={15} className="flex-none text-content-faint" />
          <input
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            placeholder={t('packing.quickAddPlaceholder')}
            aria-label={t('packing.quickAddPlaceholder')}
            data-testid="packing-quick-add"
            className="min-w-0 flex-1 border-0 bg-transparent text-body text-content outline-none placeholder:text-content-faint"
          />
          <button
            type="button"
            ref={catAnchorRef}
            onClick={() => setCatMenuOpen(o => !o)}
            aria-label={t('places.formCategory')}
            aria-haspopup="menu"
            aria-expanded={catMenuOpen}
            title={category}
            className="inline-flex max-w-[8.5rem] flex-none items-center gap-1 rounded-lg border border-edge-faint bg-surface px-1.5 py-1 text-caption font-semibold text-content-muted hover:text-content"
          >
            <Tags size={12} className="flex-none" />
            <span className="truncate">{t('places.formCategory')}</span>
          </button>
          <button
            type="submit"
            disabled={!quickName.trim() || quickSaving}
            aria-label={t('packing.quickAddAction')}
            className={`grid h-7 w-7 flex-none place-items-center rounded-lg ${quickName.trim() ? 'bg-accent text-accent-text' : 'bg-surface-tertiary text-content-faint'}`}
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </form>
      )}
      {catMenuOpen && (
        <AnchoredMenu
          anchor={catAnchorRef.current}
          onClose={() => setCatMenuOpen(false)}
          title={t('places.formCategory')}
          label={t('places.formCategory')}
          items={allCategories.map(cat => ({
            key: cat,
            label: cat,
            icon: <span className="h-2 w-2 rounded-full bg-accent" />,
            onSelect: () => setQuickCategory(cat),
          }))}
        />
      )}
    </div>
  )
}
