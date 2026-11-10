import { outfitsApi } from '../api/client'
import { offlineDb } from '../db/offlineDb'
import { mutationQueue, generateUUID, nextTempId } from '../sync/mutationQueue'
import { isEffectivelyOffline } from '../sync/networkMode'
import { onlineThenCache } from './withOfflineFallback'
import type {
  Outfit,
  OutfitItem,
  CreateOutfitRequest,
  UpdateOutfitRequest,
  CopyOutfitRequest,
  AddOutfitItemRequest,
} from '../types'

export const outfitsRepo = {
  async list(tripId: number | string, params?: { dayId?: number; userId?: number }): Promise<Outfit[]> {
    return onlineThenCache(
      async () => {
        const outfits = await outfitsApi.list(tripId, params)
        if (outfits && Array.isArray(outfits)) {
          await offlineDb.outfits.bulkPut(outfits)
        }
        return outfits
      },
      async () => {
        const coll = offlineDb.outfits.where('trip_id').equals(Number(tripId))
        let arr = await coll.toArray()
        if (params?.dayId != null) arr = arr.filter(o => o.day_id === params.dayId)
        if (params?.userId != null) arr = arr.filter(o => o.user_id === params.userId)
        return arr
      },
    )
  },

  async create(tripId: number | string, data: CreateOutfitRequest): Promise<Outfit> {
    if (isEffectivelyOffline()) {
      const tempId = nextTempId()
      const optimistic: Outfit = {
        id: tempId,
        trip_id: Number(tripId),
        day_id: data.day_id,
        user_id: data.user_id,
        title: data.title || 'Daywear',
        time_of_day: data.time_of_day || null,
        notes: data.notes || null,
        sort_order: 0,
        items: (data.items || []).map((it, idx) => ({
          id: nextTempId() - idx,
          outfit_id: tempId,
          trip_id: Number(tripId),
          name: it.name,
          packing_item_id: it.packing_item_id || null,
          category: it.category || null,
          sort_order: idx,
        })),
        created_at: new Date().toISOString(),
      }
      await offlineDb.outfits.put(optimistic)
      const mutId = generateUUID()
      await mutationQueue.enqueue({
        id: mutId,
        tripId: Number(tripId),
        method: 'POST',
        url: `/trips/${tripId}/outfits`,
        body: data,
        resource: 'outfits',
        tempId,
      })
      return optimistic
    }
    const created = await outfitsApi.create(tripId, data)
    await offlineDb.outfits.put(created)
    return created
  },

  async update(tripId: number | string, id: number, data: UpdateOutfitRequest): Promise<Outfit> {
    if (isEffectivelyOffline()) {
      const existing = await offlineDb.outfits.get(id)
      const optimistic: Outfit = { ...(existing ?? ({} as Outfit)), ...(data as Partial<Outfit>), id }
      await offlineDb.outfits.put(optimistic)
      const mutId = generateUUID()
      const isTemp = id < 0
      await mutationQueue.enqueue({
        id: mutId,
        tripId: Number(tripId),
        method: 'PUT',
        url: isTemp ? `/trips/${tripId}/outfits/{id}` : `/trips/${tripId}/outfits/${id}`,
        body: data,
        resource: 'outfits',
        entityId: id,
        ...(isTemp ? { tempEntityId: id } : {}),
      })
      return optimistic
    }
    const updated = await outfitsApi.update(tripId, id, data)
    await offlineDb.outfits.put(updated)
    return updated
  },

  async delete(tripId: number | string, id: number): Promise<unknown> {
    if (isEffectivelyOffline()) {
      await offlineDb.outfits.delete(id)
      const mutId = generateUUID()
      const isTemp = id < 0
      await mutationQueue.enqueue({
        id: mutId,
        tripId: Number(tripId),
        method: 'DELETE',
        url: isTemp ? `/trips/${tripId}/outfits/{id}` : `/trips/${tripId}/outfits/${id}`,
        body: undefined,
        resource: 'outfits',
        entityId: id,
        ...(isTemp ? { tempEntityId: id } : {}),
      })
      return { success: true }
    }
    const result = await outfitsApi.delete(tripId, id)
    await offlineDb.outfits.delete(id)
    return result
  },

  async copy(tripId: number | string, id: number, data: CopyOutfitRequest): Promise<Outfit> {
    const copied = await outfitsApi.copy(tripId, id, data)
    await offlineDb.outfits.put(copied)
    return copied
  },

  async addItem(tripId: number | string, outfitId: number, data: AddOutfitItemRequest): Promise<OutfitItem> {
    const item = await outfitsApi.addItem(tripId, outfitId, data)
    const existing = await offlineDb.outfits.get(outfitId)
    if (existing) {
      existing.items = [...(existing.items || []), item]
      await offlineDb.outfits.put(existing)
    }
    return item
  },

  async deleteItem(tripId: number | string, outfitId: number, itemId: number): Promise<{ ok: boolean }> {
    const result = await outfitsApi.deleteItem(tripId, outfitId, itemId)
    const existing = await offlineDb.outfits.get(outfitId)
    if (existing) {
      existing.items = (existing.items || []).filter(i => i.id !== itemId)
      await offlineDb.outfits.put(existing)
    }
    return result
  },
}
