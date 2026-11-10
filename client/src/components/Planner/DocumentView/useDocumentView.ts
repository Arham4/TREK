import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Trip, Day, Place, Category, AssignmentsMap, Accommodation, Reservation, DayNote, Assignment } from '../../../types'
import { getMergedItems as _getMergedItems, getDisplayTimeForDay, getTransportForDay as _getTransportForDay, parseTimeToMinutes, type MergedItem } from '../../../utils/dayMerge'
import { chronoOrder } from '@trek/shared'
import { getDayBookendHotels } from '../../../utils/dayOrder'
import { useSettingsStore } from '../../../store/settingsStore'

export interface UseDocumentViewOptions {
  tripId: number
  trip: Trip
  days: Day[]
  places: Place[]
  categories: Category[]
  assignments: AssignmentsMap
  accommodations?: Accommodation[]
  reservations?: Reservation[]
  dayNotes?: Record<string, DayNote[]>
  locale?: string
  onSelectDay?: (dayId: number | null) => void
  onPlaceClick?: (placeId: number | null, assignmentId?: number | null) => void
  onEditPlace?: (place: Place, assignmentId?: number) => void
  onDayDetail?: (day: Day | null) => void
  onAddPlaceForDay?: (dayId: number) => void
  onAddTransport?: (dayId: number) => void
  onAddReservation?: (dayId: number) => void
  onAssignToDay?: (placeId: number, dayId: number, position?: number) => void
  onRemoveAssignment?: (dayId: number, assignmentId: number) => void
  onReorder?: (dayId: number, orderedIds: number[]) => void
  onDeletePlace?: (placeId: number) => void
}

export type PlanViewMode = 'map' | 'document'

