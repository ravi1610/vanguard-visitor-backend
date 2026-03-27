import { Module } from '@nestjs/common';
import { ComplianceCategoryController } from './compliance-category.controller';
import { ComplianceCategoryService } from './compliance-category.service';

@Module({
  controllers: [ComplianceCategoryController],
  providers: [ComplianceCategoryService],
  exports: [ComplianceCategoryService],
})
export class ComplianceCategoryModule {}
