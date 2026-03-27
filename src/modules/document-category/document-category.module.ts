import { Module } from '@nestjs/common';
import { DocumentCategoryController } from './document-category.controller';
import { DocumentCategoryService } from './document-category.service';

@Module({
  controllers: [DocumentCategoryController],
  providers: [DocumentCategoryService],
  exports: [DocumentCategoryService],
})
export class DocumentCategoryModule {}
