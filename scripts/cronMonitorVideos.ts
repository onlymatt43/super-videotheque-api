import { CronJob } from 'cron';
import { execSync } from 'child_process';
import { logger } from '../src/config/logger.js';

// Monitoring du transcodage toutes les 30 minutes
const monitoringJob = new CronJob(
  '*/30 * * * *', // Toutes les 30 minutes
  async () => {
    try {
      logger.info('🔍 Lancement du monitoring vidéo...');
      execSync('npm run monitor:transcoding', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Erreur monitoring');
    }
  },
  null,
  true,
  'America/Toronto'
);

logger.info('📅 Cron de monitoring vidéo démarré (toutes les 30 min)');
logger.info('Appuie sur Ctrl+C pour arrêter');

// Keep the process alive
process.on('SIGINT', () => {
  logger.info('Arrêt du cron...');
  monitoringJob.stop();
  process.exit(0);
});
