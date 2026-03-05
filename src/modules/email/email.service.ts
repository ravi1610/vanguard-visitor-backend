import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
import { visitorInviteHtml } from './templates/visitor-invite';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private settings: SettingsService) {}

  private async getTransporter(): Promise<nodemailer.Transporter> {
    const [host, port, user, pass] = await Promise.all([
      this.settings.getSystemSettingRaw('email.host'),
      this.settings.getSystemSettingRaw('email.port'),
      this.settings.getSystemSettingRaw('email.user'),
      this.settings.getSystemSettingRaw('email.pass'),
    ]);

    if (!host || !user || !pass) {
      throw new Error('Email settings not configured (email.host, email.user, email.pass)');
    }

    return nodemailer.createTransport({
      host,
      port: parseInt(port || '587', 10),
      secure: parseInt(port || '587', 10) === 465,
      auth: { user, pass },
    });
  }

  async sendVisitorInvite(params: {
    to: string;
    visitorName: string;
    hostName: string;
    propertyName: string;
    date: string;
    qrDataUrl: string;
    scanLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter();
      const from = await this.settings.getSystemSettingRaw('email.from');

      // Convert data URL to buffer for CID attachment
      const base64Data = params.qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');
      const qrCid = 'qrcode@vanguardvisitor';

      const html = visitorInviteHtml({
        visitorName: params.visitorName,
        hostName: params.hostName,
        propertyName: params.propertyName,
        date: params.date,
        scanLink: params.scanLink,
        qrCid,
      });

      await transporter.sendMail({
        from: from || '"Vanguard Visitor" <noreply@vanguardvisitor.com>',
        to: params.to,
        subject: `Visitor Invitation from ${params.hostName}`,
        html,
        attachments: [
          {
            filename: 'qrcode.png',
            content: qrBuffer,
            cid: qrCid,
          },
        ],
      });

      this.logger.log(`Visitor invite email sent to ${params.to}`);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to send visitor invite email: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return { success: true, message: 'Email connection successful' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}
