import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Job } from 'bullmq';
import { ReportsService } from './reports.service';

export interface ReportJobData {
  reportType: string;
  tenantId: string;
  filters: Record<string, string | undefined>;
}

@Processor('reports')
export class ReportsProcessor extends WorkerHost {
  private static readonly RESULT_TTL = 600_000; // 10 minutes

  constructor(
    private reports: ReportsService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportType, tenantId, filters } = job.data;

    await job.updateProgress(10);

    const result = await this.reports.runReport(reportType, tenantId, filters);

    await job.updateProgress(90);

    // Store result in cache for retrieval
    const cacheKey = `report:result:${job.id}`;
    await this.cache.set(cacheKey, result, ReportsProcessor.RESULT_TTL);

    await job.updateProgress(100);
  }
}
