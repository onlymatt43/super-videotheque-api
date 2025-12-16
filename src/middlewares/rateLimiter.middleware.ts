import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Trop de requêtes, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limiter for creation endpoints - 10 requests per hour
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Limite de création atteinte, réessayez dans une heure.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * OpenAI/Chat rate limiter - 20 requests per hour (coûteux!)
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Limite de chat atteinte, réessayez plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rental creation limiter - 30 per hour per IP
 */
export const rentalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: 'Trop de tentatives de location, réessayez plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});
