import { createHmac } from 'crypto';
import * as QRCode from 'qrcode';

/**
 * Generate a signed QR token for a visit.
 * Format: vv:{visitId}:{hmac_first_12_chars}
 */
export function generateQrToken(visitId: string, secret: string): string {
  const hmac = createHmac('sha256', secret).update(visitId).digest('hex').slice(0, 12);
  return `vv:${visitId}:${hmac}`;
}

/**
 * Verify a QR token and extract the visit ID.
 */
export function verifyQrToken(
  token: string,
  secret: string,
): { valid: boolean; visitId: string | null } {
  const parts = token.split(':');
  if (parts.length !== 3 || parts[0] !== 'vv') {
    return { valid: false, visitId: null };
  }
  const visitId = parts[1];
  const providedHmac = parts[2];
  const expectedHmac = createHmac('sha256', secret).update(visitId).digest('hex').slice(0, 12);
  if (providedHmac !== expectedHmac) {
    return { valid: false, visitId: null };
  }
  return { valid: true, visitId };
}

/**
 * Generate a QR code PNG as a data URL.
 */
export async function generateQrDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
