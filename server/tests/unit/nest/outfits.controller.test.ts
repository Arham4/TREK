import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { OutfitsController } from '../../../src/nest/outfits/outfits.controller';
import type { OutfitsService } from '../../../src/nest/outfits/outfits.service';
import type { User } from '../../../src/types';

const user = { id: 42, role: 'user', email: 'traveler@example.test' } as User;

function makeService(overrides: Partial<OutfitsService> = {}): OutfitsService {
  return {
    verifyTripAccess: vi.fn(),
    canEdit: vi.fn().mockReturnValue(true),
    broadcast: vi.fn(),
    listOutfits: vi.fn().mockReturnValue([]),
    getOutfitById: vi.fn(),
    createOutfit: vi.fn(),
    updateOutfit: vi.fn(),
    deleteOutfit: vi.fn().mockReturnValue(true),
    copyOutfit: vi.fn(),
    addItem: vi.fn(),
    deleteItem: vi.fn().mockReturnValue(true),
    getClothingInventory: vi.fn().mockReturnValue([]),
    ...overrides,
  } as unknown as OutfitsService;
}

describe('OutfitsController', () => {
  it('GET /api/trips/:tripId/outfits calls listOutfits with parsed query params', () => {
    const listOutfits = vi.fn().mockReturnValue([{ id: 1, title: 'Daywear' }]);
    const svc = makeService({ listOutfits });
    const controller = new OutfitsController(svc);

    const res = controller.list('5', '10', '42');
    expect(listOutfits).toHaveBeenCalledWith('5', 10, 42);
    expect(res).toEqual([{ id: 1, title: 'Daywear' }]);
  });

  it('GET /api/trips/:tripId/outfits/:id returns outfit or throws 404', () => {
    const getOutfitById = vi.fn((_tripId: string, id: string) =>
      id === '1' ? ({ id: 1, title: 'Found' } as any) : null,
    );
    const svc = makeService({ getOutfitById });
    const controller = new OutfitsController(svc);

    expect(controller.getOne('5', '1')).toEqual({ id: 1, title: 'Found' });
    expect(() => controller.getOne('5', '2')).toThrow(NotFoundException);
  });

  it('POST /api/trips/:tripId/outfits creates outfit', () => {
    const createOutfit = vi.fn().mockReturnValue({ id: 10, title: 'Dinner', user_id: 42 });
    const svc = makeService({ createOutfit });
    const controller = new OutfitsController(svc);

    const res = controller.create('5', { day_id: 1, user_id: 42, title: 'Dinner' } as any, 'sock-1');
    expect(createOutfit).toHaveBeenCalledWith('5', { day_id: 1, user_id: 42, title: 'Dinner' }, 'sock-1');
    expect(res).toEqual({ id: 10, title: 'Dinner', user_id: 42 });
  });

  it('PUT /api/trips/:tripId/outfits/:id updates outfit', () => {
    const updateOutfit = vi.fn().mockReturnValue({ id: 10, title: 'Updated' });
    const svc = makeService({ updateOutfit });
    const controller = new OutfitsController(svc);

    const res = controller.update('5', '10', { title: 'Updated' }, 'sock-2');
    expect(updateOutfit).toHaveBeenCalledWith('5', '10', { title: 'Updated' }, 'sock-2');
    expect(res).toEqual({ id: 10, title: 'Updated' });
  });

  it('DELETE /api/trips/:tripId/outfits/:id deletes outfit', () => {
    const deleteOutfit = vi.fn().mockReturnValue(true);
    const svc = makeService({ deleteOutfit });
    const controller = new OutfitsController(svc);

    const res = controller.remove('5', '10', 'sock-3');
    expect(deleteOutfit).toHaveBeenCalledWith('5', '10', 'sock-3');
    expect(res).toEqual({ ok: true });
  });

  it('POST /api/trips/:tripId/outfits/:id/copy copies outfit to another day', () => {
    const copyOutfit = vi.fn().mockReturnValue({ id: 11, day_id: 2 });
    const svc = makeService({ copyOutfit });
    const controller = new OutfitsController(svc);

    const res = controller.copy('5', '10', { target_day_id: 2 }, 'sock-4');
    expect(copyOutfit).toHaveBeenCalledWith('5', '10', { target_day_id: 2 }, 'sock-4');
    expect(res).toEqual({ id: 11, day_id: 2 });
  });

  it('POST /api/trips/:tripId/outfits/:id/items adds item', () => {
    const addItem = vi.fn().mockReturnValue({ id: 99, name: 'Hat' });
    const svc = makeService({ addItem });
    const controller = new OutfitsController(svc);

    const res = controller.addItem('5', '10', { name: 'Hat' }, 'sock-5');
    expect(addItem).toHaveBeenCalledWith('5', '10', { name: 'Hat' }, 'sock-5');
    expect(res).toEqual({ id: 99, name: 'Hat' });
  });

  it('DELETE /api/trips/:tripId/outfits/:id/items/:itemId deletes item', () => {
    const deleteItem = vi.fn().mockReturnValue(true);
    const svc = makeService({ deleteItem });
    const controller = new OutfitsController(svc);

    const res = controller.removeItem('5', '10', '99', 'sock-6');
    expect(deleteItem).toHaveBeenCalledWith('5', '10', '99', 'sock-6');
    expect(res).toEqual({ ok: true });
  });

  it('GET /api/trips/:tripId/outfits/inventory returns clothing inventory', () => {
    const getClothingInventory = vi.fn().mockReturnValue([{ name: 'Jacket', wear_count: 1 }]);
    const svc = makeService({ getClothingInventory });
    const controller = new OutfitsController(svc);

    const res = controller.inventory('5', user, '42');
    expect(getClothingInventory).toHaveBeenCalledWith('5', 42);
    expect(res).toEqual([{ name: 'Jacket', wear_count: 1 }]);
  });
});
