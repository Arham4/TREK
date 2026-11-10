import { outfitsRepo } from '../../repo/outfitsRepo'
import type { StoreApi } from 'zustand'
import type { TripStoreState } from '../tripStore'
import type {
  Outfit,
  OutfitItem,
  CreateOutfitRequest,
  UpdateOutfitRequest,
  CopyOutfitRequest,
  AddOutfitItemRequest,
} from '../../types'
import { getApiErrorMessage } from '../../types'

type SetState = StoreApi<TripStoreState>['setState']
type GetState = StoreApi<TripStoreState>['getState']

export interface OutfitsSlice {
  outfits: Outfit[]
  loadOutfits: (tripId: number | string, params?: { dayId?: number; userId?: number }) => Promise<Outfit[]>
  addOutfit: (tripId: number | string, data: CreateOutfitRequest) => Promise<Outfit>
  updateOutfit: (tripId: number | string, id: number, data: UpdateOutfitRequest) => Promise<Outfit>
  deleteOutfit: (tripId: number | string, id: number) => Promise<void>
  copyOutfit: (tripId: number | string, id: number, data: CopyOutfitRequest) => Promise<Outfit>
  addOutfitItem: (tripId: number | string, outfitId: number, data: AddOutfitItemRequest) => Promise<OutfitItem>
  deleteOutfitItem: (tripId: number | string, outfitId: number, itemId: number) => Promise<void>
}

export const createOutfitsSlice = (set: SetState, get: GetState): OutfitsSlice => ({
  outfits: [],

  loadOutfits: async (tripId, params) => {
    try {
      const items = await outfitsRepo.list(tripId, params)
      set({ outfits: items })
      return items
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error loading outfits'))
    }
  },

  addOutfit: async (tripId, data) => {
    try {
      const created = await outfitsRepo.create(tripId, data)
      set((state) => ({ outfits: [...state.outfits, created] }))
      return created
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error creating outfit'))
    }
  },

  updateOutfit: async (tripId, id, data) => {
    try {
      const updated = await outfitsRepo.update(tripId, id, data)
      set((state) => ({
        outfits: state.outfits.map((o) => (o.id === id ? updated : o)),
      }))
      return updated
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error updating outfit'))
    }
  },

  deleteOutfit: async (tripId, id) => {
    const prev = get().outfits
    set((state) => ({ outfits: state.outfits.filter((o) => o.id !== id) }))
    try {
      await outfitsRepo.delete(tripId, id)
    } catch (err: unknown) {
      set({ outfits: prev })
      throw new Error(getApiErrorMessage(err, 'Error deleting outfit'))
    }
  },

  copyOutfit: async (tripId, id, data) => {
    try {
      const created = await outfitsRepo.copy(tripId, id, data)
      set((state) => ({ outfits: [...state.outfits, created] }))
      return created
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error copying outfit'))
    }
  },

  addOutfitItem: async (tripId, outfitId, data) => {
    try {
      const item = await outfitsRepo.addItem(tripId, outfitId, data)
      set((state) => ({
        outfits: state.outfits.map((o) =>
          o.id === outfitId ? { ...o, items: [...(o.items || []), item] } : o,
        ),
      }))
      return item
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error adding outfit item'))
    }
  },

  deleteOutfitItem: async (tripId, outfitId, itemId) => {
    try {
      await outfitsRepo.deleteItem(tripId, outfitId, itemId)
      set((state) => ({
        outfits: state.outfits.map((o) =>
          o.id === outfitId
            ? { ...o, items: (o.items || []).filter((i) => i.id !== itemId) }
            : o,
        ),
      }))
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error removing outfit item'))
    }
  },
})
