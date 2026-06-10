import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

/**
 * Escapuje znaki specjalne HTML. appUrl pochodzi ze zmiennej środowiskowej
 * (nie z inputu użytkownika), ale escapujemy defensywnie — gdyby kiedyś trafiła
 * tam wartość kontrolowana z zewnątrz, nie wstrzyknie znaczników do treści maila.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Treść i HTML wiadomości z kodem logowania. */
export function buildLoginEmail(
  code: string,
  appUrl: string
): { subject: string; text: string; html: string } {
  const subject = `Twój kod logowania: ${code}`;
  const safeAppUrl = escapeHtml(appUrl);

  const text = `
Witaj,

Twój kod logowania do ${appUrl} to:

  ${code}

Kod jest ważny przez 15 minut i może być użyty tylko raz.

Jeśli nie prosiłeś/aś o ten kod, zignoruj tę wiadomość.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"></head>
<body style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; color: #1c1917;">
  <h2 style="margin: 0 0 16px;">Kod logowania</h2>
  <p>Twój kod logowania do <a href="${safeAppUrl}">${safeAppUrl}</a>:</p>
  <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; text-align: center;
              padding: 24px; background: #f5f5f4; border-radius: 8px; margin: 24px 0;">
    ${code}
  </div>
  <p style="color: #78716c; font-size: 14px;">
    Kod jest ważny przez <strong>15 minut</strong> i może być użyty tylko raz.<br>
    Jeśli nie prosiłeś/aś o ten kod, zignoruj tę wiadomość.
  </p>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/** Opcje wstrzykiwane do sendLoginCode (produkcja vs test). */
export interface SendOptions {
  transport: Pick<Mail, 'sendMail'>;
  from: string;
  appUrl: string;
}

/**
 * Wysyła kod logowania na podany adres e-mail.
 * Transport jest wstrzykiwany — w testach używamy mocka,
 * w produkcji createTransport() z nodemailer.
 */
export async function sendLoginCode(
  to: string,
  code: string,
  options: SendOptions
): Promise<void> {
  const { subject, text, html } = buildLoginEmail(code, options.appUrl);

  await options.transport.sendMail({
    from: options.from,
    to,
    subject,
    text,
    html,
  });
}

/**
 * Tworzy produkcyjny transport SMTP z zmiennych środowiskowych.
 * Wywoływany w route.ts (nie w testach).
 */
export function createSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}
