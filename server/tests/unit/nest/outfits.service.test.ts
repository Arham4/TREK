import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { NotFoundException } from '@nestjs/common';

// ── DB setup ──────────────────────────────────────────────────────────────────

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  const mock = {
    db,
    closeDb: () => {},
    reinitialize: () => {},
    getPlaceWithTags: () => null,
    canAccessTrip: (tripId: any, userId: number) =>
      db.prepare(`
        SELECT t.id, t.user_id FROM trips t
        LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
        WHERE t.id = ? AND (t.user_id = ? OR m.user_id IS NOT NULL)
      `).get(userId, tripId, userId),
    isOwner: (tripId: any, userId: number) =>
      !!db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, userId),
  };
  return { testDb: db, dbMock: mock };
});

vi.mock('../../../src/db/database', () => dbMock);
vi.mock('../../../src/config', () => ({
  JWT_SECRET: 'test-secret',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));
vi.mock('../../../src/websocket', () => ({ broadcast: vi.fn() }));

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import { createUser, createTrip, createDay, addTripMember } from '../../helpers/factories';
import { DatabaseService } from '../../../src/nest/database/database.service';
import { PermissionsService } from '../../../src/nest/permissions/permissions.service';
import { OutfitsService } from '../../../src/nest/outfits/outfits.service';
import { RealtimeService } from '../../../src/nest/realtime/realtime.service';

const realtimeMock = {
  broadcast: vi.fn(),
} as unknown as RealtimeService;

const svc = new OutfitsService(
  new DatabaseService(testDb),
  new PermissionsService(new DatabaseService(testDb)),
  realtimeMock,
);

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
  vi.clearAllMocks();
});

afterAll(() => {
  testDb.close();
});

function seedTripAndDay() {
  const { user } = createUser(testDb);
  const trip = createTrip(testDb, user.id);
  const day1 = createDay(testDb, trip.id);
  const day2 = createDay(testDb, trip.id);
  return { user, trip, day1, day2 };
}

