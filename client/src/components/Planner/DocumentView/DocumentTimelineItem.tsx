import React from 'react'
import {
  Clock, MapPin, ChevronUp, ChevronDown, Edit2, Trash2,
  ExternalLink, Plane, Train, Car, Bus, Ticket, Footprints, MessageSquare,
  Star, Sparkles, Navigation, DollarSign
} from 'lucide-react'
import type { MergedItem } from '../../../utils/dayMerge'
import type { Place, Category, Assignment, Reservation, DayNote } from '../../../types'
import { getAssignmentReservations, getDisplayTimeForDay } from '../../../utils/dayMerge'
import PlaceAvatar from '../../shared/PlaceAvatar'
import { getCategoryIcon } from '../../shared/categoryIcons'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { markdownLinkComponents } from '../../shared/markdownLink'
import { formatTime, splitReservationDateTime } from '../../../utils/formatters'
import { useDocI18n } from './docI18n'

interface DocumentTimelineItemProps {
  item: MergedItem
  dayId: number
  index: number
  totalItems: number
  categories: Category[]
  compactMode?: boolean
  reservations?: Reservation[]
  locale?: string
  timeFormat?: string
  onPlaceClick?: (placeId: number, assignmentId?: number) => void
  onEditPlace?: (place: Place, assignmentId?: number) => void
  onRemoveAssignment?: (dayId: number, assignmentId: number) => void
  onMoveItem?: (dayId: number, assignmentId: number, direction: 'up' | 'down') => void
  onReservationClick?: (reservationId: number) => void
}

