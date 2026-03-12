import { Module } from '@nestjs/common';
import { StaffPositionService } from './staff-position.service';
import { StaffPositionController } from './staff-position.controller';

@Module({
  controllers: [StaffPositionController],
  providers: [StaffPositionService],
  exports: [StaffPositionService],
})
export class StaffPositionModule {}
