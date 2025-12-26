import { SecurityLog, AnalyticsEvent } from '../models/log.model.js';
import { logger } from '../config/logger.js';
import crypto from 'crypto';

// Hash pour anonymiser les identifiants
export function hashUserId(identifier: string): string {
  return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
}

// Logs de sécurité
export async function logSecurityEvent(
  type: 'admin_login_failed' | 'invalid_code' | 'suspicious_access' | 'rate_limit_hit',
  ip: string,
  details: any,
  userAgent?: string
): Promise<void> {
  try {
    await SecurityLog.create({
      type,
      ip,
      userAgent,
      details,
    });
    logger.warn({ type, ip, details }, 'Événement de sécurité');
  } catch (error) {
    logger.error({ error }, 'Erreur logging sécurité');
  }
}

// Analytics utilisateurs
export async function logAnalyticsEvent(
  type: 'code_added' | 'code_expired' | 'movie_viewed' | 'error' | 'session_start',
  data: {
    userId?: string;
    movieId?: string;
    category?: string;
    metadata?: any;
  }
): Promise<void> {
  try {
    await AnalyticsEvent.create({
      type,
      userId: data.userId ? hashUserId(data.userId) : undefined,
      movieId: data.movieId,
      category: data.category,
      metadata: data.metadata,
    });
    logger.debug({ type, data }, 'Événement analytics');
  } catch (error) {
    logger.error({ error }, 'Erreur logging analytics');
  }
}