export const DocumentTimelineItem: React.FC<DocumentTimelineItemProps> = ({
  item,
  dayId,
  index,
  totalItems,
  categories,
  compactMode = true,
  reservations = [],
  locale = 'en',
  timeFormat = '24h',
  onPlaceClick,
  onEditPlace,
  onRemoveAssignment,
  onMoveItem,
  onReservationClick,
}) => {
  const strings = useDocI18n()

  // ── Place Item ──
  if (item.type === 'place') {
    const assignment = item.data
    const place = assignment.place
    if (!place) return null

    const category = categories.find(c => c.id === place.category_id)
    const CategoryIcon = getCategoryIcon(category?.icon)

    // Accurate time resolution: assignment time override -> place time
    const rawStartTime = assignment.assignment_time || place.place_time || assignment.place_time
    const rawEndTime = assignment.assignment_end_time || place.end_time || assignment.end_time
    const formattedStartTime = rawStartTime ? formatTime(rawStartTime, locale, timeFormat) : null
    const formattedEndTime = rawEndTime ? formatTime(rawEndTime, locale, timeFormat) : null
    const duration = place.duration_minutes

    // Attached bookings / tickets for this place
    const linkedReservations = getAssignmentReservations(reservations, assignment.id)

    // ── Compact Row View ──
    if (compactMode) {
      return (
        <div className="group/item flex flex-col gap-0.5 py-1.5 px-3 rounded-xl hover:bg-surface-secondary/80 border border-transparent hover:border-edge-faint transition-all">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Time or Step Number */}
              <span className="w-16 sm:w-20 text-caption font-bold text-content-muted text-right flex-shrink-0 font-mono tracking-tight">
                {formattedStartTime || `#${index + 1}`}
              </span>

              {/* Place Thumbnail Avatar (matching DayPlanSidebar) */}
              <div
                className="flex-shrink-0 cursor-pointer"
                onClick={() => onPlaceClick?.(place.id, assignment.id)}
              >
                <PlaceAvatar place={place} category={category} size={28} />
              </div>

              {/* Place Title */}
              <span
                onClick={() => onPlaceClick?.(place.id, assignment.id)}
                className="text-body font-semibold text-content hover:text-accent cursor-pointer truncate max-w-xs sm:max-w-sm"
              >
                {place.name}
              </span>

              {/* Category Pill */}
              {category && (
                <span
                  className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `${category.color}15`, color: category.color }}
                >
                  {category.name}
                </span>
              )}

              {/* Rating badge */}
              {place.rating != null && place.rating > 0 && (
                <span className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  <Star size={9} fill="currentColor" />
                  <span>{place.rating.toFixed(1)}</span>
                </span>
              )}

              {/* Short address snippet */}
              {place.address && (
                <span className="text-caption text-content-faint truncate hidden md:inline max-w-[220px]">
                  · {place.address}
                </span>
              )}

              {/* Linked booking chip */}
              {linkedReservations.length > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); onReservationClick?.(linkedReservations[0].id) }}
                  className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 cursor-pointer hover:bg-emerald-500/20"
                >
                  <Ticket size={10} />
                  <span>{linkedReservations[0].title || 'Ticket'}</span>
                </span>
              )}
            </div>

            {/* Hover Action Buttons */}
            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
              {onEditPlace && (
                <button
                  type="button"
                  onClick={() => onEditPlace(place, assignment.id)}
                  className="p-1 rounded text-content-faint hover:text-content hover:bg-surface-secondary transition-colors cursor-pointer"
                  title="Edit place"
                >
                  <Edit2 size={12} />
                </button>
              )}
              {onRemoveAssignment && (
                <button
                  type="button"
                  onClick={() => onRemoveAssignment(dayId, assignment.id)}
                  className="p-1 rounded text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                  title="Remove from day"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Assignment Note Snippet if present */}
          {assignment.notes && (
            <div className="pl-[74px] sm:pl-[90px] pr-4 text-caption text-content-muted italic line-clamp-1 flex items-center gap-1.5">
              <span className="truncate">{assignment.notes}</span>
            </div>
          )}
        </div>
      )
    }

    // ── Detailed Card View (Editorial / Google Docs Itinerary style) ──
    return (
      <div className="relative group/item flex items-start gap-3 sm:gap-4 my-3">
        {/* Left Time Column */}
        <div className="flex-shrink-0 w-20 sm:w-24 pt-1.5 text-right">
          {formattedStartTime ? (
            <div className="flex flex-col items-end">
              <span className="text-body font-bold text-content tracking-tight font-mono">
                {formattedStartTime}
              </span>
              {formattedEndTime && (
                <span className="text-caption text-content-faint font-mono">
                  {formattedEndTime}
                </span>
              )}
              {duration ? (
                <span className="text-[10px] text-content-faint font-medium mt-0.5">
                  ⏱️ {Math.floor(duration / 60) > 0 ? `${Math.floor(duration / 60)}h ` : ''}{duration % 60 ? `${duration % 60}m` : ''}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-caption font-semibold text-content-faint">
              Stop {index + 1}
            </span>
          )}
        </div>

        {/* Timeline Node: Place Avatar photo with ring */}
        <div
          className="flex-shrink-0 relative z-10 mt-1 cursor-pointer transition-transform hover:scale-105"
          onClick={() => onPlaceClick?.(place.id, assignment.id)}
          title={place.name}
        >
          <div className="rounded-full ring-4 ring-surface shadow-sm overflow-hidden flex items-center justify-center">
            <PlaceAvatar place={place} category={category} size={36} />
          </div>
        </div>

        {/* Place Card */}
        <div className="flex-1 min-w-0 bg-surface-card hover:bg-surface-elevated border border-edge-faint hover:border-edge rounded-2xl p-4 sm:p-5 transition-all shadow-sm">
          {/* Header Row: Category Badge + Rating + Actions */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {category && (
                <span
                  className="text-caption font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${category.color}15`,
                    color: category.color,
                  }}
                >
                  {category.name}
                </span>
              )}
              {place.rating != null && place.rating > 0 && (
                <span className="flex items-center gap-1 text-caption font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <Star size={11} fill="currentColor" />
                  <span>{place.rating.toFixed(1)}</span>
                </span>
              )}
              {place.price != null && place.price > 0 && (
                <span className="text-caption font-medium text-content-muted bg-surface-secondary px-2 py-0.5 rounded-full">
                  {place.currency || '$'}{place.price}
                </span>
              )}
            </div>

            {/* Hover-only subtle quick actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
              {onMoveItem && (
                <>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMoveItem(dayId, assignment.id, 'up')}
                    className="p-1 rounded text-content-faint hover:text-content hover:bg-surface-secondary disabled:opacity-20 transition-colors"
                    title="Move up"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={index === totalItems - 1}
                    onClick={() => onMoveItem(dayId, assignment.id, 'down')}
                    className="p-1 rounded text-content-faint hover:text-content hover:bg-surface-secondary disabled:opacity-20 transition-colors"
                    title="Move down"
                  >
                    <ChevronDown size={13} />
                  </button>
                </>
              )}
              {onEditPlace && (
                <button
                  type="button"
                  onClick={() => onEditPlace(place, assignment.id)}
                  className="p-1 rounded text-content-faint hover:text-content hover:bg-surface-secondary transition-colors"
                  title="Edit place"
                >
                  <Edit2 size={13} />
                </button>
              )}
              {onRemoveAssignment && (
                <button
                  type="button"
                  onClick={() => onRemoveAssignment(dayId, assignment.id)}
                  className="p-1 rounded text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors"
                  title="Remove from day"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Place Title & Image Layout */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4
                onClick={() => onPlaceClick?.(place.id, assignment.id)}
                className="text-title font-bold text-content hover:text-accent cursor-pointer transition-colors leading-snug"
              >
                {place.name}
              </h4>

              {/* Address / Location */}
              {place.address && (
                <p className="text-caption text-content-muted flex items-center gap-1.5 mt-1 line-clamp-1">
                  <MapPin size={12} className="text-content-faint flex-shrink-0" />
                  <span className="truncate">{place.address}</span>
                </p>
              )}
            </div>

            {/* Photo Thumbnail */}
            {place.image_url && (
              <div
                onClick={() => onPlaceClick?.(place.id, assignment.id)}
                className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden cursor-pointer border border-edge-faint bg-surface-secondary shadow-xs"
              >
                <img
                  src={place.image_url}
                  alt={place.name}
                  className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            )}
          </div>

          {/* Attached Bookings / Tickets */}
          {linkedReservations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {linkedReservations.map(res => {
                const { time: resTime } = splitReservationDateTime(res.reservation_time)
                const formattedResTime = resTime ? formatTime(resTime, locale, timeFormat) : null
                return (
                  <div
                    key={res.id}
                    onClick={() => onReservationClick?.(res.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-caption font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                  >
                    <Ticket size={12} />
                    <span>{res.title || 'Reservation'}</span>
                    {formattedResTime && <span className="font-mono">· {formattedResTime}</span>}
                    {res.reservation_code && <span className="font-mono text-content-muted">#{res.reservation_code}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Notes in Notion / Google Docs Callout Style */}
          {assignment.notes && (
            <div className="mt-3.5 pt-3 border-t border-edge-faint/80">
              <div className="bg-surface-secondary/40 border-l-[3px] border-accent/80 rounded-r-xl p-3 text-body text-content-secondary prose prose-sm dark:prose-invert max-w-none">
                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownLinkComponents}>
                  {assignment.notes}
                </Markdown>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Transport Item (Flights, Trains, Car Rentals, Drives) ──
  if (item.type === 'transport') {
    const res = item.data
    const isMultiDayCar = res.type === 'car' && res.end_day_id && res.end_day_id !== res.day_id
    const isCarPickup = isMultiDayCar && res.day_id === dayId
    const isCarDropoff = isMultiDayCar && res.end_day_id === dayId

    // Time determination
    const displayTime = getDisplayTimeForDay(res, dayId)
    const rawStartTime = isCarDropoff
      ? (res.reservation_end_time || res.reservation_time)
      : (displayTime || res.reservation_time)
    const { time: startTime } = splitReservationDateTime(rawStartTime)
    const { time: endTime } = splitReservationDateTime(res.reservation_end_time)
    const formattedStartTime = startTime ? formatTime(startTime, locale, timeFormat) : null
    const formattedEndTime = (endTime && !isCarPickup && !isCarDropoff) ? formatTime(endTime, locale, timeFormat) : null

    const Icon = res.type === 'flight' ? Plane : res.type === 'train' ? Train : res.type === 'car' ? Car : Ticket

    let meta: any = {}
    try {
      meta = typeof res.metadata === 'string' ? JSON.parse(res.metadata || '{}') : (res.metadata || {})
    } catch {
      meta = {}
    }

    const carrierLabel = meta.airline && meta.flight_number
      ? `${meta.airline} ${meta.flight_number}`
      : res.carrier || meta.flight_number || meta.train_number || ''

    // Descriptive title text for multi-day rentals
    let titleText = res.title || carrierLabel || res.type
    if (isCarPickup) {
      titleText = res.title && res.title.toLowerCase() !== 'car'
        ? `Pick up ${res.title}`
        : carrierLabel ? `Pick up ${carrierLabel}` : 'Pick up Rental Car'
    } else if (isCarDropoff) {
      titleText = res.title && res.title.toLowerCase() !== 'car'
        ? `Drop off ${res.title}`
        : carrierLabel ? `Drop off ${carrierLabel}` : 'Drop off Rental Car'
    }

    if (compactMode) {
      return (
        <div
          onClick={() => onReservationClick?.(res.id)}
          className={`group/item flex items-center justify-between gap-3 py-2 px-3 my-1 rounded-xl transition-all cursor-pointer ${
            isCarPickup
              ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20'
              : isCarDropoff
              ? 'bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20'
              : 'bg-accent/5 hover:bg-accent/10 border border-accent/15'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-16 sm:w-20 text-caption font-bold text-right flex-shrink-0 font-mono tracking-tight ${
              isCarPickup ? 'text-emerald-600 dark:text-emerald-400' : isCarDropoff ? 'text-amber-600 dark:text-amber-400' : 'text-accent'
            }`}>
              {formattedStartTime || (isCarPickup ? 'Pick-up' : isCarDropoff ? 'Drop-off' : 'Transit')}
            </span>

            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isCarPickup
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : isCarDropoff
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-accent/15 text-accent'
            }`}>
              <Icon size={12} />
            </div>

            {/* Badges for rental car */}
            {isCarPickup && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                Pick-up
              </span>
            )}
            {isCarDropoff && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                Drop-off
              </span>
            )}

            <span className="text-body font-semibold text-content truncate">
              {titleText}
            </span>

            {carrierLabel && carrierLabel !== res.title && !isCarPickup && !isCarDropoff && (
              <span className="text-caption text-content-muted font-mono hidden sm:inline">
                ({carrierLabel})
              </span>
            )}

            {res.location && (
              <span className="text-caption text-content-faint truncate hidden md:inline max-w-[200px]">
                · {res.location}
              </span>
            )}

            {res.reservation_code && (
              <span className="text-[10px] font-mono text-content-muted bg-surface-card border border-edge-faint px-1.5 py-0.5 rounded shadow-2xs">
                #{res.reservation_code}
              </span>
            )}
          </div>
          {formattedEndTime && (
            <span className="text-caption text-content-faint font-mono hidden sm:inline">
              arr. {formattedEndTime}
            </span>
          )}
        </div>
      )
    }

    return (
      <div className="relative group/item flex items-start gap-3 sm:gap-4 my-3">
        {/* Left Time Column */}
        <div className="flex-shrink-0 w-20 sm:w-24 pt-1.5 text-right">
          {formattedStartTime && (
            <div className="flex flex-col items-end">
              <span className={`text-body font-bold tracking-tight font-mono ${
                isCarPickup ? 'text-emerald-600 dark:text-emerald-400' : isCarDropoff ? 'text-amber-600 dark:text-amber-400' : 'text-accent'
              }`}>
                {formattedStartTime}
              </span>
              {formattedEndTime && (
                <span className="text-caption text-content-faint font-mono">
                  {formattedEndTime}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeline Node Icon */}
        <div className="flex-shrink-0 relative z-10 mt-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ring-4 ring-surface ${
            isCarPickup
              ? 'bg-emerald-600 text-white'
              : isCarDropoff
              ? 'bg-amber-600 text-white'
              : 'bg-accent text-accent-text'
          }`}>
            <Icon size={14} />
          </div>
        </div>

        {/* Transport Card */}
        <div
          onClick={() => onReservationClick?.(res.id)}
          className="flex-1 min-w-0 bg-surface-card hover:bg-surface-elevated border border-edge-faint hover:border-edge rounded-2xl p-4 sm:p-5 cursor-pointer transition-all shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-caption font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isCarPickup
                  ? 'text-emerald-600 bg-emerald-500/10'
                  : isCarDropoff
                  ? 'text-amber-600 bg-amber-500/10'
                  : 'text-accent bg-accent/10'
              }`}>
                {isCarPickup ? 'Car Pick-up' : isCarDropoff ? 'Car Drop-off' : res.type}
              </span>
              {carrierLabel && (
                <span className="text-body font-bold text-content">{carrierLabel}</span>
              )}
            </div>
            {res.reservation_code && (
              <span className="text-caption font-mono font-medium text-content-muted bg-surface-secondary px-2 py-0.5 rounded-lg border border-edge-faint">
                Conf: #{res.reservation_code}
              </span>
            )}
          </div>

          <h4 className="text-title font-bold text-content mt-1">
            {titleText}
          </h4>

          {res.location && (
            <p className="text-caption text-content-muted flex items-center gap-1.5 mt-1.5">
              <Navigation size={12} className="text-content-faint flex-shrink-0" />
              <span>{res.location}</span>
            </p>
          )}

          {res.notes && (
            <div className="mt-2.5 pt-2 border-t border-edge-faint/60 text-caption text-content-secondary italic">
              {res.notes}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Note Item (Day Notes / Reminders) ──
  if (item.type === 'note') {
    const note = item.data

    if (compactMode) {
      return (
        <div className="flex items-center gap-2.5 py-1.5 px-3 my-1 rounded-xl bg-amber-500/5 border border-amber-500/15 text-content-secondary">
          <span className="w-16 sm:w-20 text-caption font-semibold text-amber-500 text-right flex-shrink-0 font-mono">
            Note
          </span>
          <MessageSquare size={13} className="text-amber-500 flex-shrink-0" />
          <span className="text-body font-medium text-content truncate">
            {note.title || (note.body ? note.body.slice(0, 80) : 'Note')}
          </span>
        </div>
      )
    }

    return (
      <div className="relative group/item flex items-start gap-3 sm:gap-4 my-3">
        <div className="flex-shrink-0 w-20 sm:w-24 pt-1.5 text-right">
          <span className="text-caption font-semibold text-amber-500">Note</span>
        </div>

        <div className="flex-shrink-0 relative z-10 mt-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-sm ring-4 ring-surface">
            <MessageSquare size={13} />
          </div>
        </div>

        <div className="flex-1 min-w-0 bg-amber-500/5 dark:bg-amber-950/20 border-l-[3px] border-amber-500 rounded-r-2xl p-4 transition-all">
          {note.title && (
            <h5 className="text-body font-bold text-content mb-1">{note.title}</h5>
          )}
          {note.body && (
            <div className="text-body text-content-secondary prose prose-sm dark:prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownLinkComponents}>
                {note.body}
              </Markdown>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
