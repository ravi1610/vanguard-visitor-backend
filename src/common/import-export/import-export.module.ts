import { Global, Module } from '@nestjs/common';
import { ImportExportService } from './import-export.service';

@Global()
@Module({
  providers: [ImportExportService],
  exports: [ImportExportService],
})
export class ImportExportModule {}
