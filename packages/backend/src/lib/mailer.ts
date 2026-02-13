import nodemailer from 'nodemailer';

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = (process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = (process.env.MAIL_FROM || '').trim();

let transporter: nodemailer.Transporter | null = null;

function getResetPasswordBaseUrl(): string | null {
  const configured = (process.env.RESET_PASSWORD_URL_BASE || process.env.FRONTEND_URL || '').trim();
  if (!configured || configured === '*') return null;

  try {
    const url = new URL(configured);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function getMailTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (!SMTP_HOST || Number.isNaN(SMTP_PORT) || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP is not fully configured (SMTP_HOST/PORT/USER/PASS).');
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

function buildResetPasswordUrl(token: string): string {
  const baseUrl = getResetPasswordBaseUrl();
  if (!baseUrl) {
    throw new Error('RESET_PASSWORD_URL_BASE or FRONTEND_URL must be a valid URL.');
  }

  const url = new URL('/reset-password', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function sendPasswordResetEmail(params: {
  to: string;
  username: string;
  token: string;
}): Promise<void> {
  const resetUrl = buildResetPasswordUrl(params.token);
  const from = MAIL_FROM || SMTP_USER;

  if (!from) {
    throw new Error('MAIL_FROM is required when SMTP is configured.');
  }

  const subject = 'HTMLSignage Passwort zuruecksetzen';
  const text = [
    `Hallo ${params.username},`,
    '',
    'du hast ein Zuruecksetzen deines Passworts angefordert.',
    `Nutze diesen Link, um ein neues Passwort zu setzen: ${resetUrl}`,
    '',
    'Der Link ist 60 Minuten gueltig.',
    'Wenn du das nicht warst, ignoriere diese E-Mail.',
  ].join('\n');

  const html = [
    `<p>Hallo ${params.username},</p>`,
    '<p>du hast ein Zuruecksetzen deines Passworts angefordert.</p>',
    `<p><a href="${resetUrl}">Passwort jetzt zuruecksetzen</a></p>`,
    '<p>Der Link ist <strong>60 Minuten</strong> gueltig.</p>',
    '<p>Wenn du das nicht warst, ignoriere diese E-Mail.</p>',
  ].join('');

  const mailer = getMailTransporter();
  await mailer.sendMail({
    from,
    to: params.to,
    subject,
    text,
    html,
  });
}
