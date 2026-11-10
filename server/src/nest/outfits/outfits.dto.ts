import { createZodDto } from 'nestjs-zod';
import {
  createOutfitRequestSchema,
  updateOutfitRequestSchema,
  copyOutfitRequestSchema,
  addOutfitItemRequestSchema,
} from '@trek/shared';

export class CreateOutfitDto extends createZodDto(createOutfitRequestSchema) {}
export class UpdateOutfitDto extends createZodDto(updateOutfitRequestSchema) {}
export class CopyOutfitDto extends createZodDto(copyOutfitRequestSchema) {}
export class AddOutfitItemDto extends createZodDto(addOutfitItemRequestSchema) {}
