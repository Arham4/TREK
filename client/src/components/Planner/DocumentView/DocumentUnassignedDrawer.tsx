import React, { useState, useMemo } from 'react'
import { X, Search, MapPin, Plus, Star, Check } from 'lucide-react'
import type { Place, Category, Day } from '../../../types'
import PlaceAvatar from '../../shared/PlaceAvatar'
import { getCategoryIcon } from '../../shared/categoryIcons'
import { useDocI18n } from './docI18n'

interface DocumentUnassignedDrawerProps {
  isOpen: boolean
  onClose: () => void
  places: Place[]
  categories: Category[]
  days: Day[]
  onAssignToDay?: (placeId: number, dayId: number) => void
  onPlaceClick?: (placeId: number) => void
}

export const DocumentUnassignedDrawer: React.FC<DocumentUnassignedDrawerProps> = ({
  isOpen,
  onClose,
  places,
  categories,
  days,
  onAssignToDay,
  onPlaceClick,
}) => {
  const strings = useDocI18n()
  const [search, setSearch] = useState('')
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [assigningPlaceId, setAssigningPlaceId] = useState<number | null>(null)

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase()
    return places.filter(p => {
      if (selectedCatId != null && p.category_id !== selectedCatId) return false
      if (!q) return true
      return (
        p.name?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    })
  }, [places, selectedCatId, search])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-y-0 right-0 w-full sm:w-96 bg-surface-card border-l border-edge shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
      role="dialog"
      aria-label={strings.unassignedDrawerTitle}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-edge-faint bg-surface-secondary/40">
        <div>
          <h3 className="text-body font-bold text-content">{strings.unassignedDrawerTitle}</h3>
          <p className="text-caption text-content-faint">{places.length} places waiting to be scheduled</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-content-faint hover:text-content hover:bg-surface-secondary transition-colors"
          aria-label={strings.close}
        >
          <X size={18} />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-edge-faint">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-faint pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search places..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-body bg-surface-secondary border border-edge-faint focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCatId(null)}
              className={`px-2.5 py-1 rounded-full text-caption font-semibold flex-shrink-0 transition-colors ${
                selectedCatId === null
                  ? 'bg-accent text-accent-text'
                  : 'bg-surface-secondary text-content-muted hover:text-content'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatId(selectedCatId === cat.id ? null : cat.id)}
                className={`px-2.5 py-1 rounded-full text-caption font-semibold flex-shrink-0 transition-colors ${
                  selectedCatId === cat.id
                    ? 'bg-accent text-accent-text'
                    : 'bg-surface-secondary text-content-muted hover:text-content'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Place List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredPlaces.length === 0 ? (
          <div className="text-center py-12 px-4 text-content-muted">
            <MapPin size={28} className="mx-auto mb-2 text-content-faint opacity-60" />
            <p className="text-body font-medium">{strings.unassignedDrawerEmpty}</p>
          </div>
        ) : (
          filteredPlaces.map(place => {
            const cat = categories.find(c => c.id === place.category_id)
            const CatIcon = getCategoryIcon(cat?.icon)
            const isAssigning = assigningPlaceId === place.id

            return (
              <div
                key={place.id}
                className="p-3.5 rounded-2xl bg-surface-secondary/40 hover:bg-surface-secondary border border-edge-faint transition-all"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {cat && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold"
                          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                        >
                          <CatIcon size={10} />
                          <span>{cat.name}</span>
                        </span>
                      )}
                      {place.rating != null && place.rating > 0 && (
                        <span className="flex items-center gap-1 text-caption font-semibold text-amber-500">
                          <Star size={10} fill="currentColor" />
                          <span>{place.rating.toFixed(1)}</span>
                        </span>
                      )}
                    </div>
                    <h4
                      onClick={() => onPlaceClick?.(place.id)}
                      className="text-body font-bold text-content hover:text-accent cursor-pointer truncate"
                    >
                      {place.name}
                    </h4>
                    {place.address && (
                      <p className="text-caption text-content-muted truncate mt-0.5">{place.address}</p>
                    )}
                  </div>

                  <div
                    className="cursor-pointer flex-shrink-0"
                    onClick={() => onPlaceClick?.(place.id)}
                  >
                    <PlaceAvatar place={place} category={cat} size={40} />
                  </div>
                </div>

                {/* Day Assignment Trigger */}
                <div className="mt-3 pt-2.5 border-t border-edge-faint/60 flex items-center justify-between">
                  {isAssigning ? (
                    <div className="flex items-center gap-1.5 flex-wrap w-full animate-in fade-in">
                      <span className="text-caption font-semibold text-content-faint">Add to:</span>
                      {days.map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            onAssignToDay?.(place.id, d.id)
                            setAssigningPlaceId(null)
                          }}
                          className="px-2 py-1 rounded-lg text-caption font-semibold bg-accent text-accent-text hover:opacity-90"
                        >
                          D{d.day_number}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAssigningPlaceId(null)}
                        className="p-1 rounded-lg text-content-faint hover:text-content text-caption"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAssigningPlaceId(place.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-caption font-semibold bg-accent/10 hover:bg-accent hover:text-accent-text text-accent transition-colors ml-auto"
                    >
                      <Plus size={12} strokeWidth={2.5} />
                      <span>{strings.assignToDay}</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
