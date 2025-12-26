import { syncAllLibraries } from './syncBunny.js';
import { performHealthCheck, restartRenderService } from './healthCheck.js';
import { generateSecurityAnalytics, formatReportForEmail } from './securityAnalytics.js';
import { sendAlert } from '../src/services/email.service.js';
import { logger } from '../src/config/logger.js';

interface CronReport {
  timestamp: string;
  duration: number;
  health: {
    overall: string;
    details: any[];
  };
  sync: {
    results: any[];
    totalSynced: number;
  };
  security: {
    report: any;
    alertsTriggered: boolean;
  };
  actions: string[];
  success: boolean;
}

async function runCronJob(): Promise<CronReport> {
  const startTime = Date.now();
  const report: CronReport = {
    timestamp: new Date().toISOString(),
    duration: 0,
    health: { overall: 'unknown', details: [] },
    sync: { results: [], totalSynced: 0 },
    security: { report: null, alertsTriggered: false },
    actions: [],
    success: true,
  };

  try {
    logger.info('=== DÉBUT CRON JOB ===');

    // Connecter MongoDB une fois
    await mongoose.connect(env.MONGO_URI);
    logger.info('Connecté à MongoDB');

    // 1. Health Check
    logger.info('1/2 - Health Check...');
    const healthResult = await performHealthCheck();
    report.health = {
      overall: healthResult.overall,
      details: healthResult.checks,
    };

    const criticalServices = healthResult.checks.filter((c) => c.status === 'error');

    if (criticalServices.length > 0) {
      logger.warn({ criticalServices }, 'Services critiques détectés');
      report.actions.push(`${criticalServices.length} service(s) en erreur détecté(s)`);

      // Tenter de redémarrer si nécessaire
      const needsRestart = criticalServices.some((s) => s.service.includes('Render'));
      if (needsRestart) {
        logger.info('Tentative de redémarrage automatique...');
        const restarted = await restartRenderService();
        if (restarted) {
          report.actions.push('Service Render redémarré automatiquement');
        } else {
          report.actions.push('Échec du redémarrage automatique');
        }
      }

      // Envoyer alerte email
      const alertMessage = `
Services en erreur:
${criticalServices.map((s) => `- ${s.service}: ${s.message}`).join('\n')}

Actions effectuées:
${report.actions.join('\n')}

Timestamp: ${report.timestamp}
      `.trim();

      await sendAlert('Services critiques détectés', alertMessage);
      report.actions.push('Email d\'alerte envoyé');
    }

    // 2. Sync Bunn3
    logger.info('2/2 - Sync Bunny Libraries...');
    const syncResults = await syncAllLibraries();
    report.sync.results = syncResults;
    report.sync.totalSynced = syncResults.reduce((sum, r) => sum + r.synced, 0);

    if (report.sync.totalSynced > 0) {
      report.actions.push(`${report.sync.totalSynced} nouveau(x) film(s) synchronisé(s)`);

      // Email de notification si nouveaux films
      const notificationMessage = `
Nouveaux films synchronisés: ${report.sync.totalSynced}

Détails par library:
${syncResults
  .map(
    (r) => `- ${r.library}: ${r.synced} nouveau(x) sur ${r.total} total${
      r.errors.length > 0 ? ` (${r.errors.length} erreur(s))` : ''
    }`
  )
  .join('\n')}

Timestamp: ${report.timestamp}
      `.trim();

      await sendAlert('Nouveaux films synchronisés', notificationMessage);
      report.actions.push('Email de notification envoyé');
    }

    // Vérifier les erreurs de sync
    const syncErrors = syncResults.flatMap((r) => r.errors);
    if (syncErrors.length > 0) {
      logger.warn({ syncErrors }, 'Erreurs de synchronisation détectées');
      report.actions.push(`${syncErrors.length} erreur(s) de sync`);

      const errorMessage = `
Erreurs lors de la synchronisation:
${syncErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Timestamp: ${report.timestamp}
      `.trim();

      await sendAlert('Erreurs de synchronisation', errorMessage);
    }
    // 3. Sécurité & Analytics
    logger.info('3/3 - Analyse sécurité & analytics...');
    const securityReport = await generateSecurityAnalytics(24);
    report.security.report = securityReport;

    // Vérifier si alertes critiques
    const hasCriticalSecurity =
      securityReport.security.adminLoginFailures > 10 ||
      securityReport.security.invalidCodes > 50 ||
      securityReport.security.suspiciousAccess > 5;

    if (hasCriticalSecurity) {
      report.security.alertsTriggered = true;
      report.actions.push('Alertes sécurité critiques détectées');

      const securityAlert = `
⚠️ ALERTES SÉCURITÉ CRITIQUES ⚠️

${securityReport.security.adminLoginFailures > 10 ? `🚨 ${securityReport.security.adminLoginFailures} tentatives login admin échouées (seuil: 10)\n` : ''}${securityReport.security.invalidCodes > 50 ? `🚨 ${securityReport.security.invalidCodes} codes invalides tentés (seuil: 50)\n` : ''}${securityReport.security.suspiciousAccess > 5 ? `🚨 ${securityReport.security.suspiciousAccess} accès suspects détectés (seuil: 5)\n` : ''}
${
  securityReport.security.topSuspiciousIPs.length > 0
    ? `\nTop IPs suspectes:\n${securityReport.security.topSuspiciousIPs.map((ip) => `  • ${ip.ip} (${ip.count} événements)`).join('\n')}`
    : ''
}

Timestamp: ${report.timestamp}
      `.trim();

      await sendAlert('🚨 SÉCURITÉ - Alertes critiques', securityAlert);
    }

    report.duration = Date.now() - startTime;
    logger.info({ duration: report.duration, report }, '=== CRON JOB TERMINÉ ===');

    // Email de rapport quotidien complet
    const securitySection = formatReportForEmail(securityReport);
    
    const summaryMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 RAPPORT QUOTIDIEN - VIDÉOTHÈQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Statut Global: ${report.health.overall.toUpperCase()}
${report.security.alertsTriggered ? '⚠️ ALERTES SÉCURITÉ DÉTECTÉES' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 HEALTH CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${report.health.details
  .map((c) => {
    const icon = c.status === 'ok' ? '✓' : c.status === 'warning' ? '⚠' : '✗';
    return `${icon} ${c.service}: ${c.message}`;
  })
  .join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 SYNCHRONISATION BUNNY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${syncResults
  .map((r) => `${r.library}: ${r.synced} nouveau(x) / ${r.total} total`)
  .join('\n')}

${securitySection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ ACTIONS EFFECTUÉES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${report.actions.length > 0 ? report.actions.map((a) => `• ${a}`).join('\n') : '• Aucune action requise'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️ Durée: ${(report.duration / 1000).toFixed(1)}s
🕐 Timestamp: ${report.timestamp}
    `.trim();

    await sendAlert('Rapport quotidien - Vidéothèque', summaryMessage);

    // Déconnecter MongoDB
    await mongoose.disconnect();
    logger.info('Déconnecté de MongoDB');

    return report;
  } catch (error: any) {
    logger.error({ error }, '=== ERREUR FATALE CRON JOB ===');
    report.success = false;
    report.duration = Date.now() - startTime;

    // Email d'erreur fatale
    try {
      await sendAlert(
        'ERREUR FATALE - Cron Job',
        `
Une erreur fatale s'est produite lors du cron job:

${error.message}

Stack trace:
${error.stack}

Timestamp: ${report.timestamp}
        `.trim()
      );
    } catch (emailError) {
      logger.error({ emailError }, 'Impossible d\'envoyer l\'email d\'erreur');
    }

    throw error;
  }
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  runCronJob()
    .then((report) => {
      console.log('\n=== RAPPORT CRON JOB ===');
      console.log(`Timestamp: ${report.timestamp}`);
      console.log(`Durée: ${(report.duration / 1000).toFixed(1)}s`);
      console.log(`Statut: ${report.health.overall.toUpperCase()}`);
      console.log(`Films synchronisés: ${report.sync.totalSynced}`);
      console.log(`Alertes sécurité: ${report.security.alertsTriggered ? 'OUI ⚠️' : 'Non'}`);
      console.log(`Actions: ${report.actions.length}`);
      report.actions.forEach((action) => console.log(`  - ${action}`));
      console.log('\n✅ Rapport complet envoyé par email.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur fatale:', error);
      process.exit(1);
    });
} 