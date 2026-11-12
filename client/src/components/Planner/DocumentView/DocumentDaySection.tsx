import React, { Fragment, useEffect, useRef, useState } from 'react'
import {
  Calendar, Hotel, Plus, Info, MapPin, LogIn, LogOut, Moon, Sun, Search, GripVertical
} from 'lucide-react'
import type { Day, Category, Assignment, Place, Accommodation, Reservation, TripFile } from '../../../types'
import type { MergedItem } from '../../../utils/dayMerge'
import { parseTimeToMinutes } from '../../../utils/dayMerge'
import type { getDayBookendHotels } from '../../../utils/dayOrder'
import { formatDate, formatTime } from '../../../utils/formatters'
import { DocumentTimelineItem } from './DocumentTimelineItem'
import WeatherWidget from '../../Weather/WeatherWidget'
import { useDocI18n } from './docI18n'

/** The drag payload a document stop carries between its day's insertion lines. */
const DRAG_TYPE = 'application/x-trek-doc-stop'

interface DocumentDaySectionProps {
  day: Day
  index: number
  items: MergedItem[]
  bookends?: ReturnType<typeof getDayBookendHotels>
  categories: Category[]
  compactMode?: boolean
  reservations?: Reservation[]
  locale?: string
  timeFormat?: string
  onPlaceClick?: (placeId: number, assignmentId?: number) => void
  onEditPlace?: (place: Place, assignmentId?: number) => void
  onRemoveAssignment?: (dayId: number, assignmentId: number) => void
  onMoveItem?: (dayId: number, assignmentId: number, direction: 'up' | 'down') => void
  onDayDetail?: (day: Day) => void
  onAddPlaceForDay?: (dayId: number) => void
  onAddTransport?: (dayId: number) => void
  onAddReservation?: (dayId: number) => void
  onReservationClick?: (reservationId: number) => void
  /** Every place of the trip, for the in-between + picker. */
  places?: Place[]
  onAssignToDay?: (placeId: number, dayId: number, position?: number) => void
  onMoveAssignment?: (assignmentId: number, fromDayId: number, toDayId: number, position?: number) => void
  onReorderDay?: (dayId: number, orderedAssignmentIds: number[]) => void
  onUpdateDayTitle?: (dayId: number, title: string) => void
  onUpdateNotes?: (dayId: number, assignmentId: number, notes: string | null) => void
  /** Clears a stop's start/end times so a manual reorder that breaks time order sticks. */
  onClearAssignmentTime?: (dayId: number, assignmentId: number) => void | Promise<void>
  /** The trip's files, so booking chips can show their boarding passes. */
  files?: TripFile[]
  /** Creates a new place and inserts it at the picker's slot. */
  onCreatePlaceAt?: (name: string, dayId: number, position?: number) => void | Promise<void>
}