describe('OutfitsService', () => {
  it('OUTFIT-SVC-001: verifyTripAccess allows trip owner and member, rejects stranger', () => {
    const { user, trip } = seedTripAndDay();
    const { user: member } = createUser(testDb);
    const { user: stranger } = createUser(testDb);
    addTripMember(testDb, trip.id, member.id);

    expect(svc.verifyTripAccess(trip.id, user.id)).toBeDefined();
    expect(svc.verifyTripAccess(trip.id, member.id)).toBeDefined();
    expect(svc.verifyTripAccess(trip.id, stranger.id)).toBeUndefined();
  });

  it('OUTFIT-SVC-002: createOutfit creates outfit with items and broadcasts outfit:created', () => {
    const { user, trip, day1 } = seedTripAndDay();
    const created = svc.createOutfit(
      trip.id,
      {
        day_id: day1.id,
        user_id: user.id,
        title: 'Morning Casual',
        time_of_day: 'morning',
        notes: 'Casual stroll outfit',
        items: [
          { name: 'Linen Shirt', category: 'Tops' },
          { name: 'Shorts', category: 'Bottoms' },
        ],
      },
      'test-sock',
    );

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Morning Casual');
    expect(created.day_id).toBe(day1.id);
    expect(created.user_id).toBe(user.id);
    expect(created.items).toHaveLength(2);
    expect(created.items[0].name).toBe('Linen Shirt');
    expect(created.items[1].name).toBe('Shorts');

    expect(realtimeMock.broadcast).toHaveBeenCalledWith(
      String(trip.id),
      'outfit:created',
      { tripId: trip.id, outfit: created },
      'test-sock',
    );
  });

  it('OUTFIT-SVC-003: createOutfit with create_packing_item adds item to packing list', () => {
    const { user, trip, day1 } = seedTripAndDay();
    const created = svc.createOutfit(trip.id, {
      day_id: day1.id,
      user_id: user.id,
      title: 'Dinner Wear',
      items: [
        { name: 'Navy Blazer', category: 'Outerwear', create_packing_item: true },
      ],
    });

    expect(created.items[0].packing_item_id).toBeDefined();
    expect(created.items[0].packing_item_id).not.toBeNull();

    // Verify it exists in packing_items table
    const packingItem = testDb
      .prepare('SELECT * FROM packing_items WHERE id = ?')
      .get(created.items[0].packing_item_id);
    expect(packingItem).toBeDefined();
    expect(packingItem.name).toBe('Navy Blazer');
    expect(packingItem.category).toBe('Clothing');
  });

  it('OUTFIT-SVC-004: createOutfit throws NotFoundException when day does not exist', () => {
    const { user, trip } = seedTripAndDay();
    expect(() =>
      svc.createOutfit(trip.id, {
        day_id: 99999,
        user_id: user.id,
        title: 'Test',
      }),
    ).toThrow(NotFoundException);
  });

  it('OUTFIT-SVC-005: listOutfits filters by day_id and user_id', () => {
    const { user, trip, day1, day2 } = seedTripAndDay();
    const { user: otherUser } = createUser(testDb);
    addTripMember(testDb, trip.id, otherUser.id);

    svc.createOutfit(trip.id, { day_id: day1.id, user_id: user.id, title: 'Day 1 User 1' });
    svc.createOutfit(trip.id, { day_id: day2.id, user_id: user.id, title: 'Day 2 User 1' });
    svc.createOutfit(trip.id, { day_id: day1.id, user_id: otherUser.id, title: 'Day 1 User 2' });

    const allTrip = svc.listOutfits(trip.id);
    expect(allTrip).toHaveLength(3);

    const day1Only = svc.listOutfits(trip.id, day1.id);
    expect(day1Only).toHaveLength(2);

    const user1Only = svc.listOutfits(trip.id, undefined, user.id);
    expect(user1Only).toHaveLength(2);

    const day1User1 = svc.listOutfits(trip.id, day1.id, user.id);
    expect(day1User1).toHaveLength(1);
    expect(day1User1[0].title).toBe('Day 1 User 1');
  });

  it('OUTFIT-SVC-006: updateOutfit updates attributes and broadcasts outfit:updated', () => {
    const { user, trip, day1 } = seedTripAndDay();
    const created = svc.createOutfit(trip.id, {
      day_id: day1.id,
      user_id: user.id,
      title: 'Original Title',
    });

    const updated = svc.updateOutfit(
      trip.id,
      created.id,
      {
        title: 'Updated Title',
        notes: 'Wear comfortable shoes',
        time_of_day: 'evening',
      },
      'sock-upd',
    );

    expect(updated.title).toBe('Updated Title');
    expect(updated.notes).toBe('Wear comfortable shoes');
    expect(updated.time_of_day).toBe('evening');

    expect(realtimeMock.broadcast).toHaveBeenCalledWith(
      String(trip.id),
      'outfit:updated',
      { tripId: trip.id, outfit: updated },
      'sock-upd',
    );
  });

  it('OUTFIT-SVC-007: deleteOutfit removes outfit, cascades items, and broadcasts outfit:deleted', () => {
    const { user, trip, day1 } = seedTripAndDay();
    const created = svc.createOutfit(trip.id, {
      day_id: day1.id,
      user_id: user.id,
      title: 'To Delete',
      items: [{ name: 'Hat' }],
    });

    const deleted = svc.deleteOutfit(trip.id, created.id, 'sock-del');
    expect(deleted).toBe(true);

    const retrieved = svc.getOutfitById(trip.id, created.id);
    expect(retrieved).toBeNull();

    const itemsLeft = testDb
      .prepare('SELECT COUNT(*) as count FROM outfit_items WHERE outfit_id = ?')
      .get(created.id);
    expect(itemsLeft.count).toBe(0);

    expect(realtimeMock.broadcast).toHaveBeenCalledWith(
      String(trip.id),
      'outfit:deleted',
      { tripId: trip.id, outfitId: created.id },
      'sock-del',
    );
  });

  it('OUTFIT-SVC-008: copyOutfit duplicates outfit and its items to another day', () => {
    const { user, trip, day1, day2 } = seedTripAndDay();
    const original = svc.createOutfit(trip.id, {
      day_id: day1.id,
      user_id: user.id,
      title: 'Beach Day Outfit',
      notes: 'Sunglasses needed',
      items: [
        { name: 'Swim Trunks', category: 'Bottoms' },
        { name: 'Sun Hat', category: 'Accessories' },
      ],
    });

    const copied = svc.copyOutfit(trip.id, original.id, { target_day_id: day2.id });
    expect(copied.id).not.toBe(original.id);
    expect(copied.day_id).toBe(day2.id);
    expect(copied.title).toBe('Beach Day Outfit');
    expect(copied.notes).toBe('Sunglasses needed');
    expect(copied.items).toHaveLength(2);
    expect(copied.items[0].name).toBe('Swim Trunks');
    expect(copied.items[1].name).toBe('Sun Hat');
  });

  it('OUTFIT-SVC-009: addItem and deleteItem modify outfit item list', () => {
    const { user, trip, day1 } = seedTripAndDay();
    const outfit = svc.createOutfit(trip.id, {
      day_id: day1.id,
      user_id: user.id,
      title: 'Capsule',
    });

    const addedItem = svc.addItem(trip.id, outfit.id, {
      name: 'White Sneakers',
      category: 'Footwear',
    });
    expect(addedItem.id).toBeDefined();
    expect(addedItem.name).toBe('White Sneakers');

    const withItem = svc.getOutfitById(trip.id, outfit.id);
    expect(withItem?.items).toHaveLength(1);

    const deleted = svc.deleteItem(trip.id, outfit.id, addedItem.id);
    expect(deleted).toBe(true);

    const afterDelete = svc.getOutfitById(trip.id, outfit.id);
    expect(afterDelete?.items).toHaveLength(0);
  });

  it('OUTFIT-SVC-010: getClothingInventory aggregates packing list and outfit items with wear counts', () => {
    const { user, trip, day1, day2 } = seedTripAndDay();

    // Add items to packing list (one clothing, one electronics)
    const packRes1 = testDb
      .prepare(`INSERT INTO packing_items (trip_id, name, checked, category, sort_order, is_private, owner_id) VALUES (?, ?, 1, 'Clothing', 0, 1, ?)`)
      .run(trip.id, 'Blue Jeans', user.id);
    const jeansPackId = Number(packRes1.lastInsertRowid);

    testDb
      .prepare(`INSERT INTO packing_items (trip_id, name, checked, category, sort_order, is_private, owner_id) VALUES (?, ?, 0, 'Electronics', 0, 1, ?)`)
      .run(trip.id, 'Camera', user.id);

    // Wear Blue Jeans on Day 1 and Day 2
    svc.createOutfit(trip.id, {
      day_id: day1.id,
      user_id: user.id,
      title: 'Day 1 Outfit',
      items: [{ name: 'Blue Jeans', packing_item_id: jeansPackId }],
    });
    svc.createOutfit(trip.id, {
      day_id: day2.id,
      user_id: user.id,
      title: 'Day 2 Outfit',
      items: [{ name: 'Blue Jeans', packing_item_id: jeansPackId }],
    });

    const inventory = svc.getClothingInventory(trip.id, user.id);
    expect(inventory).toHaveLength(1);
    expect(inventory[0].name).toBe('Blue Jeans');
    expect(inventory[0].checked).toBe(1);
    expect(inventory[0].wear_count).toBe(2);
    expect(inventory[0].day_numbers).toContain(day1.day_number);
    expect(inventory[0].day_numbers).toContain(day2.day_number);
  });
});
