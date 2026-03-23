import rateLimit from 'express-rate-limit';

export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});

export const pairingRequestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Pairing-Anfragen. Bitte kurz warten.' },
});

export const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Heartbeats. Bitte kurz warten.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Uploads. Bitte kurz warten.' },
});
