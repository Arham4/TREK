import { z } from 'zod';

export const outfitItemSchema = z.object({
  id: z.number(),
  outfit_id: z.number(),
  trip_id: z.number(),
  name: z.string().min(1),
  packing_item_id: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  sort_order: z.number().default(0),
  created_at: z.string().optional(),
  // hydrated fields joined from packing_items
  packing_item_checked: z.number().optional(),
  packing_item_category: z.string().nullable().optional(),
});
export type OutfitItem = z.infer<typeof outfitItemSchema>;

export const outfitSchema = z.object({
  id: z.number(),
  trip_id: z.number(),
  day_id: z.number(),
  user_id: z.number(),
  title: z.string().min(1),
  time_of_day: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sort_order: z.number().default(0),
  items: z.array(outfitItemSchema).default([]),
  created_at: z.string().optional(),
  updated_at: z.string().nullable().optional(),
});
export type Outfit = z.infer<typeof outfitSchema>;

export const createOutfitRequestSchema = z.object({
  day_id: z.number(),
  user_id: z.number(),
  title: z.string().min(1).default('Daywear'),
  time_of_day: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    packing_item_id: z.number().nullable().optional(),
    category: z.string().optional(),
    create_packing_item: z.boolean().optional(),
  })).optional(),
});
export type CreateOutfitRequest = z.infer<typeof createOutfitRequestSchema>;

export const updateOutfitRequestSchema = z.object({
  title: z.string().min(1).optional(),
  day_id: z.number().optional(),
  user_id: z.number().optional(),
  time_of_day: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateOutfitRequest = z.infer<typeof updateOutfitRequestSchema>;

export const copyOutfitRequestSchema = z.object({
  target_day_id: z.number(),
  target_user_id: z.number().optional(),
});
export type CopyOutfitRequest = z.infer<typeof copyOutfitRequestSchema>;

export const addOutfitItemRequestSchema = z.object({
  name: z.string().min(1),
  packing_item_id: z.number().nullable().optional(),
  category: z.string().optional(),
  create_packing_item: z.boolean().optional(),
});
export type AddOutfitItemRequest = z.infer<typeof addOutfitItemRequestSchema>;

export const outfitInventoryItemSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  category: z.string().nullable().optional(),
  packing_item_id: z.number().nullable().optional(),
  checked: z.number().optional(),
  wear_count: z.number().default(0),
  day_numbers: z.array(z.number()).default([]),
});
export type OutfitInventoryItem = z.infer<typeof outfitInventoryItemSchema>;
