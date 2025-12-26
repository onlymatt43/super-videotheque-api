import axios from 'axios';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { sendAlert } from '../src/services/email.service.js';

interface VideoStatus {
  total: number;
  ready: number;
  processing: number;
  error: number;
  other: number;
}

async function checkTranscodingStatus(): Promise<VideoStatus> {
  const response = await axios.get(
    `https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}/videos?page=1&itemsPerPage=200`,
    {
      headers: { AccessKey: env.BUNNY_API_KEY! },
    }
  );

  const videos = response.data.items;
  const status: VideoStatus = {
    total: videos.length,
    ready: 0,
    processing: 0,
    error: 0,
    other: 0,
  };

  videos.forEach((video: any) => {
    switch (video.status) {
      case 4:
        status.ready++;
        break;
      case 5:
        status.processing++;
        break;
      case 6:
        status.error++;
        break;
      default:
        status.other++;
    }
  });

  return status;
}

async function monitorTranscoding() {
  try {
    logger.info('🔍 Vérification du transcodage Bunny...');

    const status = await checkTranscodingStatus();

    logger.info({
      total: status.total,
      ready: status.ready,
      processing: status.processing,
      error: status.error,
    }, 'Statut actuel');

    // Toutes les vidéos sont prêtes
    if (status.processing === 0 && status.error === 0 && status.ready > 0) {
      logger.info('✅ Toutes les vidéos sont prêtes!');
      
      await sendAlert({
        subject: '✅ Migration Bunny Complétée',
        text: `Toutes les vidéos ont été transcodées avec succès!\n\nStatut:\n- Total: ${status.total}\n- Prêtes: ${status.ready}\n- En traitement: ${status.processing}\n- Erreurs: ${status.error}`,
        html: `
          <h2>✅ Migration Bunny Complétée</h2>
          <p>Toutes les vidéos ont été transcodées avec succès!</p>
          <h3>Statut:</h3>
          <ul>
            <li><strong>Total:</strong> ${status.total}</li>
            <li><strong>Prêtes:</strong> ${status.ready}</li>
            <li><strong>En traitement:</strong> ${status.processing}</li>
            <li><strong>Erreurs:</strong> ${status.error}</li>
          </ul>
        `,
      });

      return { completed: true, status };
    }

    // Certaines vidéos en erreur
    if (status.error > 0) {
      logger.warn(`⚠️ ${status.error} vidéos en erreur`);
      
      await sendAlert({
        subject: '⚠️ Erreurs de transcodage Bunny',
        text: `Attention: ${status.error} vidéos sont en erreur!\n\nStatut:\n- Total: ${status.total}\n- Prêtes: ${status.ready}\n- En traitement: ${status.processing}\n- Erreurs: ${status.error}`,
        html: `
          <h2>⚠️ Erreurs de transcodage Bunny</h2>
          <p>Attention: <strong>${status.error} vidéos sont en erreur!</strong></p>
          <h3>Statut:</h3>
          <ul>
            <li><strong>Total:</strong> ${status.total}</li>
            <li><strong>Prêtes:</strong> ${status.ready}</li>
            <li><strong>En traitement:</strong> ${status.processing}</li>
            <li><strong>Erreurs:</strong> ${status.error}</li>
          </ul>
        `,
      });

      return { completed: false, status, hasErrors: true };
    }

    // Encore en traitement
    logger.info(`⏳ ${status.processing} vidéos en cours de transcodage...`);
    const percentReady = ((status.ready / status.total) * 100).toFixed(1);
    logger.info(`Progression: ${percentReady}% (${status.ready}/${status.total})`);

    return { completed: false, status };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Erreur lors de la vérification');
    throw error;
  }
}

// Exécution
monitorTranscoding()
  .then((result) => {
    if (result.completed) {
      logger.info('✅ Monitoring terminé - migration complétée');
      process.exit(0);
    } else if (result.hasErrors) {
      logger.warn('⚠️ Monitoring terminé - erreurs détectées');
      process.exit(1);
    } else {
      logger.info('⏳ Monitoring terminé - transcodage en cours');
      process.exit(0);
    }
  })
  .catch((error) => {
    logger.error({ error }, 'Erreur fatale');
    process.exit(1);
  });
