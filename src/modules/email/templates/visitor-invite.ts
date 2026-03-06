export function visitorInviteHtml(params: {
  visitorName: string;
  hostName: string;
  propertyName: string;
  date: string;
  scanLink: string;
  qrCid: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visitor Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#1976D2;padding:24px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Vanguard Visitor</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#333;margin:0 0 16px;">You're Invited!</h2>
              <p style="color:#555;font-size:16px;line-height:1.5;">
                Hello <strong>${params.visitorName}</strong>,
              </p>
              <p style="color:#555;font-size:16px;line-height:1.5;">
                <strong>${params.hostName}</strong> has invited you to visit
                <strong>${params.propertyName}</strong> on <strong>${params.date}</strong>.
              </p>
              <p style="color:#555;font-size:16px;line-height:1.5;">
                Please present the QR code below at the front desk for quick check-in:
              </p>
              <div style="text-align:center;margin:24px 0;">
                <img src="cid:${params.qrCid}" width="200" height="200" alt="QR Code" style="border:1px solid #eee;border-radius:8px;">
              </div>
              <div style="text-align:center;margin:24px 0;">
                <a href="${params.scanLink}" style="display:inline-block;background-color:#1976D2;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;font-weight:bold;">
                  Check In Online
                </a>
              </div>
              <p style="color:#999;font-size:13px;text-align:center;">
                Or copy this link: ${params.scanLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f8f8;padding:16px;text-align:center;">
              <p style="color:#999;font-size:12px;margin:0;">
                Powered by Vanguard Visitor &bull; vanguardvisitor.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
