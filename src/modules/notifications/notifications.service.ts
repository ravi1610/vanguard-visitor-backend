import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SmsService } from '../sms/sms.service';
import { SmsJobData } from '../sms/sms.processor';

const EVENT_SETTINGS_MAP: Record<string, string> = {
  'visit.checkin': 'notifications.visitCheckin',
  'visit.scheduled': 'notifications.visitScheduled',
  'package.received': 'notifications.packageReceived',
  'package.ready': 'notifications.packageReady',
  'maintenance.update': 'notifications.maintenanceUpdate',
  'bolo.alert': 'notifications.boloAlert',
  'violation.issued': 'notifications.violationIssued',
  'calendar.reminder': 'notifications.calendarReminder',
};

const MESSAGE_TEMPLATES: Record<string, string> = {
  'visit.checkin': 'Your visitor {visitorName} has checked in at {location}.',
  'visit.scheduled': 'A visit from {visitorName} has been scheduled for {date}.',
  'package.received': 'A package has arrived for you from {carrier}. Location: {storageLocation}.',
  'package.ready': 'Your package is ready for pickup at {storageLocation}.',
  'maintenance.update': 'Your maintenance request "{title}" has been updated to: {status}.',
  'bolo.alert': 'BOLO Alert: {personName} - {description}.',
  'violation.issued': 'A violation has been issued: {title}. Fine: ${fineAmount}.',
  'calendar.reminder': 'Reminder: {title} starts at {startTime}.',
};

export interface NotifyPayload {
  tenantId: string;
  eventType: string;
  recipientUserId?: string;
  recipientPhone?: string;
  data: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly hasQueue: boolean;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private sms: SmsService,
    @Optional() @InjectQueue('sms') private smsQueue?: Queue,
  ) {
    this.hasQueue = !!this.smsQueue;
  }

  /** Send notification if the event type is enabled */
  async notify(payload: NotifyPayload): Promise<void> {
    const settingKey = EVENT_SETTINGS_MAP[payload.eventType];
    if (!settingKey) {
      this.logger.warn(`Unknown event type: ${payload.eventType}`);
      return;
    }

    const enabled = await this.settings.getSystemSettingRaw(settingKey);
    if (enabled !== 'true') return;

    let phone = payload.recipientPhone;
    if (!phone && payload.recipientUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { mobile: true, phone: true },
      });
      phone = user?.mobile || user?.phone || undefined;
    }

    if (!phone) {
      this.logger.debug(`No phone number for ${payload.eventType}, skipping SMS`);
      return;
    }

    const body = this.composeMessage(payload.eventType, payload.data);

    const log = await this.prisma.notificationLog.create({
      data: {
        tenantId: payload.tenantId,
        channel: 'sms',
        recipientId: payload.recipientUserId,
        recipient: phone,
        eventType: payload.eventType,
        body,
        status: 'pending',
      },
    });

    if (this.hasQueue && this.smsQueue) {
      await this.smsQueue.add('send-sms', {
        tenantId: payload.tenantId,
        to: phone,
        body,
        eventType: payload.eventType,
        recipientId: payload.recipientUserId,
        notificationLogId: log.id,
      } satisfies SmsJobData);
    } else {
      const result = await this.sms.send(phone, body);
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          provider: result.provider,
          providerMessageId: result.messageId,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : undefined,
        },
      });
    }
  }

  private composeMessage(eventType: string, data: Record<string, string>): string {
    let message = MESSAGE_TEMPLATES[eventType] || `Notification: ${eventType}`;
    for (const [key, value] of Object.entries(data)) {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    return message;
  }
}
