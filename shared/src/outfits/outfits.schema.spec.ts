import { describe, it, expect } from 'vitest';
import {
  createOutfitRequestSchema,
  updateOutfitRequestSchema,
  copyOutfitRequestSchema,
  addOutfitItemRequestSchema,
  outfitSchema,
} from './outfits.schema';

describe('outfits.schema', () => {
  it('validates a complete outfit structure', () => {
    const parsed = outfitSchema.safeParse({
      id: 1,
      trip_id: 10,
      day_id: 2,
      user_id: 3,
      title: 'Daywear',
      time_of_day: 'morning',
      notes: 'casual city walk',
      sort_order: 0,
      items: [
        {
          id: 101,
          outfit_id: 1,
          trip_id: 10,
          name: 'White Linen Shirt',
          packing_item_id: 55,
          category: 'top',
          sort_order: 0,
          packing_item_checked: 1,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('validates createOutfitRequestSchema', () => {
    expect(
      createOutfitRequestSchema.safeParse({
        day_id: 2,
        user_id: 3,
        title: 'Dinner at Beach',
        items: [{ name: 'Linen Shorts', create_packing_item: true }],
      }).success,
    ).toBe(true);

    // Missing day_id should fail
    expect(
      createOutfitRequestSchema.safeParse({
        user_id: 3,
        title: 'Dinner at Beach',
      }).success,
    ).toBe(false);
  });

  it('validates updateOutfitRequestSchema', () => {
    expect(
      updateOutfitRequestSchema.safeParse({
        title: 'New Evening Look',
        notes: 'Updated notes',
      }).success,
    ).toBe(true);
  });

  it('validates copyOutfitRequestSchema', () => {
    expect(
      copyOutfitRequestSchema.safeParse({
        target_day_id: 5,
        target_user_id: 2,
      }).success,
    ).toBe(true);

    expect(copyOutfitRequestSchema.safeParse({}).success).toBe(false);
  });

  it('validates addOutfitItemRequestSchema', () => {
    expect(
      addOutfitItemRequestSchema.safeParse({
        name: 'Sunglasses',
        category: 'accessory',
      }).success,
    ).toBe(true);

    expect(addOutfitItemRequestSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
