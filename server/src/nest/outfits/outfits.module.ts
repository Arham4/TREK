import { Module } from '@nestjs/common';
import { OutfitsController } from './outfits.controller';
import { OutfitsMcp } from './outfits.mcp';
import { OutfitsService } from './outfits.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { TripMembershipModule } from '../trip-membership/trip-membership.module';
import { McpSharedModule } from '../mcp-shared/mcp-shared.module';

@Module({
  imports: [McpSharedModule, PermissionsModule, TripMembershipModule, RealtimeModule],
  controllers: [OutfitsController],
  providers: [OutfitsService, OutfitsMcp],
  exports: [OutfitsService],
})
export class OutfitsModule {}
