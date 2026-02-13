import { Module } from '@nestjs/common';
import { SpacesService } from './spaces.service';
import {
  SpacesController,
  SpaceAssignmentsController,
} from './spaces.controller';

@Module({
  controllers: [SpacesController, SpaceAssignmentsController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
