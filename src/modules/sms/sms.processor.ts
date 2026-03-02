import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from './sms.service';

export interface SmsJobData {
  tenantId: string;
  to: string;
  body: string;
  eventType: string;
  recipientId?: string;
  notificationLogId: string;
}

@Processor('sms')
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    private sms: SmsService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    const { to, body, notificationLogId } = job.data;

    const result = await this.sms.send(to, body);

    await this.prisma.notificationLog.update({
      where: { id: notificationLogId },
      data: {
        status: result.success ? 'sent' : 'failed',
        provider: result.provider,
        providerMessageId: result.messageId,
        errorMessage: result.error,
        sentAt: result.success ? new Date() : undefined,
      },
    });

    if (!result.success) {
      this.logger.error(`SMS to ${to} failed: ${result.error}`);
    }
  }
}