export const DocumentDaySection: React.FC<DocumentDaySectionProps> = ({
  day,
  index,
  items,
  bookends,
  categories,
  compactMode = true,
  reservations = [],
  locale = 'en',
  timeFormat = '24h',
  onPlaceClick,
  onEditPlace,
  onRemoveAssignment,
  onMoveItem,
  onDayDetail,
  onAddPlaceForDay,
  onAddTransport,
  onAddReservation,
  onReservationClick,
  places = [],
  onAssignToDay,
  onMoveAssignment,
  onReorderDay,
  onUpdateDayTitle,
  onUpdateNotes,
  onClearAssignmentTime,
  files = [],
  onCreatePlaceAt,
}) => {
  const strings = useDocI18n()
  const dayNumber = day.day_number ?? (index + 1)
  // Renaming the day where its title sits, instead of opening Day Details.
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])
  // The in-between + opens one picker at a time; `pickerAt` is the place index it inserts at.
  const [pickerAt, setPickerAt] = useState<number | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  // A dragged stop shows its landing line as it passes a divider.
  const [dragOverAt, setDragOverAt] = useState<number | null>(null)
  // A timed stop dropped out of time order: the list draws by clock, so the
  // move only sticks once its start time is gone (same rule as the map
  // sidebar's time confirm). Held here until the user decides.
  const [timeConfirm, setTimeConfirm] = useState<{ assignmentId: number; order: number[]; time: string } | null>(null)

  const startTitleEdit = () => {
    if (!onUpdateDayTitle) return
    setTitleDraft(day.title || '')
    setEditingTitle(true)
  }
  const commitTitle = () => {
    if (!editingTitle) return
    setEditingTitle(false)
    const next = titleDraft.trim()
    if (next !== (day.title || '')) onUpdateDayTitle?.(day.id, next)
  }

  // ── Hotel Bookends Logic (100% accurate per day) ──
  const morningHotel = bookends?.morning
  const morningIsSleptHere = bookends?.morningIsSleptHere ?? false
  // Check-out only if traveler woke up here AND this is the checkout end day
  const isMorningCheckOut = morningIsSleptHere && morningHotel?.end_day_id === day.id
  // Morning wakeup if traveler woke up here and stay continues
  const isMorningStayContinues = morningIsSleptHere && !isMorningCheckOut

  const eveningHotel = bookends?.evening
  const eveningIsOvernight = bookends?.eveningIsOvernight ?? false
  // Check-in only on the initial arrival day of the stay
  const isEveningCheckIn = eveningIsOvernight && eveningHotel?.start_day_id === day.id
  // Overnight lodging for subsequent nights (without repeating check-in time)
  const isEveningOvernight = eveningIsOvernight && !isEveningCheckIn

  // Find coordinates for weather lookup (first stop or hotel)
  const firstLocatedPlace = items
    .filter((i): i is { type: 'place'; sortKey: number; data: Assignment } => i.type === 'place')
    .map(i => i.data.place)
    .find(p => p?.lat && p?.lng)

  const weatherLat = firstLocatedPlace?.lat ?? bookends?.morning?.place_lat ?? bookends?.evening?.place_lat ?? null
  const weatherLng = firstLocatedPlace?.lng ?? bookends?.morning?.place_lng ?? bookends?.evening?.place_lng ?? null

  // The stops in the order the document shows them. A divider's `position` counts
  // places only, which is the space the reorder and move writes work in.
  const placeAssignmentIds = items
    .filter((i): i is { type: 'place'; sortKey: number; data: Assignment } => i.type === 'place')
    .map(i => i.data.id)
  const placesOnDay = new Set(items.filter(i => i.type === 'place').map(i => i.data.place?.id))
  const insertChoices = places
    .filter(p => !placesOnDay.has(p.id))
    .filter(p => !pickerQuery.trim() || `${p.name} ${p.address || ''}`.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
  // The place index each listed item sits at, so its divider inserts in the same space
  // the reorder/move writes count.
  const placePositionOfItem = new Map<number, number>()
  {
    let seen = 0
    items.forEach((item, i) => {
      placePositionOfItem.set(i, seen)
      if (item.type === 'place') seen++
    })
  }

  const dragHandleProps = (assignmentId: number): React.HTMLAttributes<HTMLSpanElement> => ({
    draggable: true,
    onDragStart: e => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ assignmentId, dayId: day.id }))
      // Firefox only starts a drag when text/plain is present.
      e.dataTransfer.setData('text/plain', '')
    },
    onDragEnd: () => setDragOverAt(null),
  })

  const dropAt = (e: React.DragEvent, position: number) => {
    const raw = e.dataTransfer.getData(DRAG_TYPE)
    if (!raw) return
    e.preventDefault()
    e.stopPropagation()
    let payload: { assignmentId: number; dayId: number }
    try { payload = JSON.parse(raw) } catch { return }
    const fromIndex = placeAssignmentIds.indexOf(payload.assignmentId)
    if (payload.dayId === day.id) {
      if (fromIndex === -1 || !onReorderDay) return
      const order = placeAssignmentIds.filter(id => id !== payload.assignmentId)
      const target = fromIndex < position ? position - 1 : position
      order.splice(Math.max(0, Math.min(target, order.length)), 0, payload.assignmentId)
      // A timed stop is drawn by its clock: dropping it out of time order
      // would snap it straight back on render. Ask to drop its start time,
      // the way the map sidebar does, instead of losing the move silently.
      const minutesOf = (id: number): number | null => {
        const found = items.find(i => i.type === 'place' && i.data.id === id)
        if (!found) return null
        return parseTimeToMinutes(
          found.data?.assignment_time ?? found.data?.place?.place_time ?? found.data?.place_time,
        )
      }
      const movedMinutes = minutesOf(payload.assignmentId)
      if (movedMinutes !== null) {
        const timed = order.map(minutesOf).filter((t): t is number => t !== null)
        const chronological = timed.every((t, i) => i === 0 || t >= timed[i - 1])
        if (!chronological) {
          const moved = items.find(i => i.type === 'place' && i.data.id === payload.assignmentId)
          const raw = moved?.data?.assignment_time ?? moved?.data?.place?.place_time ?? moved?.data?.place_time
          setTimeConfirm({
            assignmentId: payload.assignmentId,
            order,
            time: typeof raw === 'string' && raw.includes(':') ? raw.substring(0, 5) : String(raw ?? ''),
          })
          setDragOverAt(null)
          return
        }
      }
      onReorderDay(day.id, order)
    } else {
      onMoveAssignment?.(payload.assignmentId, payload.dayId, day.id, position)
    }
    setDragOverAt(null)
  }

  const insertPlace = (placeId: number, position: number) => {
    onAssignToDay?.(placeId, day.id, position)
    setPickerAt(null)
    setPickerQuery('')
  }

  const insertDivider = (position: number) => {
    const canInsert = !!onAssignToDay || !!onAddPlaceForDay
    if (!canInsert && !onMoveAssignment && !onReorderDay) return null
    const open = pickerAt === position
    return (
      <div
        key={`insert-${position}`}
        data-testid={`doc-insert-${day.id}-${position}`}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOverAt(position)
        }}
        onDragLeave={() => setDragOverAt(at => (at === position ? null : at))}
        onDrop={e => dropAt(e, position)}
        className="group/insert relative flex h-4 items-center -my-1"
      >
        <div className={`h-0.5 flex-1 rounded-full transition-colors ${dragOverAt === position ? 'bg-accent' : 'bg-transparent group-hover/insert:bg-accent/30'}`} />
        {canInsert && (
          <button
            type="button"
            onClick={() => { setPickerAt(open ? null : position); setPickerQuery('') }}
            title={strings.insertStop}
            aria-label={strings.insertStop}
            aria-expanded={open}
            className={`mx-1 grid h-5 w-5 flex-none place-items-center rounded-full border border-accent/40 bg-surface text-accent transition-opacity hover:bg-accent hover:text-accent-text ${open || dragOverAt === position ? 'opacity-100' : 'opacity-0 group-hover/insert:opacity-100'}`}
          >
            <Plus size={12} strokeWidth={2.6} />
          </button>
        )}
        <div className={`h-0.5 flex-1 rounded-full transition-colors ${dragOverAt === position ? 'bg-accent' : 'bg-transparent group-hover/insert:bg-accent/30'}`} />

        {open && (
          <div data-testid="doc-insert-picker" className="absolute left-1/2 top-6 z-30 w-[min(20rem,84vw)] -translate-x-1/2 rounded-2xl border border-edge bg-surface-card p-2 shadow-xl" data-print-hide>
            <div className="relative mb-1.5">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
              <input
                autoFocus
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                placeholder={strings.insertSearchPlaceholder}
                aria-label={strings.insertSearchPlaceholder}
                className="w-full rounded-xl border border-edge-faint bg-surface px-8 py-1.5 text-caption text-content outline-none focus:border-accent"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {onCreatePlaceAt && (() => {
                const name = pickerQuery.trim()
                const exact = name !== '' && places.some(p => p.name?.toLowerCase() === name.toLowerCase())
                if (!name || exact) return null
                return (
                  <button
                    type="button"
                    data-testid="doc-insert-create"
                    onClick={() => { void onCreatePlaceAt(name, day.id, position); setPickerAt(null); setPickerQuery('') }}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent/10 px-2 py-1.5 text-left text-caption font-semibold text-accent hover:bg-accent hover:text-accent-text"
                  >
                    <Plus size={12} strokeWidth={2.5} className="flex-none" />
                    <span className="min-w-0 flex-1 truncate">
                      {strings.insertCreateHere.replace('{q}', name)}
                    </span>
                  </button>
                )
              })()}
              {insertChoices.length === 0 ? (
                <p className="m-0 px-2 py-3 text-center text-caption text-content-faint">{strings.insertNoPlaces}</p>
              ) : insertChoices.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => insertPlace(p.id, position)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-caption text-content hover:bg-surface-secondary"
                >
                  <MapPin size={12} className="flex-none text-content-faint" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{p.name}</span>
                    {p.address && <span className="block truncate text-[11px] text-content-faint">{p.address}</span>}
                  </span>
                </button>
              ))}
            </div>
            {onAddPlaceForDay && (
              <button
                type="button"
                onClick={() => { onAddPlaceForDay(day.id); setPickerAt(null) }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-edge-faint px-2 pb-1 pt-2 text-left text-caption font-semibold text-accent hover:bg-surface-secondary"
              >
                <Plus size={12} strokeWidth={2.5} />
                {strings.insertNewPlace}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <section
      id={`doc-day-${day.id}`}
      className="scroll-mt-20 mb-14"
    >
      {/* ── Editorial Day Chapter Header ── */}
      <div className="pb-4 mb-5 border-b-2 border-edge-faint">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-caption font-bold tracking-wider uppercase bg-accent text-accent-text shadow-xs">
                Day {dayNumber}
              </span>
              {day.date && (
                <span className="text-body font-semibold text-content-muted flex items-center gap-1.5">
                  <Calendar size={13} className="text-content-faint" />
                  <span>{formatDate(day.date, locale)}</span>
                </span>
              )}
            </div>
            {editingTitle ? (
              <input
                ref={titleRef}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingTitle(false) }
                }}
                aria-label={strings.editDayTitle}
                placeholder={`Day ${dayNumber}`}
                className="w-full border-0 border-b-2 border-accent bg-transparent p-0 text-2xl font-extrabold tracking-tight text-content outline-none sm:text-3xl"
              />
            ) : (
              <h3
                onClick={startTitleEdit}
                title={onUpdateDayTitle ? strings.editDayTitle : undefined}
                className={`text-2xl sm:text-3xl font-extrabold text-content tracking-tight ${onUpdateDayTitle ? 'cursor-text hover:text-accent/90' : ''}`}
              >
                {day.title || `Day ${dayNumber}`}
              </h3>
            )}
          </div>

          {/* Right Header Actions & Live Weather */}
          <div className="flex items-center gap-2 flex-wrap">
            {day.date && weatherLat && weatherLng && (
              <div className="bg-surface-secondary/80 border border-edge-faint rounded-xl px-2.5 py-1 shadow-xs">
                <WeatherWidget lat={weatherLat} lng={weatherLng} date={day.date} compact />
              </div>
            )}

            {onDayDetail && (
              <button
                type="button"
                onClick={() => onDayDetail(day)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-caption font-medium bg-surface-secondary hover:bg-surface-tertiary text-content border border-edge-faint transition-colors"
                title={strings.dayDetails}
              >
                <Info size={13} />
                <span className="hidden sm:inline">{strings.dayDetails}</span>
              </button>
            )}

            {onAddPlaceForDay && (
              <button
                type="button"
                onClick={() => onAddPlaceForDay(day.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-caption font-semibold bg-accent text-accent-text hover:opacity-90 shadow-xs transition-opacity"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>{strings.dayAddPlace}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Morning Hotel Bookend (Rendered ONLY when traveler slept here) ── */}
      {isMorningCheckOut && morningHotel && (
        compactMode ? (
          <div className="flex items-center gap-2.5 py-1.5 px-3 my-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
            <span className="w-16 sm:w-20 text-caption font-bold text-amber-600 dark:text-amber-400 text-right flex-shrink-0 font-mono">
              {morningHotel.check_out ? formatTime(morningHotel.check_out, locale, timeFormat) : 'Morning'}
            </span>
            <LogOut size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-body font-semibold truncate">
              Check-out · {morningHotel.place_name || 'Hotel'}
            </span>
          </div>
        ) : (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <LogOut size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-caption font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Check-out
                  </span>
                  {morningHotel.check_out && (
                    <span className="text-caption font-mono font-medium">
                      by {formatTime(morningHotel.check_out, locale, timeFormat)}
                    </span>
                  )}
                </div>
                <p className="text-body font-bold truncate">
                  {morningHotel.place_name || 'Hotel'}
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {isMorningStayContinues && morningHotel && (
        <div className={`rounded-xl border border-edge-faint flex items-center gap-2 text-content-muted ${
          compactMode ? 'py-1 px-3 my-1 bg-surface-secondary/40' : 'mb-4 py-2 px-3.5 bg-surface-secondary/40'
        }`}>
          {compactMode && (
            <span className="w-16 sm:w-20 text-caption font-medium text-right flex-shrink-0 font-mono text-content-faint">
              Morning
            </span>
          )}
          <Sun size={13} className="text-amber-500 flex-shrink-0" />
          <span className="text-caption font-medium truncate">
            Departing from <strong className="text-content">{morningHotel.place_name || 'Hotel'}</strong>
          </span>
        </div>
      )}

      {/* ── Timeline Flow ── */}
      {timeConfirm && (
        <div
          role="alertdialog"
          aria-label="Stop out of time order"
          className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-body text-content"
        >
          <p className="m-0 mb-2">
            This stop starts at <strong className="font-mono">{timeConfirm.time}</strong>, so the timeline
            would sort it back. Remove its start time to keep it here?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const pending = timeConfirm
                setTimeConfirm(null)
                try {
                  await onClearAssignmentTime?.(day.id, pending.assignmentId)
                } finally {
                  onReorderDay?.(day.id, pending.order)
                }
              }}
              className="px-3 py-1.5 rounded-xl text-caption font-semibold bg-amber-500 text-white hover:opacity-90 transition-opacity"
            >
              Remove time &amp; move
            </button>
            <button
              type="button"
              onClick={() => setTimeConfirm(null)}
              className="px-3 py-1.5 rounded-xl text-caption font-semibold bg-surface-card border border-edge-faint hover:bg-surface-secondary transition-colors"
            >
              Keep time
            </button>
          </div>
        </div>
      )}
      <div className="relative pl-1 sm:pl-2">
        {/* Continuous vertical timeline guide line */}
        {items.length > 0 && !compactMode && (
          <div
            className="absolute left-[95px] sm:left-[111px] top-4 bottom-4 w-0.5 bg-edge-faint -translate-x-1/2 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {items.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-edge bg-surface-secondary/20 my-4">
            <p className="text-body text-content-muted mb-3">{strings.dayNoItems}</p>
            {onAddPlaceForDay && (
              <button
                type="button"
                onClick={() => onAddPlaceForDay(day.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-body font-medium bg-surface-card hover:bg-surface-secondary text-content border border-edge transition-colors shadow-xs"
              >
                <Plus size={14} />
                <span>{strings.dayAddPlace}</span>
              </button>
            )}
          </div>
        ) : (
          items.map((item, idx) => (
            <Fragment key={
              item.type === 'place'
                ? `place-${item.data.id}`
                : item.type === 'transport'
                ? `transport-${item.data.id}`
                : `note-${item.data.id}`
            }>
              {item.type === 'place' && insertDivider(placePositionOfItem.get(idx) ?? 0)}
              <DocumentTimelineItem
                item={item}
                dayId={day.id}
                index={idx}
                totalItems={items.length}
                categories={categories}
                compactMode={compactMode}
                reservations={reservations}
                files={files}
                locale={locale}
                timeFormat={timeFormat}
                onPlaceClick={onPlaceClick}
                onEditPlace={onEditPlace}
                onRemoveAssignment={onRemoveAssignment}
                onMoveItem={onMoveItem}
                onReservationClick={onReservationClick}
                onUpdateNotes={onUpdateNotes}
                dragHandleProps={item.type === 'place' ? dragHandleProps(item.data.id) : undefined}
              />
            </Fragment>
          ))
        )}
        {items.length > 0 && insertDivider(placeAssignmentIds.length)}
      </div>

      {/* ── Evening Lodging / Hotel Bookend ── */}
      {isEveningCheckIn && eveningHotel && (
        compactMode ? (
          <div className="flex items-center gap-2.5 py-1.5 px-3 my-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-200">
            <span className="w-16 sm:w-20 text-caption font-bold text-indigo-600 dark:text-indigo-400 text-right flex-shrink-0 font-mono">
              {eveningHotel.check_in ? formatTime(eveningHotel.check_in, locale, timeFormat) : 'Night'}
            </span>
            <LogIn size={13} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <span className="text-body font-semibold truncate">
              Check-in · {eveningHotel.place_name || 'Hotel'}
            </span>
            {eveningHotel.place_address && (
              <span className="text-caption text-indigo-600/70 dark:text-indigo-300/70 truncate hidden md:inline">
                · {eveningHotel.place_address}
              </span>
            )}
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3 text-indigo-900 dark:text-indigo-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <LogIn size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-caption font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Check-in
                  </span>
                  {eveningHotel.check_in && (
                    <span className="text-caption font-mono font-medium">
                      after {formatTime(eveningHotel.check_in, locale, timeFormat)}
                    </span>
                  )}
                </div>
                <p className="text-body font-bold truncate">
                  {eveningHotel.place_name || 'Hotel'}
                </p>
                {eveningHotel.place_address && (
                  <p className="text-caption text-indigo-600/80 dark:text-indigo-300/80 truncate">
                    {eveningHotel.place_address}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {isEveningOvernight && eveningHotel && (
        <div className={`rounded-xl border border-edge-faint flex items-center gap-2 text-content-muted ${
          compactMode ? 'py-1 px-3 my-1 bg-surface-secondary/40' : 'mt-4 py-2.5 px-3.5 bg-surface-secondary/40'
        }`}>
          {compactMode && (
            <span className="w-16 sm:w-20 text-caption font-medium text-right flex-shrink-0 font-mono text-content-faint">
              Night
            </span>
          )}
          <Moon size={13} className="text-indigo-400 flex-shrink-0" />
          <span className="text-caption font-medium truncate">
            Overnight stay at <strong className="text-content">{eveningHotel.place_name || 'Hotel'}</strong>
          </span>
        </div>
      )}
    </section>
  )
}
