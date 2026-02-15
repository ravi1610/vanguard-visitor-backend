import { Module } from '@nestjs/common';
import { BolosService } from './bolos.service';
import { BolosController } from './bolos.controller';

@Module({
  controllers: [BolosController],
  providers: [BolosService],
  exports: [BolosService],
})
export class BolosModule {}
