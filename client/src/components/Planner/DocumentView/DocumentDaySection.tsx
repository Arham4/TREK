import React from 'react'
import {
  Calendar, Hotel, Plus, Info, MapPin, LogIn, LogOut, Moon, Sun
} from 'lucide-react'
import type { Day, Category, Assignment, Place, Accommodation, Reservation } from '../../../types'
import type { MergedItem } from '../../../utils/dayMerge'
import type { getDayBookendHotels } from '../../../utils/dayOrder'
import { formatDate, formatTime } from '../../../utils/formatters'
import { DocumentTimelineItem } from './DocumentTimelineItem'
import WeatherWidget from '../../Weather/WeatherWidget'
import { useDocI18n } from './docI18n'

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
}) => {
  const strings = useDocI18n()
  const dayNumber = day.day_number ?? (index + 1)

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
            <h3 className="text-2xl sm:text-3xl font-extrabold text-content tracking-tight">
              {day.title || `Day ${dayNumber}`}
            </h3>
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
            <DocumentTimelineItem
              key={
                item.type === 'place'
                  ? `place-${item.data.id}`
                  : item.type === 'transport'
                  ? `transport-${item.data.id}`
                  : `note-${item.data.id}`
              }
              item={item}
              dayId={day.id}
              index={idx}
              totalItems={items.length}
              categories={categories}
              compactMode={compactMode}
              reservations={reservations}
              locale={locale}
              timeFormat={timeFormat}
              onPlaceClick={onPlaceClick}
              onEditPlace={onEditPlace}
              onRemoveAssignment={onRemoveAssignment}
              onMoveItem={onMoveItem}
              onReservationClick={onReservationClick}
            />
          ))
        )}
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
