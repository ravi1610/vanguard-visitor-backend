export interface SmsResult {
  success: boolean;
  messageId?: string;
  provider: 'sinch' | 'twilio';
  error?: string;
}

export interface SmsProvider {
  readonly name: 'sinch' | 'twilio';
  send(to: string, body: string): Promise<SmsResult>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}
