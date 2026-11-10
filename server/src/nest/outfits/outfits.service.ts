import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../db/database';
import { PermissionsService } from '../permissions/permissions.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TripAccessService } from '../trip-membership/trip-access.service';
import type {
  Outfit,
  OutfitItem,
  OutfitInventoryItem,
  CreateOutfitRequest,
  UpdateOutfitRequest,
  CopyOutfitRequest,
  AddOutfitItemRequest,
} from '@trek/shared';
import type { Trip, User } from '../../types';

const dbHelper = {
  all: <T = any>(sql: string, ...params: any[]): T[] => db.prepare(sql).all(...params) as T[],
  get: <T = any>(sql: string, ...params: any[]): T | undefined => db.prepare(sql).get(...params) as T | undefined,
  run: (sql: string, ...params: any[]) => db.prepare(sql).run(...params),
};

@Injectable()
export class OutfitsService {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
    private readonly tripsRepo: TripAccessService,
  ) {}

  async verifyTripAccess(tripId: string | number, userId: number) {
    return await this.tripsRepo.findAccessible(tripId, userId);
  }

  async canEdit(trip: Trip, user: User): Promise<boolean> {
    return this.permissions.checkPermission('packing_edit', user.role, trip.user_id, user.id, trip.user_id !== user.id);
  }

  broadcast(tripId: number | string, event: 'outfit:created' | 'outfit:updated' | 'outfit:deleted', payload: unknown, socketId?: string): void {
    this.realtime.broadcast(String(tripId), event as any, payload as any, socketId);
  }

  listOutfits(tripId: number | string, dayId?: number, userId?: number): Outfit[] {
    let query = 'SELECT * FROM outfits WHERE trip_id = ?';
    const params: unknown[] = [tripId];

    if (dayId !== undefined && dayId !== null && !Number.isNaN(dayId)) {
      query += ' AND day_id = ?';
      params.push(dayId);
    }
    if (userId !== undefined && userId !== null && !Number.isNaN(userId)) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY day_id ASC, sort_order ASC, id ASC';

    const rawOutfits = dbHelper.all<any>(query, ...params);
    if (!rawOutfits || rawOutfits.length === 0) return [];

    const outfitIds = rawOutfits.map((o) => o.id);
    const placeholders = outfitIds.map(() => '?').join(',');

    const itemsQuery = `
      SELECT oi.*, pi.checked AS packing_item_checked, pi.category AS packing_item_category
      FROM outfit_items oi
      LEFT JOIN packing_items pi ON oi.packing_item_id = pi.id
      WHERE oi.outfit_id IN (${placeholders})
      ORDER BY oi.sort_order ASC, oi.id ASC
    `;
    const rawItems = dbHelper.all<any>(itemsQuery, ...outfitIds);

    const itemsByOutfit: Record<number, OutfitItem[]> = {};
    for (const item of rawItems) {
      if (!itemsByOutfit[item.outfit_id]) itemsByOutfit[item.outfit_id] = [];
      itemsByOutfit[item.outfit_id].push({
        id: item.id,
        outfit_id: item.outfit_id,
        trip_id: item.trip_id,
        name: item.name,
        packing_item_id: item.packing_item_id,
        category: item.category,
        sort_order: item.sort_order ?? 0,
        created_at: item.created_at,
        packing_item_checked: item.packing_item_checked ?? undefined,
        packing_item_category: item.packing_item_category ?? undefined,
      });
    }

    return rawOutfits.map((o) => ({
      id: o.id,
      trip_id: o.trip_id,
      day_id: o.day_id,
      user_id: o.user_id,
      title: o.title,
      time_of_day: o.time_of_day,
      notes: o.notes,
      sort_order: o.sort_order ?? 0,
      created_at: o.created_at,
      updated_at: o.updated_at,
      items: itemsByOutfit[o.id] || [],
    }));
  }

  getOutfitById(tripId: number | string, outfitId: number | string): Outfit | null {
    const rawOutfit = dbHelper.get<any>('SELECT * FROM outfits WHERE id = ? AND trip_id = ?', outfitId, tripId);
    if (!rawOutfit) return null;

    const items = dbHelper.all<any>(
      `SELECT oi.*, pi.checked AS packing_item_checked, pi.category AS packing_item_category
       FROM outfit_items oi
       LEFT JOIN packing_items pi ON oi.packing_item_id = pi.id
       WHERE oi.outfit_id = ?
       ORDER BY oi.sort_order ASC, oi.id ASC`,
      outfitId,
    );

    return {
      id: rawOutfit.id,
      trip_id: rawOutfit.trip_id,
      day_id: rawOutfit.day_id,
      user_id: rawOutfit.user_id,
      title: rawOutfit.title,
      time_of_day: rawOutfit.time_of_day,
      notes: rawOutfit.notes,
      sort_order: rawOutfit.sort_order ?? 0,
      created_at: rawOutfit.created_at,
      updated_at: rawOutfit.updated_at,
      items: items.map((item) => ({
        id: item.id,
        outfit_id: item.outfit_id,
        trip_id: item.trip_id,
        name: item.name,
        packing_item_id: item.packing_item_id,
        category: item.category,
        sort_order: item.sort_order ?? 0,
        created_at: item.created_at,
        packing_item_checked: item.packing_item_checked ?? undefined,
        packing_item_category: item.packing_item_category ?? undefined,
      })),
    };
  }

  createOutfit(tripId: number | string, data: CreateOutfitRequest, socketId?: string): Outfit {
    const numTripId = Number(tripId);
    const day = dbHelper.get<{ id: number }>('SELECT id FROM days WHERE id = ? AND trip_id = ?', data.day_id, numTripId);
    if (!day) throw new NotFoundException('Day not found for this trip');

    const maxOrder = dbHelper.get<{ max: number | null }>(
      'SELECT MAX(sort_order) as max FROM outfits WHERE trip_id = ? AND day_id = ? AND user_id = ?',
      numTripId,
      data.day_id,
      data.user_id,
    )!;
    const sortOrder = (maxOrder.max !== null && maxOrder.max !== undefined ? maxOrder.max : -1) + 1;

    const res = dbHelper.run(
      `INSERT INTO outfits (trip_id, day_id, user_id, title, time_of_day, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      numTripId,
      data.day_id,
      data.user_id,
      data.title || 'Daywear',
      data.time_of_day || null,
      data.notes || null,
      sortOrder,
    );
    const outfitId = Number(res.lastInsertRowid);

    if (data.items && data.items.length > 0) {
      let itemOrder = 0;
      for (const it of data.items) {
        let packingItemId = it.packing_item_id || null;

        if (it.create_packing_item && !packingItemId) {
          const packRes = dbHelper.run(
            `INSERT INTO packing_items (trip_id, name, checked, category, sort_order, is_private, owner_id)
             VALUES (?, ?, 0, 'Clothing', 0, 1, ?)`,
            numTripId,
            it.name.trim(),
            data.user_id,
          );
          packingItemId = Number(packRes.lastInsertRowid);
        }

        dbHelper.run(
          `INSERT INTO outfit_items (outfit_id, trip_id, name, packing_item_id, category, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          outfitId,
          numTripId,
          it.name.trim(),
          packingItemId,
          it.category || null,
          itemOrder++,
        );
      }
    }

    const created = this.getOutfitById(numTripId, outfitId)!;
    this.broadcast(numTripId, 'outfit:created', { tripId: numTripId, outfit: created }, socketId);
    return created;
  }

  updateOutfit(tripId: number | string, outfitId: number | string, data: UpdateOutfitRequest, socketId?: string): Outfit {
    const numTripId = Number(tripId);
    const numOutfitId = Number(outfitId);

    const existing = dbHelper.get<{ id: number }>('SELECT id FROM outfits WHERE id = ? AND trip_id = ?', numOutfitId, numTripId);
    if (!existing) throw new NotFoundException('Outfit not found');

    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      params.push(data.title);
    }
    if (data.day_id !== undefined) {
      fields.push('day_id = ?');
      params.push(data.day_id);
    }
    if (data.user_id !== undefined) {
      fields.push('user_id = ?');
      params.push(data.user_id);
    }
    if (data.time_of_day !== undefined) {
      fields.push('time_of_day = ?');
      params.push(data.time_of_day);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      params.push(data.notes);
    }

    params.push(numOutfitId, numTripId);
    dbHelper.run(`UPDATE outfits SET ${fields.join(', ')} WHERE id = ? AND trip_id = ?`, ...params);

    const updated = this.getOutfitById(numTripId, numOutfitId)!;
    this.broadcast(numTripId, 'outfit:updated', { tripId: numTripId, outfit: updated }, socketId);
    return updated;
  }

  deleteOutfit(tripId: number | string, outfitId: number | string, socketId?: string): boolean {
    const numTripId = Number(tripId);
    const numOutfitId = Number(outfitId);

    const existing = dbHelper.get<{ id: number }>('SELECT id FROM outfits WHERE id = ? AND trip_id = ?', numOutfitId, numTripId);
    if (!existing) throw new NotFoundException('Outfit not found');

    dbHelper.run('DELETE FROM outfits WHERE id = ? AND trip_id = ?', numOutfitId, numTripId);
    this.broadcast(numTripId, 'outfit:deleted', { tripId: numTripId, outfitId: numOutfitId }, socketId);
    return true;
  }

  copyOutfit(tripId: number | string, outfitId: number | string, data: CopyOutfitRequest, socketId?: string): Outfit {
    const numTripId = Number(tripId);
    const source = this.getOutfitById(numTripId, outfitId);
    if (!source) throw new NotFoundException('Source outfit not found');

    const targetDayId = data.target_day_id;
    const targetUserId = data.target_user_id || source.user_id;

    const maxOrder = dbHelper.get<{ max: number | null }>(
      'SELECT MAX(sort_order) as max FROM outfits WHERE trip_id = ? AND day_id = ? AND user_id = ?',
      numTripId,
      targetDayId,
      targetUserId,
    )!;
    const sortOrder = (maxOrder.max !== null && maxOrder.max !== undefined ? maxOrder.max : -1) + 1;

    const res = dbHelper.run(
      `INSERT INTO outfits (trip_id, day_id, user_id, title, time_of_day, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      numTripId,
      targetDayId,
      targetUserId,
      source.title,
      source.time_of_day || null,
      source.notes || null,
      sortOrder,
    );
    const newOutfitId = Number(res.lastInsertRowid);

    for (const it of source.items) {
      dbHelper.run(
        `INSERT INTO outfit_items (outfit_id, trip_id, name, packing_item_id, category, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        newOutfitId,
        numTripId,
        it.name,
        it.packing_item_id || null,
        it.category || null,
        it.sort_order,
      );
    }

    const created = this.getOutfitById(numTripId, newOutfitId)!;
    this.broadcast(numTripId, 'outfit:created', { tripId: numTripId, outfit: created }, socketId);
    return created;
  }

  addItem(tripId: number | string, outfitId: number | string, item: AddOutfitItemRequest, socketId?: string): OutfitItem {
    const numTripId = Number(tripId);
    const numOutfitId = Number(outfitId);

    const outfit = dbHelper.get<{ id: number; user_id: number }>('SELECT id, user_id FROM outfits WHERE id = ? AND trip_id = ?', numOutfitId, numTripId);
    if (!outfit) throw new NotFoundException('Outfit not found');

    let packingItemId = item.packing_item_id || null;

    if (item.create_packing_item && !packingItemId) {
      const packRes = dbHelper.run(
        `INSERT INTO packing_items (trip_id, name, checked, category, sort_order, is_private, owner_id)
         VALUES (?, ?, 0, 'Clothing', 0, 1, ?)`,
        numTripId,
        item.name.trim(),
        outfit.user_id,
      );
      packingItemId = Number(packRes.lastInsertRowid);
    }

    const maxOrder = dbHelper.get<{ max: number | null }>('SELECT MAX(sort_order) as max FROM outfit_items WHERE outfit_id = ?', numOutfitId)!;
    const sortOrder = (maxOrder.max !== null && maxOrder.max !== undefined ? maxOrder.max : -1) + 1;

    const res = dbHelper.run(
      `INSERT INTO outfit_items (outfit_id, trip_id, name, packing_item_id, category, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      numOutfitId,
      numTripId,
      item.name.trim(),
      packingItemId,
      item.category || null,
      sortOrder,
    );
    const itemId = Number(res.lastInsertRowid);

    const updatedOutfit = this.getOutfitById(numTripId, numOutfitId)!;
    this.broadcast(numTripId, 'outfit:updated', { tripId: numTripId, outfit: updatedOutfit }, socketId);

    const createdItem = updatedOutfit.items.find((i) => i.id === itemId);
    return createdItem || {
      id: itemId,
      outfit_id: numOutfitId,
      trip_id: numTripId,
      name: item.name.trim(),
      packing_item_id: packingItemId,
      category: item.category || null,
      sort_order: sortOrder,
    };
  }

  deleteItem(tripId: number | string, outfitId: number | string, itemId: number | string, socketId?: string): boolean {
    const numTripId = Number(tripId);
    const numOutfitId = Number(outfitId);
    const numItemId = Number(itemId);

    const item = dbHelper.get<{ id: number }>('SELECT id FROM outfit_items WHERE id = ? AND outfit_id = ? AND trip_id = ?', numItemId, numOutfitId, numTripId);
    if (!item) throw new NotFoundException('Outfit item not found');

    dbHelper.run('DELETE FROM outfit_items WHERE id = ? AND outfit_id = ? AND trip_id = ?', numItemId, numOutfitId, numTripId);

    const updatedOutfit = this.getOutfitById(numTripId, numOutfitId);
    if (updatedOutfit) {
      this.broadcast(numTripId, 'outfit:updated', { tripId: numTripId, outfit: updatedOutfit }, socketId);
    }
    return true;
  }

  getClothingInventory(tripId: number | string, userId: number | string): OutfitInventoryItem[] {
    const numTripId = Number(tripId);
    const numUserId = Number(userId);

    // Personal packing items of this user or common clothing items
    const packingItems = dbHelper.all<any>(
      `SELECT id, name, category, checked
       FROM packing_items
       WHERE trip_id = ?
         AND (owner_id = ? OR is_private = 0 OR is_private IS NULL)
       ORDER BY sort_order ASC, name ASC`,
      numTripId,
      numUserId,
    );

    // Outfits worn by this user, joined with days
    const wearHistory = dbHelper.all<any>(
      `SELECT oi.packing_item_id, oi.name, d.day_number
       FROM outfit_items oi
       JOIN outfits o ON oi.outfit_id = o.id
       JOIN days d ON o.day_id = d.id
       WHERE o.trip_id = ? AND o.user_id = ?`,
      numTripId,
      numUserId,
    );

    const usageByPackingId: Record<number, number[]> = {};
    const usageByName: Record<string, number[]> = {};

    for (const w of wearHistory) {
      const dayNum = w.day_number;
      if (w.packing_item_id) {
        if (!usageByPackingId[w.packing_item_id]) usageByPackingId[w.packing_item_id] = [];
        usageByPackingId[w.packing_item_id].push(dayNum);
      }
      const normName = w.name.trim().toLowerCase();
      if (!usageByName[normName]) usageByName[normName] = [];
      usageByName[normName].push(dayNum);
    }

    const CLOTHING_CATEGORIES = new Set([
      'clothing',
      'clothes',
      'kleidung',
      'vêtements',
      'vetements',
      'ropa',
      'abbigliamento',
      'shoes',
      'footwear',
      'schuhe',
      'accessories',
      'accessoires',
    ]);

    const filteredPackingItems = packingItems.filter((pi) => {
      const cat = (pi.category || '').trim().toLowerCase();
      const hasWear =
        (usageByPackingId[pi.id]?.length ?? 0) > 0 ||
        (usageByName[pi.name.trim().toLowerCase()]?.length ?? 0) > 0;
      return CLOTHING_CATEGORIES.has(cat) || hasWear || !cat;
    });

    return filteredPackingItems.map((pi) => {
      const days = Array.from(new Set(usageByPackingId[pi.id] || usageByName[pi.name.trim().toLowerCase()] || []));
      days.sort((a, b) => a - b);
      return {
        id: pi.id,
        packing_item_id: pi.id,
        name: pi.name,
        category: pi.category,
        checked: pi.checked ?? 0,
        wear_count: days.length,
        day_numbers: days,
      };
    });
  }
}
