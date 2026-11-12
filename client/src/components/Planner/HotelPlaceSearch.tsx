import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { mapsApi } from '../../api/client'
import { useLocationBias } from '../../hooks/useLocationBias'
import { usePlaceLanguage } from '../../hooks/usePlaceLanguage'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import { useTripStore } from '../../store/tripStore'
import type { Place } from '../../types'
import { useSuggestionDropdown } from './useSuggestionDropdown'
import { PlaceSuggestion, SuggestionInputBox, SuggestionList, SuggestionRow } from './SuggestionDropdown'

interface HotelPlaceSearchProps {
  tripId: number
  onCreated: (place: Place) => void
}

type SearchRow = {
  name?: string
  address?: string
  lat?: number
  lng?: number
  google_place_id?: string
  osm_id?: string
  website?: string
  phone?: string
}

/**
 * Search any hotel or address from inside the stay editor.
 *
 * Until now the picker could only list the trip's existing places, so a new
 * lodging meant leaving the day, adding the place elsewhere and coming back.
 * A pick here writes the place and hands it straight back to the editor, which
 * links it to the stay in the same visit.
 */
export function HotelPlaceSearch({ tripId, onCreated }: HotelPlaceSearchProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const placeLang = usePlaceLanguage()
  const { point: locationBias } = useLocationBias()
  const addPlace = useTripStore(s => s.addPlace)
  const { open, setOpen, highlight, setHighlight, wrapRef, handleKey } = useSuggestionDropdown()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const search = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = text.trim()
    if (trimmed.length < 2) {
      reqIdRef.current++
      setResults([])
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const myReq = ++reqIdRef.current
      setLoading(true)
      try {
        const data = await mapsApi.search(trimmed, placeLang, locationBias)
        if (myReq !== reqIdRef.current) return
        setResults((data.places || []) as SearchRow[])
        setHighlight(-1)
      } catch {
        if (myReq === reqIdRef.current) setResults([])
      } finally {
        if (myReq === reqIdRef.current) setLoading(false)
      }
    }, 320)
  }

  const pick = async (row: SearchRow) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    reqIdRef.current++
    const name = (row.name || row.address || query).trim()
    if (!name) return
    setOpen(false)
    setResults([])
    setLoading(false)
    setCreating(true)
    try {
      const lat = Number(row.lat)
      const lng = Number(row.lng)
      const place = await addPlace(tripId, {
        name,
        address: row.address || null,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        google_place_id: row.google_place_id || null,
        osm_id: row.osm_id || null,
        website: row.website || null,
        phone: row.phone || null,
      } as Partial<Place> & { name: string })
      setQuery('')
      onCreated(place)
      toast.success(t('day.hotelPlaceAdded', { name: place.name }))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.unknownError'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <SuggestionInputBox
        icon={<Search size={14} className="text-content-faint" />}
        query={query}
        placeholder={t('day.searchHotelPlaceholder')}
        onType={text => { setQuery(text); setOpen(true); search(text) }}
        onOpen={() => setOpen(true)}
        onKeyDown={e => handleKey(e, results, row => { void pick(row as SearchRow) })}
        onClear={query ? () => { setQuery(''); setResults([]); setOpen(false) } : undefined}
        inputAria={{
          'aria-label': t('day.searchHotelPlaceholder'),
          'aria-busy': loading || creating,
        }}
      />
      {open && (
        <div data-testid="hotel-place-suggestions">
          <SuggestionList loading={loading || creating} rowCount={results.length}>
            {results.map((row, i) => (
              <SuggestionRow
                key={`${row.google_place_id || row.osm_id || row.name || i}`}
                active={i === highlight}
                onPick={() => { void pick(row) }}
                onHover={() => setHighlight(i)}
                align="flex-start"
              >
                <PlaceSuggestion name={row.name} address={row.address} />
              </SuggestionRow>
            ))}
          </SuggestionList>
        </div>
      )}
      <p className="m-0 mt-1.5 px-0.5 text-content-faint" style={{ fontSize: 'calc(11px * var(--fs-scale-caption, 1))' }}>
        {t('day.searchHotelHint')}
      </p>
    </div>
  )
}
