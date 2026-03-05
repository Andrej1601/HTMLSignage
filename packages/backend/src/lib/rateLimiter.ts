import rateLimit from 'express-rate-limit';

export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});