export function useDocumentView(options: UseDocumentViewOptions) {
  const {
    tripId,
    trip,
    days,
    places,
    categories,
    assignments,
    accommodations = [],
    reservations = [],
    dayNotes = {},
    locale: propLocale,
    onSelectDay,
    onPlaceClick,
    onEditPlace,
    onDayDetail,
    onAddPlaceForDay,
    onAddTransport,
    onAddReservation,
    onAssignToDay,
    onRemoveAssignment,
    onReorder,
    onDeletePlace,
  } = options

  // User Settings: Time format & locale
  const timeFormat = useSettingsStore(s => s.settings.time_format) || '24h'
  const settingsLanguage = useSettingsStore(s => s.settings.language) || 'en'
  const locale = propLocale || settingsLanguage

  // 1. Master Kill-Switch / Feature Flag
  const isFeatureEnabled = useMemo(() => {
    try {
      if (typeof window === 'undefined') return true
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('docView') === '0') return false
      if (urlParams.get('docView') === '1') return true
      return localStorage.getItem('trek_doc_view_enabled') !== 'false'
    } catch {
      return true
    }
  })

  // 2. View Mode (Map vs. Document)
  const [viewMode, setViewModeState] = useState<PlanViewMode>(() => {
    try {
      const saved = localStorage.getItem(`trek_plan_view_mode_${tripId}`) || localStorage.getItem('trek_plan_view_mode')
      return (saved === 'map' || saved === 'document') ? saved : 'document'
    } catch {
      return 'document'
    }
  })

  const setViewMode = useCallback((mode: PlanViewMode) => {
    setViewModeState(mode)
    try {
      localStorage.setItem('trek_plan_view_mode', mode)
      localStorage.setItem(`trek_plan_view_mode_${tripId}`, mode)
    } catch {}
  }, [tripId])

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === 'document' ? 'map' : 'document')
  }, [viewMode, setViewMode])

  // Keyboard shortcut Alt+D to toggle
  useEffect(() => {
    if (!isFeatureEnabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        toggleViewMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFeatureEnabled, toggleViewMode])

  // 3. Compact Mode (always true - default clean layout)
  const compactMode = true
  const setCompactMode = useCallback((_val: boolean | ((prev: boolean) => boolean)) => {}, [])

  // 4. Outline rail collapse state
  const [outlineOpen, setOutlineOpen] = useState(true)

  // 5. Search and Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyActiveDays, setShowOnlyActiveDays] = useState(false)
  const [activeDayId, setActiveDayId] = useState<number | null>(days[0]?.id ?? null)
  const [unassignedDrawerOpen, setUnassignedDrawerOpen] = useState(false)

  // 6. Sorted Days
  const sortedDays = useMemo(() => {
    return [...(days || [])].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
  }, [days])

  // 7. Day Bookends Map (Morning & Night hotels)
  const dayBookendsMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof getDayBookendHotels>>()
    sortedDays.forEach(day => {
      map.set(day.id, getDayBookendHotels(day, sortedDays, accommodations))
    })
    return map
  }, [sortedDays, accommodations])

  // 8. Merged Items per Day (filter out synthetic accommodation stops and middle-day car rentals)
  const mergedItemsMap = useMemo(() => {
    const map = new Map<number, MergedItem[]>()
    sortedDays.forEach(day => {
      const dayAssignments = [...(assignments[String(day.id)] || [])]
        .filter(a => a.accommodation_id == null)
        .sort((a, b) => a.order_index - b.order_index)

      const dayNotesList = (dayNotes[String(day.id)] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      const dayAssignmentIds = dayAssignments.map(a => a.id)
      const rawTransports = _getTransportForDay({
        reservations: reservations || [],
        dayId: day.id,
        dayAssignmentIds,
        days: sortedDays,
      })

      // Multi-day car rentals: only show on pick-up day (start) and drop-off day (end).
      // Intermediate days are driving days and should not clutter the day timeline.
      const dayTransports = rawTransports.filter(r => {
        if (r.type === 'car') {
          const startDayId = r.day_id
          const endDayId = r.end_day_id ?? startDayId
          if (startDayId && endDayId && startDayId !== endDayId) {
            return day.id === startDayId || day.id === endDayId
          }
        }
        return true
      })

      const rawMergedItems = _getMergedItems({
        dayAssignments,
        dayNotes: dayNotesList,
        dayTransports,
        dayId: day.id,
        getDisplayTime: (r, dayId) => {
          if (r.type === 'car' && r.end_day_id && r.end_day_id !== r.day_id && dayId === r.end_day_id) {
            return r.reservation_end_time || r.reservation_time || null
          }
          return getDisplayTimeForDay(r, dayId)
        },
      })

      // Ensure stable, correct chronological sorting so early morning items (e.g. 6:30 AM)
      // don't get trapped at the bottom after late afternoon stops
      const items = chronoOrder(rawMergedItems, it => {
        if (it.type === 'place') {
          const rawTime = it.data?.assignment_time || it.data?.place?.place_time || it.data?.place_time
          return parseTimeToMinutes(rawTime)
        }
        if (it.type === 'note') {
          return parseTimeToMinutes(it.data?.time)
        }
        if (it.type === 'transport') {
          const r = it.data
          if (r.type === 'car' && r.end_day_id && r.end_day_id !== r.day_id && day.id === r.end_day_id) {
            return parseTimeToMinutes(r.reservation_end_time || r.reservation_time)
          }
          const dt = getDisplayTimeForDay(r, day.id)
          return parseTimeToMinutes(dt || r.reservation_time)
        }
        return null
      })

      map.set(day.id, items)
    })
    return map
  }, [sortedDays, assignments, dayNotes, reservations])

  // 9. Filtered Days (by search query and active toggle)
  const filteredDays = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sortedDays.filter(day => {
      const items = mergedItemsMap.get(day.id) || []
      const bookends = dayBookendsMap.get(day.id)

      if (showOnlyActiveDays && items.length === 0 && !bookends?.morning && !bookends?.evening) {
        return false
      }

      if (!query) return true

      // Match day title or date
      if (day.title?.toLowerCase().includes(query)) return true
      if (day.date?.toLowerCase().includes(query)) return true

      // Match hotel bookends
      if (bookends?.morning?.place_name?.toLowerCase().includes(query)) return true
      if (bookends?.evening?.place_name?.toLowerCase().includes(query)) return true

      // Match items in day
      return items.some(item => {
        if (item.type === 'place') {
          const place = item.data.place
          return (
            place?.name?.toLowerCase().includes(query) ||
            place?.address?.toLowerCase().includes(query) ||
            item.data.notes?.toLowerCase().includes(query)
          )
        }
        if (item.type === 'note') {
          return item.data.body?.toLowerCase().includes(query)
        }
        if (item.type === 'transport') {
          const res = item.data
          return (
            res.title?.toLowerCase().includes(query) ||
            res.location?.toLowerCase().includes(query) ||
            res.notes?.toLowerCase().includes(query) ||
            res.carrier?.toLowerCase().includes(query)
          )
        }
        return false
      })
    })
  }, [sortedDays, mergedItemsMap, dayBookendsMap, showOnlyActiveDays, searchQuery])

  // 10. Unassigned Places Pool
  const assignedPlaceIdSet = useMemo(() => {
    const set = new Set<number>()
    Object.values(assignments).forEach(dayList => {
      dayList?.forEach(a => {
        if (a.place?.id) set.add(a.place.id)
      })
    })
    return set
  }, [assignments])

  const unassignedPlaces = useMemo(() => {
    return (places || []).filter(p => !assignedPlaceIdSet.has(p.id))
  }, [places, assignedPlaceIdSet])

  // 11. Reordering within a day
  const moveItem = useCallback((dayId: number, assignmentId: number, direction: 'up' | 'down') => {
    const dayAssignments = [...(assignments[String(dayId)] || [])]
      .filter(a => a.accommodation_id == null)
      .sort((a, b) => a.order_index - b.order_index)
    const idx = dayAssignments.findIndex(a => a.id === assignmentId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= dayAssignments.length) return

    const reordered = [...dayAssignments]
    const temp = reordered[idx]
    reordered[idx] = reordered[targetIdx]
    reordered[targetIdx] = temp

    onReorder?.(dayId, reordered.map(a => a.id))
  }, [assignments, onReorder])

  // 12. Quick day jump
  const scrollToDay = useCallback((dayId: number) => {
    setActiveDayId(dayId)
    onSelectDay?.(dayId)
    const el = document.getElementById(`doc-day-${dayId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [onSelectDay])

  return {
    isFeatureEnabled,
    viewMode,
    setViewMode,
    toggleViewMode,
    compactMode,
    setCompactMode,
    outlineOpen,
    setOutlineOpen,
    searchQuery,
    setSearchQuery,
    showOnlyActiveDays,
    setShowOnlyActiveDays,
    activeDayId,
    setActiveDayId,
    unassignedDrawerOpen,
    setUnassignedDrawerOpen,
    sortedDays,
    filteredDays,
    dayBookendsMap,
    mergedItemsMap,
    unassignedPlaces,
    assignedPlaceIdSet,
    timeFormat,
    locale,
    scrollToDay,
    moveItem,
    // forwarded actions
    onPlaceClick,
    onEditPlace,
    onDayDetail,
    onAddPlaceForDay,
    onAddTransport,
    onAddReservation,
    onAssignToDay,
    onRemoveAssignment,
    onDeletePlace,
  }
}
