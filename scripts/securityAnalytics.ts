import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { SecurityLog, AnalyticsEvent } from '../src/models/log.model.js';
import { Movie } from '../src/models/movie.model.js';

export interface SecurityAnalyticsReport {
  period: {
    start: Date;
    end: Date;
  };
  security: {
    adminLoginFailures: number;
    invalidCodes: number;
    suspiciousAccess: number;
    rateLimitHits: number;
    topSuspiciousIPs: Array<{ ip: string; count: number }>;
  };
  users: {
    newCodes: number;
    expiredCodes: number;
    activeSessions: number;
  };
  content: {
    totalViews: number;
    topMovies: Array<{ title: string; views: number; movieId: string }>;
    topCategories: Array<{ category: string; views: number }>;
  };
  errors: {
    total: number;
    byType: Array<{ type: string; count: number }>;
  };
}

export async function generateSecurityAnalytics(
  hours: number = 24
): Promise<SecurityAnalyticsReport> {
  let shouldDisconnect = false;

  try {
    // Connecter seulement si pas déjà connecté
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
      shouldDisconnect = true;
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

  logger.info({ startDate, endDate }, 'Génération rapport sécurité/analytics');

  const report: SecurityAnalyticsReport = {
    period: { start: startDate, end: endDate },
    security: {
      adminLoginFailures: 0,
      invalidCodes: 0,
      suspiciousAccess: 0,
      rateLimitHits: 0,
      topSuspiciousIPs: [],
    },
    users: {
      newCodes: 0,
      expiredCodes: 0,
      activeSessions: 0,
    },
    content: {
      totalViews: 0,
      topMovies: [],
      topCategories: [],
    },
    errors: {
      total: 0,
      byType: [],
    },
  };

  // 1. Sécurité - Compteurs par type
  const securityAggregation = await SecurityLog.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  securityAggregation.forEach((item) => {
    switch (item._id) {
      case 'admin_login_failed':
        report.security.adminLoginFailures = item.count;
        break;
      case 'invalid_code':
        report.security.invalidCodes = item.count;
        break;
      case 'suspicious_access':
        report.security.suspiciousAccess = item.count;
        break;
      case 'rate_limit_hit':
        report.security.rateLimitHits = item.count;
        break;
    }
  });

  // 2. Top IPs suspectes
  const topIPs = await SecurityLog.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: '$ip', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  report.security.topSuspiciousIPs = topIPs.map((item) => ({
    ip: item._id,
    count: item.count,
  }));

  // 3. Utilisateurs - Codes
  const codeStats = await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        type: { $in: ['code_added', 'code_expired'] },
      },
    },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  codeStats.forEach((item) => {
    if (item._id === 'code_added') report.users.newCodes = item.count;
    if (item._id === 'code_expired') report.users.expiredCodes = item.count;
  });

  // Sessions actives (uniques dans les dernières 24h)
  const activeSessions = await AnalyticsEvent.distinct('userId', {
    createdAt: { $gte: startDate, $lte: endDate },
    userId: { $exists: true },
  });
  report.users.activeSessions = activeSessions.length;

  // 4. Contenu - Vues de films
  const movieViews = await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        type: 'movie_viewed',
        movieId: { $exists: true },
      },
    },
    { $group: { _id: '$movieId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  report.content.totalViews = movieViews.reduce((sum, item) => sum + item.count, 0);

  // Enrichir avec les titres de films (seulement si ce sont des ObjectIds valides)
  try {
    const movieIds = movieViews
      .map((item) => item._id)
      .filter((id) => /^[0-9a-fA-F]{24}$/.test(id)); // Valider ObjectId
    
    const movies = movieIds.length > 0 
      ? await Movie.find({ _id: { $in: movieIds } }).select('title')
      : [];
    
    const movieMap = new Map(movies.map((m) => [m._id.toString(), m.title]));

    report.content.topMovies = movieViews.map((item) => ({
      movieId: item._id,
      title: movieMap.get(item._id) || `Film ${item._id}`,
      views: item.count,
    }));
  } catch (error) {
    // Si erreur, utiliser juste les IDs
    report.content.topMovies = movieViews.map((item) => ({
      movieId: item._id,
      title: `Film ${item._id}`,
      views: item.count,
    }));
  }

  // 5. Vues par catégorie
  const categoryViews = await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        type: 'movie_viewed',
        category: { $exists: true },
      },
    },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  report.content.topCategories = categoryViews.map((item) => ({
    category: item._id,
    views: item.count,
  }));

  // 6. Erreurs
  const errorStats = await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        type: 'error',
      },
    },
    { $group: { _id: '$metadata.errorType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  report.errors.total = errorStats.reduce((sum, item) => sum + item.count, 0);
  report.errors.byType = errorStats.map((item) => ({
    type: item._id || 'unknown',
    count: item.count,
  }));

  logger.info({ report }, 'Rapport sécurité/analytics généré');
  return report;
} catch (error) {
  logger.error({ error }, 'Erreur génération rapport');
  throw error;
} finally {
  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
}
}

export function formatReportForEmail(report: SecurityAnalyticsReport): string {
  const duration = Math.round(
    (report.period.end.getTime() - report.period.start.getTime()) / (1000 * 60 * 60)
  );

  return `
🔒 RAPPORT SÉCURITÉ & ANALYTICS (${duration}h)
Période: ${report.period.start.toLocaleString('fr-CA')} → ${report.period.end.toLocaleString('fr-CA')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SÉCURITÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Tentatives login admin échouées: ${report.security.adminLoginFailures}
❌ Codes invalides: ${report.security.invalidCodes}
🚨 Accès suspects: ${report.security.suspiciousAccess}
🚫 Rate limit dépassé: ${report.security.rateLimitHits}

${
  report.security.topSuspiciousIPs.length > 0
    ? `Top IPs suspectes:
${report.security.topSuspiciousIPs.map((ip) => `  • ${ip.ip} (${ip.count} événements)`).join('\n')}`
    : ''
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 UTILISATEURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Nouveaux codes ajoutés: ${report.users.newCodes}
⏰ Codes expirés: ${report.users.expiredCodes}
🟢 Sessions actives: ${report.users.activeSessions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 CONTENU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👁️ Total vues: ${report.content.totalViews}

${
  report.content.topMovies.length > 0
    ? `Top 10 Films:
${report.content.topMovies.map((m, i) => `  ${i + 1}. ${m.title} (${m.views} vues)`).join('\n')}`
    : '  Aucune vue enregistrée'
}

${
  report.content.topCategories.length > 0
    ? `\nTop Catégories:
${report.content.topCategories.map((c) => `  • ${c.category}: ${c.views} vues`).join('\n')}`
    : ''
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐛 ERREURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: ${report.errors.total}

${
  report.errors.byType.length > 0
    ? report.errors.byType.map((e) => `  • ${e.type}: ${e.count}`).join('\n')
    : '  Aucune erreur'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await mongoose.connect(env.MONGO_URI);
      logger.info('Connecté à MongoDB');

      const hours = Number(process.argv[2]) || 24;
      const report = await generateSecurityAnalytics(hours);

      console.log(formatReportForEmail(report));

      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Erreur:', error);
      process.exit(1);
    }
  })();
}
