import React, { useState, useEffect, useMemo } from 'react'
import {
  Shirt, Plus, Trash2, Copy, Check, Circle, CheckCircle2,
  Sun, Moon, Utensils, Waves, Dumbbell, Plane,
  ChevronDown, ChevronUp, Layers, X, Sparkles, AlertCircle
} from 'lucide-react'
import { useTripStore } from '../../store/tripStore'
import { useAuthStore } from '../../store/authStore'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import { tripsApi, outfitsApi } from '../../api/client'
import type { Outfit, OutfitItem, OutfitInventoryItem, Day } from '../../types'

interface OutfitsPlannerPanelProps {
  tripId: number
  canEdit?: boolean
}

interface TripMemberInfo {
  id: number
  username: string
  avatar?: string | null
  avatar_url?: string | null
  is_guest?: boolean
}

const PRESET_TITLES = [
  { label: 'Daywear', icon: Sun },
  { label: 'Evening', icon: Moon },
  { label: 'Dinner', icon: Utensils },
  { label: 'Beach & Swim', icon: Waves },
  { label: 'Workout', icon: Dumbbell },
  { label: 'Travel', icon: Plane },
]

export function OutfitsPlannerPanel({ tripId }: OutfitsPlannerPanelProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const days = useTripStore((s) => s.days)
  const outfits = useTripStore((s) => s.outfits)
  const packingItems = useTripStore((s) => s.packingItems)
  const reservations = useTripStore((s) => s.reservations)

  const { addOutfit, updateOutfit, deleteOutfit, copyOutfit, addOutfitItem, deleteOutfitItem } = useTripStore()

  // Members
  const [members, setMembers] = useState<TripMemberInfo[]>([])
  const [selectedTravelerId, setSelectedTravelerId] = useState<number | 'all'>('all')

  // Wardrobe drawer
  const [showWardrobeDrawer, setShowWardrobeDrawer] = useState(false)
  const [inventory, setInventory] = useState<OutfitInventoryItem[]>([])

  // New Outfit modal/inline state
  const [addingDayId, setAddingDayId] = useState<number | null>(null)
  const [newOutfitTitle, setNewOutfitTitle] = useState('Daywear')
  const [newOutfitTravelerId, setNewOutfitTravelerId] = useState<number | null>(null)

  // Copy modal state
  const [copyingOutfit, setCopyingOutfit] = useState<Outfit | null>(null)
  const [targetCopyDayId, setTargetCopyDayId] = useState<number | null>(null)

  // Quick item input state per outfit: outfitId -> text
  const [itemDrafts, setItemDrafts] = useState<Record<number, string>>({})
  const [addToPackToggles, setAddToPackToggles] = useState<Record<number, boolean>>({})

  // Load members
  useEffect(() => {
    tripsApi.getMembers(tripId).then((data) => {
      const all: TripMemberInfo[] = []
      if (data.owner) {
        all.push({
          id: data.owner.id,
          username: data.owner.username,
          avatar: data.owner.avatar_url,
          is_guest: false,
        })
      }
      if (data.members) {
        all.push(
          ...data.members.map((m: any) => ({
            id: m.id,
            username: m.username,
            avatar: m.avatar_url,
            is_guest: !!m.is_guest,
          })),
        )
      }
      setMembers(all)
      if (currentUserId && all.some((m) => m.id === currentUserId)) {
        setSelectedTravelerId(currentUserId)
      } else if (all.length > 0) {
        setSelectedTravelerId(all[0].id)
      }
    }).catch(() => {})
  }, [tripId, currentUserId])

  // Active traveler ID for wardrobe inventory
  const activeTravelerId = useMemo(() => {
    if (selectedTravelerId !== 'all') return selectedTravelerId
    return currentUserId || (members.length > 0 ? members[0].id : null)
  }, [selectedTravelerId, currentUserId, members])

  // Load wardrobe inventory when active traveler changes
  useEffect(() => {
    if (!activeTravelerId) return
    outfitsApi.inventory(tripId, activeTravelerId).then((items) => {
      setInventory(items)
    }).catch(() => {})
  }, [tripId, activeTravelerId, outfits, packingItems])

  // Filter outfits by selected traveler
  const filteredOutfits = useMemo(() => {
    if (selectedTravelerId === 'all') return outfits
    return outfits.filter((o) => o.user_id === selectedTravelerId)
  }, [outfits, selectedTravelerId])

  // Group outfits by dayId
  const outfitsByDay = useMemo(() => {
    const map: Record<number, Outfit[]> = {}
    for (const d of days) map[d.id] = []
    for (const o of filteredOutfits) {
      if (!map[o.day_id]) map[o.day_id] = []
      map[o.day_id].push(o)
    }
    return map
  }, [days, filteredOutfits])

  // Traveler lookup map
  const memberMap = useMemo(() => {
    const m = new Map<number, TripMemberInfo>()
    for (const mem of members) m.set(mem.id, mem)
    return m
  }, [members])

  // Suggestions for autocomplete: clothing items from packing list
  const clothingSuggestions = useMemo(() => {
    return inventory.map((inv) => inv.name)
  }, [inventory])

  // Handle adding an outfit
  const handleCreateOutfit = async (dayId: number) => {
    const travelerId = newOutfitTravelerId || (selectedTravelerId !== 'all' ? selectedTravelerId : currentUserId) || members[0]?.id
    if (!travelerId) return

    try {
      await addOutfit(tripId, {
        day_id: dayId,
        user_id: travelerId,
        title: newOutfitTitle.trim() || 'Daywear',
      })
      setAddingDayId(null)
      setNewOutfitTitle('Daywear')
      toast.success(t('outfits.added', 'Outfit planned!'))
    } catch {
      toast.error(t('outfits.error', 'Failed to plan outfit'))
    }
  }

  // Handle adding an item to an outfit
  const handleAddItem = async (outfitId: number) => {
    const draft = itemDrafts[outfitId]?.trim()
    if (!draft) return

    const shouldAddToPack = addToPackToggles[outfitId] ?? false
    // Match with existing packing item if name matches
    const matchedPackingItem = inventory.find(
      (inv) => inv.name.toLowerCase() === draft.toLowerCase(),
    )

    try {
      await addOutfitItem(tripId, outfitId, {
        name: draft,
        packing_item_id: matchedPackingItem?.packing_item_id || undefined,
        create_packing_item: !matchedPackingItem && shouldAddToPack,
      })
      setItemDrafts((prev) => ({ ...prev, [outfitId]: '' }))
      if (shouldAddToPack && !matchedPackingItem) {
        toast.success(t('outfits.addedToPacking', 'Added to packing list'))
      }
    } catch {
      toast.error(t('outfits.itemError', 'Failed to add item'))
    }
  }

  // Handle copying an outfit
  const handleCopyOutfit = async () => {
    if (!copyingOutfit || !targetCopyDayId) return
    try {
      await copyOutfit(tripId, copyingOutfit.id, {
        target_day_id: targetCopyDayId,
        target_user_id: copyingOutfit.user_id,
      })
      toast.success(t('outfits.copied', 'Outfit copied!'))
      setCopyingOutfit(null)
      setTargetCopyDayId(null)
    } catch {
      toast.error(t('outfits.copyError', 'Failed to copy outfit'))
    }
  }

  return (
    <div className="flex flex-col h-full text-content">
      {/* ── Traveler Selector & Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-edge-subtle">
        {/* Traveler tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setSelectedTravelerId('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedTravelerId === 'all'
                ? 'bg-accent text-accent-text'
                : 'bg-surface-secondary text-content-muted hover:text-content hover:bg-surface-hover'
            }`}
          >
            <Layers size={13} />
            <span>{t('outfits.allTravelers', 'All Travelers')}</span>
          </button>

          {members.map((m) => {
            const active = selectedTravelerId === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedTravelerId(m.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-accent text-accent-text'
                    : 'bg-surface-secondary text-content-muted hover:text-content hover:bg-surface-hover'
                }`}
              >
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt={m.username}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-surface-tertiary flex items-center justify-center text-[9px] uppercase font-bold">
                    {m.username.slice(0, 1)}
                  </div>
                )}
                <span>{m.username}</span>
                {m.is_guest && (
                  <span className="opacity-60 text-[10px]">({t('common.guest', 'guest')})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Wardrobe Drawer toggle button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWardrobeDrawer((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-edge transition-colors ${
              showWardrobeDrawer ? 'bg-accent text-accent-text border-transparent' : 'bg-surface-card hover:bg-surface-hover'
            }`}
          >
            <Shirt size={13} />
            <span>{t('outfits.myWardrobe', 'Wardrobe Inventory')}</span>
            {inventory.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-surface-tertiary text-content-faint">
                {inventory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Layout: Days Grid + Wardrobe Drawer ── */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Days List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          {days.length === 0 ? (
            <div className="p-8 text-center text-content-muted bg-surface-card rounded-2xl border border-edge-subtle">
              <Shirt className="mx-auto mb-2 opacity-40" size={32} />
              <p>{t('outfits.noDays', 'No days created in this trip yet.')}</p>
            </div>
          ) : (
            days.map((day) => {
              const dayOutfits = outfitsByDay[day.id] || []
              const dayReservations = reservations.filter((r) => r.day_id === day.id)

              return (
                <div
                  key={day.id}
                  className="bg-surface-card rounded-2xl border border-edge-subtle overflow-hidden shadow-sm"
                >
                  {/* Day Header */}
                  <div className="px-5 py-3.5 bg-surface-secondary/70 border-b border-edge-subtle flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-md bg-accent/10 text-accent font-semibold text-xs">
                        Day {day.day_number}
                      </span>
                      {day.date && (
                        <span className="text-xs font-medium text-content-muted">
                          {day.date}
                        </span>
                      )}
                      {day.title && (
                        <span className="text-xs font-semibold text-content">
                          — {day.title}
                        </span>
                      )}
                    </div>

                    {/* Day Reservations highlights if any */}
                    {dayReservations.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-content-muted">
                        {dayReservations.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-tertiary text-[11px]"
                          >
                            <Utensils size={11} className="opacity-70" />
                            <span className="truncate max-w-[140px]">{r.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outfits for this Day */}
                  <div className="p-5 space-y-4">
                    {dayOutfits.length === 0 && addingDayId !== day.id && (
                      <div className="py-4 text-center text-xs text-content-muted/80">
                        {t('outfits.empty', 'No outfits planned yet for this day.')}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dayOutfits.map((outfit) => {
                        const traveler = memberMap.get(outfit.user_id)
                        const draft = itemDrafts[outfit.id] || ''
                        const willAddToPack = addToPackToggles[outfit.id] ?? false

                        return (
                          <div
                            key={outfit.id}
                            className="p-4 rounded-xl bg-surface-secondary/50 border border-edge flex flex-col justify-between space-y-3"
                          >
                            {/* Outfit Title & Traveler */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Shirt size={14} className="text-accent" />
                                  <h4 className="font-semibold text-sm text-content">
                                    {outfit.title}
                                  </h4>
                                  {outfit.time_of_day && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-content-muted">
                                      {outfit.time_of_day}
                                    </span>
                                  )}
                                </div>
                                {selectedTravelerId === 'all' && traveler && (
                                  <div className="flex items-center gap-1 mt-1 text-[11px] text-content-muted">
                                    <span>{traveler.username}</span>
                                  </div>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1 text-content-faint">
                                <button
                                  type="button"
                                  title={t('outfits.copyToDay', 'Copy to another day')}
                                  onClick={() => {
                                    setCopyingOutfit(outfit)
                                    setTargetCopyDayId(days[0]?.id || null)
                                  }}
                                  className="p-1 rounded hover:bg-surface-hover hover:text-content transition-colors"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  type="button"
                                  title={t('outfits.deleteOutfit', 'Delete outfit')}
                                  onClick={() => deleteOutfit(tripId, outfit.id)}
                                  className="p-1 rounded hover:bg-surface-hover hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Outfit Items Chips */}
                            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                              {outfit.items.length === 0 ? (
                                <span className="text-xs text-content-faint italic py-1">
                                  {t('outfits.noItems', 'No items in this outfit yet')}
                                </span>
                              ) : (
                                outfit.items.map((it) => (
                                  <span
                                    key={it.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-card border border-edge text-xs text-content shadow-2xs group"
                                  >
                                    {it.packing_item_checked ? (
                                      <CheckCircle2 size={11} className="text-emerald-500 shrink-0" title={t('outfits.packed', 'Packed in suitcase')} />
                                    ) : (
                                      <Circle size={10} className="text-content-faint shrink-0" title={t('outfits.notPacked', 'Not yet packed')} />
                                    )}
                                    <span>{it.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => deleteOutfitItem(tripId, outfit.id, it.id)}
                                      className="opacity-40 hover:opacity-100 hover:text-red-500 ml-0.5"
                                    >
                                      <X size={11} />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>

                            {/* Quick Item Input */}
                            <div className="pt-2 border-t border-edge/60 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={draft}
                                  onChange={(e) =>
                                    setItemDrafts((prev) => ({ ...prev, [outfit.id]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddItem(outfit.id)
                                    }
                                  }}
                                  placeholder={t('outfits.itemPlaceholder', 'Type or select clothing item...')}
                                  list={`clothing-list-${outfit.id}`}
                                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-card border border-edge text-xs text-content placeholder:text-content-faint focus:outline-hidden focus:border-accent"
                                />
                                <datalist id={`clothing-list-${outfit.id}`}>
                                  {clothingSuggestions.map((name, i) => (
                                    <option key={i} value={name} />
                                  ))}
                                </datalist>
                                <button
                                  type="button"
                                  onClick={() => handleAddItem(outfit.id)}
                                  disabled={!draft}
                                  className="px-2.5 py-1.5 rounded-lg bg-accent text-accent-text text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>

                              {/* Toggle: Add to personal packing list */}
                              {draft && !clothingSuggestions.some((s) => s.toLowerCase() === draft.toLowerCase()) && (
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-content-muted cursor-pointer hover:text-content">
                                  <input
                                    type="checkbox"
                                    checked={willAddToPack}
                                    onChange={(e) =>
                                      setAddToPackToggles((prev) => ({
                                        ...prev,
                                        [outfit.id]: e.target.checked,
                                      }))
                                    }
                                    className="rounded border-edge text-accent focus:ring-0"
                                  />
                                  <span>{t('outfits.addToPacking', 'Also add to personal packing list')}</span>
                                </label>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Inline "+ Add Outfit" Form */}
                    {addingDayId === day.id ? (
                      <div className="p-4 rounded-xl bg-surface-secondary border border-edge space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs uppercase tracking-wider text-content-muted">
                            {t('outfits.addOutfit', 'Plan an Outfit')}
                          </h4>
                          <button
                            type="button"
                            onClick={() => setAddingDayId(null)}
                            className="text-content-faint hover:text-content"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Title presets */}
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_TITLES.map((p) => {
                            const Icon = p.icon
                            const isSelected = newOutfitTitle === p.label
                            return (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => setNewOutfitTitle(p.label)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                  isSelected
                                    ? 'bg-accent text-accent-text border-transparent'
                                    : 'bg-surface-card border-edge text-content-muted hover:text-content'
                                }`}
                              >
                                <Icon size={12} />
                                <span>{p.label}</span>
                              </button>
                            )
                          })}
                        </div>

                        {/* Custom title input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newOutfitTitle}
                            onChange={(e) => setNewOutfitTitle(e.target.value)}
                            placeholder={t('outfits.titlePlaceholder', 'Outfit name (e.g. Daywear, Dinner)')}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-surface-card border border-edge text-xs text-content focus:outline-hidden focus:border-accent"
                          />
                          <button
                            type="button"
                            onClick={() => handleCreateOutfit(day.id)}
                            className="px-4 py-1.5 rounded-lg bg-accent text-accent-text text-xs font-semibold hover:opacity-90"
                          >
                            {t('common.save', 'Save')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingDayId(day.id)
                          setNewOutfitTitle('Daywear')
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-content-muted hover:text-content hover:bg-surface-hover px-3 py-1.5 rounded-lg border border-dashed border-edge transition-colors"
                      >
                        <Plus size={13} />
                        <span>{t('outfits.addOutfit', 'Add outfit')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Collapsible Wardrobe Inventory Drawer ── */}
        {showWardrobeDrawer && (
          <div className="w-80 bg-surface-card rounded-2xl border border-edge-subtle p-4 flex flex-col shrink-0 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-edge mb-3">
              <div className="flex items-center gap-2">
                <Shirt size={15} className="text-accent" />
                <h3 className="font-semibold text-sm text-content">
                  {t('outfits.myWardrobe', 'Wardrobe Inventory')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWardrobeDrawer(false)}
                className="text-content-faint hover:text-content p-1"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-xs text-content-muted mb-3">
              {t('outfits.wardrobeHint', 'Items from your packing list with usage counts.')}
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {inventory.length === 0 ? (
                <div className="py-8 text-center text-xs text-content-faint">
                  {t('outfits.inventoryEmpty', 'No clothing items in your packing list yet.')}
                </div>
              ) : (
                inventory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-surface-secondary/60 border border-edge flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.checked ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <Circle size={12} className="text-content-faint shrink-0" />
                      )}
                      <span className="font-medium text-content truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.wear_count > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-semibold">
                          {item.wear_count}×
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-surface-tertiary text-content-faint text-[10px]">
                          0×
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Copy Outfit Modal ── */}
      {copyingOutfit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-2xl border border-edge shadow-xl p-5 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-sm text-content">
              {t('outfits.copyToDay', 'Copy outfit to another day')}
            </h3>

            <p className="text-xs text-content-muted">
              Copy <span className="font-semibold text-content">{copyingOutfit.title}</span> to:
            </p>

            <select
              value={targetCopyDayId ?? ''}
              onChange={(e) => setTargetCopyDayId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-edge text-xs text-content focus:outline-hidden focus:border-accent"
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  Day {d.day_number} {d.date ? `(${d.date})` : ''}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCopyingOutfit(null)}
                className="px-3 py-1.5 rounded-lg border border-edge text-xs font-medium text-content-muted hover:bg-surface-hover"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleCopyOutfit}
                className="px-4 py-1.5 rounded-lg bg-accent text-accent-text text-xs font-semibold hover:opacity-90"
              >
                {t('common.copy', 'Copy')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OutfitsPlannerPanel

