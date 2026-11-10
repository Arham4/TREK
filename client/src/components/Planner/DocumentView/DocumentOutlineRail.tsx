import React from 'react'
import { Calendar, MapPin, Sparkles, PanelLeftClose, SlidersHorizontal } from 'lucide-react'
import type { Day, Trip } from '../../../types'
import { formatDate } from '../../../utils/formatters'
import { useDocI18n } from './docI18n'
import type { MergedItem } from '../../../utils/dayMerge'

interface DocumentOutlineRailProps {
  trip: Trip
  days: Day[]
  activeDayId: number | null
  mergedItemsMap: Map<number, MergedItem[]>
  unassignedCount: number
  unassignedOpen: boolean
  onToggleUnassigned: () => void
  onSelectDay: (dayId: number) => void
  compactMode: boolean
  onToggleCompact: () => void
  onSwitchToMap: () => void
  onClose?: () => void
  locale?: string
}

export const DocumentOutlineRail: React.FC<DocumentOutlineRailProps> = ({
  trip,
  days,
  activeDayId,
  mergedItemsMap,
  unassignedCount,
  unassignedOpen,
  onToggleUnassigned,
  onSelectDay,
  compactMode,
  onToggleCompact,
  onSwitchToMap,
  onClose,
  locale = 'en',
}) => {
  const strings = useDocI18n()

  return (
    <aside
      className="hidden lg:flex flex-col flex-shrink-0 w-60 xl:w-64 border-r border-edge-faint bg-surface-secondary/30 select-none overflow-y-auto"
      style={{
        position: 'sticky',
        top: 0,
        height: '100%',
        padding: '20px 14px 20px 16px',
      }}
      aria-label={strings.outlineTitle}
    >
      {/* Rail Header with collapse toggle */}
      <div className="flex items-center justify-between gap-2 mb-4 px-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles size={13} className="text-accent flex-shrink-0" />
          <span className="text-caption font-bold tracking-wider uppercase text-content-faint truncate">
            {strings.outlineTitle}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-content-faint hover:text-content hover:bg-surface-secondary transition-colors"
            title="Collapse outline"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Trip Title & Dates */}
      <div className="mb-4 px-1">
        <h2 className="text-body font-bold text-content truncate leading-snug" title={trip.title}>
          {trip.title}
        </h2>
        {trip.start_date && (
          <p className="text-caption text-content-muted flex items-center gap-1.5 mt-0.5">
            <Calendar size={11} className="text-content-faint flex-shrink-0" />
            <span className="truncate">
              {formatDate(trip.start_date, locale)}
              {trip.end_date && trip.end_date !== trip.start_date ? ` – ${formatDate(trip.end_date, locale)}` : ''}
            </span>
          </p>
        )}
      </div>

      {/* Unassigned Quick Button */}
      <div className="mb-4 px-0.5">
        <button
          type="button"
          onClick={onToggleUnassigned}
          className={`flex items-center justify-between w-full px-3 py-1.5 rounded-xl text-caption font-semibold transition-all ${
            unassignedOpen
              ? 'bg-accent text-accent-text shadow-xs'
              : 'bg-surface-card hover:bg-surface-elevated text-content border border-edge-faint shadow-xs'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin size={13} className={unassignedOpen ? 'text-accent-text' : 'text-accent'} />
            <span className="truncate">{strings.outlineUnplanned}</span>
          </span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-caption font-mono font-bold ${
              unassignedOpen
                ? 'bg-white/20 text-accent-text'
                : 'bg-surface-secondary text-content-muted'
            }`}
          >
            {unassignedCount}
          </span>
        </button>
      </div>

      <div className="h-px bg-edge-faint mx-1 mb-3" />

      {/* Days Outline List */}
      <div className="flex-1 space-y-0.5 overflow-y-auto pr-0.5">
        <div className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-content-faint">
          {strings.statsDays} ({days.length})
        </div>

        {days.map((day, idx) => {
          const items = mergedItemsMap.get(day.id) || []
          const isActive = activeDayId === day.id
          const dayNum = day.day_number ?? (idx + 1)
          const placeCount = items.filter(i => i.type === 'place').length

          return (
            <button
              key={day.id}
              type="button"
              onClick={() => onSelectDay(day.id)}
              className={`w-full text-left rounded-xl px-2.5 py-2 transition-all flex items-center gap-2 group ${
                isActive
                  ? 'bg-surface-card text-content shadow-xs border border-edge font-semibold'
                  : 'text-content-muted hover:text-content hover:bg-surface-card/60'
              }`}
            >
              {/* Day badge */}
              <div
                className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-text'
                    : 'bg-surface-secondary text-content-faint group-hover:text-content'
                }`}
              >
                {dayNum}
              </div>

              {/* Day info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-caption font-semibold truncate">
                    {day.title || `Day ${dayNum}`}
                  </span>
                  {placeCount > 0 && (
                    <span className="text-[10px] text-content-faint font-mono flex-shrink-0">
                      {placeCount}
                    </span>
                  )}
                </div>
                {day.date && (
                  <p className="text-[11px] text-content-faint font-medium truncate mt-0.5">
                    {formatDate(day.date, locale)}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
