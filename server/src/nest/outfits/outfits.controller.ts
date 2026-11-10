import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth-core/jwt-auth.guard';
import { CurrentUser } from '../auth-core/current-user.decorator';
import { RequirePermission, TripAccessGuard } from '../permissions/trip-access.guard';
import { OutfitsService } from './outfits.service';
import {
  CreateOutfitDto,
  UpdateOutfitDto,
  CopyOutfitDto,
  AddOutfitItemDto,
} from './outfits.dto';
import type { User } from '../../types';

@Controller('api/trips/:tripId/outfits')
@UseGuards(JwtAuthGuard, TripAccessGuard)
export class OutfitsController {
  constructor(private readonly outfits: OutfitsService) {}

  @Get()
  list(
    @Param('tripId') tripId: string,
    @Query('dayId') dayId?: string,
    @Query('userId') userId?: string,
  ) {
    const numDayId = dayId !== undefined && dayId !== '' ? Number(dayId) : undefined;
    const numUserId = userId !== undefined && userId !== '' ? Number(userId) : undefined;
    return this.outfits.listOutfits(tripId, numDayId, numUserId);
  }

  @Get('inventory')
  inventory(
    @Param('tripId') tripId: string,
    @CurrentUser() user: User,
    @Query('userId') userId?: string,
  ) {
    const targetUserId = userId !== undefined && userId !== '' ? Number(userId) : user.id;
    return this.outfits.getClothingInventory(tripId, targetUserId);
  }

  @Get(':id')
  getOne(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
  ) {
    const outfit = this.outfits.getOutfitById(tripId, id);
    if (!outfit) throw new NotFoundException('Outfit not found');
    return outfit;
  }

  @Post()
  @RequirePermission('packing_edit')
  create(
    @Param('tripId') tripId: string,
    @Body() dto: CreateOutfitDto,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return this.outfits.createOutfit(tripId, dto, socketId);
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('packing_edit')
  update(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOutfitDto,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return this.outfits.updateOutfit(tripId, id, dto, socketId);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('packing_edit')
  remove(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return { ok: this.outfits.deleteOutfit(tripId, id, socketId) };
  }

  @Post(':id/copy')
  @RequirePermission('packing_edit')
  copy(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
    @Body() dto: CopyOutfitDto,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return this.outfits.copyOutfit(tripId, id, dto, socketId);
  }

  @Post(':id/items')
  @RequirePermission('packing_edit')
  addItem(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
    @Body() dto: AddOutfitItemDto,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return this.outfits.addItem(tripId, id, dto, socketId);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(200)
  @RequirePermission('packing_edit')
  removeItem(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return { ok: this.outfits.deleteItem(tripId, id, itemId, socketId) };
  }
}
