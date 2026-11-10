import {
  McpController,
  Tool,
  type McpContext,
  TOOL_ANNOTATIONS_READONLY,
  TOOL_ANNOTATIONS_NON_IDEMPOTENT,
  TOOL_ANNOTATIONS_DELETE,
  ok,
} from '../../nest-mcp';
import { McpToolGuardsService } from '../mcp-shared/mcp-tool-guards.service';
import { z } from 'zod';
import { noAccess, permissionDenied } from '../../mcp/tools/_shared';
import { OutfitsService } from './outfits.service';

@McpController()
export class OutfitsMcp {
  constructor(
    private readonly outfits: OutfitsService,
    private readonly guards: McpToolGuardsService,
  ) {}

  @Tool({
    name: 'list_outfits',
    description: 'List planned outfits for a trip, optionally filtered by dayId and traveler userId.',
    inputSchema: {
      tripId: z.number().int().positive(),
      dayId: z.number().int().positive().optional(),
      userId: z.number().int().positive().optional(),
    },
    annotations: TOOL_ANNOTATIONS_READONLY,
    access: { group: 'packing', mode: 'read' },
  })
  async listOutfits(
    { tripId, dayId, userId }: { tripId: number; dayId?: number; userId?: number },
    ctx: McpContext,
  ) {
    if (!(await this.outfits.verifyTripAccess(tripId, ctx.userId))) return noAccess();
    const outfits = this.outfits.listOutfits(tripId, dayId, userId);
    return ok(outfits);
  }

  @Tool({
    name: 'create_outfit',
    description: 'Plan an outfit for a traveler on a specific day of a trip.',
    inputSchema: {
      tripId: z.number().int().positive(),
      dayId: z.number().int().positive(),
      userId: z.number().int().positive(),
      title: z.string().min(1).default('Daywear'),
      timeOfDay: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(
        z.object({
          name: z.string().min(1),
          packingItemId: z.number().optional(),
          category: z.string().optional(),
          createPackingItem: z.boolean().optional(),
        }),
      ).optional(),
    },
    annotations: TOOL_ANNOTATIONS_NON_IDEMPOTENT,
    access: { group: 'packing', mode: 'write' },
  })
  async createOutfit(
    {
      tripId,
      dayId,
      userId,
      title,
      timeOfDay,
      notes,
      items,
    }: {
      tripId: number;
      dayId: number;
      userId: number;
      title: string;
      timeOfDay?: string;
      notes?: string;
      items?: Array<{ name: string; packingItemId?: number; category?: string; createPackingItem?: boolean }>;
    },
    ctx: McpContext,
  ) {
    if (!(await this.outfits.verifyTripAccess(tripId, ctx.userId))) return noAccess();
    if (!this.guards.hasTripPermission('packing_edit', tripId, ctx.userId)) return permissionDenied();

    const created = this.outfits.createOutfit(tripId, {
      day_id: dayId,
      user_id: userId,
      title,
      time_of_day: timeOfDay,
      notes,
      items: items?.map((it) => ({
        name: it.name,
        packing_item_id: it.packingItemId,
        category: it.category,
        create_packing_item: it.createPackingItem,
      })),
    });
    return ok(created);
  }

  @Tool({
    name: 'delete_outfit',
    description: 'Delete a planned outfit from a trip.',
    inputSchema: {
      tripId: z.number().int().positive(),
      outfitId: z.number().int().positive(),
    },
    annotations: TOOL_ANNOTATIONS_DELETE,
    access: { group: 'packing', mode: 'write' },
  })
  async deleteOutfit(
    { tripId, outfitId }: { tripId: number; outfitId: number },
    ctx: McpContext,
  ) {
    if (!(await this.outfits.verifyTripAccess(tripId, ctx.userId))) return noAccess();
    if (!this.guards.hasTripPermission('packing_edit', tripId, ctx.userId)) return permissionDenied();

    this.outfits.deleteOutfit(tripId, outfitId);
    return ok({ deleted: true });
  }

  @Tool({
    name: 'get_clothing_inventory',
    description: 'Get a traveler’s wardrobe inventory and wear frequency across trip days.',
    inputSchema: {
      tripId: z.number().int().positive(),
      userId: z.number().int().positive(),
    },
    annotations: TOOL_ANNOTATIONS_READONLY,
    access: { group: 'packing', mode: 'read' },
  })
  async getClothingInventory(
    { tripId, userId }: { tripId: number; userId: number },
    ctx: McpContext,
  ) {
    if (!(await this.outfits.verifyTripAccess(tripId, ctx.userId))) return noAccess();
    const inv = this.outfits.getClothingInventory(tripId, userId);
    return ok(inv);
  }
}
