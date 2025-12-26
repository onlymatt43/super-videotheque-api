import axios from 'axios';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';

export interface HealthStatus {
  service: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: any;
}

export async function checkMongoDB(): Promise<HealthStatus> {
  try {
    await mongoose.connect(env.MONGO_URI);
    const stats = await mongoose.connection.db.stats();
    await mongoose.disconnect();

    return {
      service: 'MongoDB',
      status: 'ok',
      message: 'Connexion réussie',
      details: {
        database: stats.db,
        collections: stats.collections,
        dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  } catch (error: any) {
    return {
      service: 'MongoDB',
      status: 'error',
      message: error.message,
    };
  }
}

export async function checkBunnyLibrary(
  libraryId: string,
  apiKey: string,
  libraryName: string
): Promise<HealthStatus> {
  try {
    const response = await axios.get(
      `https://video.bunnycdn.com/library/${libraryId}`,
      {
        headers: { AccessKey: apiKey },
        timeout: 10000,
      }
    );

    return {
      service: `Bunny.net ${libraryName}`,
      status: 'ok',
      message: 'Library accessible',
      details: {
        name: response.data.Name,
        videoCount: response.data.VideoCount,
        storageUsed: `${(response.data.StorageUsed / 1024 / 1024 / 1024).toFixed(2)} GB`,
      },
    };
  } catch (error: any) {
    return {
      service: `Bunny.net ${libraryName}`,
      status: 'error',
      message: error.message,
    };
  }
}

export async function checkPayhip(): Promise<HealthStatus> {
  try {
    const response = await axios.get(`${env.PAYHIP_API_BASE_URL}/license/verify`, {
      params: {
        product_link: env.PAYHIP_PRODUCT_ID,
        license_key: 'TEST_CHECK',
        email: 'test@test.com',
      },
      headers: {
        'payhip-api-key': env.PAYHIP_API_KEY,
      },
      timeout: 10000,
      validateStatus: () => true, // Accepte toutes les réponses
    });

    // Même si la vérification échoue, l'API est accessible
    return {
      service: 'Payhip API',
      status: 'ok',
      message: 'API accessible',
      details: {
        responseStatus: response.status,
      },
    };
  } catch (error: any) {
    return {
      service: 'Payhip API',
      status: 'error',
      message: error.message,
    };
  }
}

export async function checkRenderService(): Promise<HealthStatus> {
  try {
    const response = await axios.get(
      `https://api.render.com/v1/services/${env.RENDER_SERVICE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${env.RENDER_TOKEN}`,
        },
        timeout: 10000,
      }
    );

    const service = response.data;

    return {
      service: 'Render Service',
      status: service.suspended === 'suspended' ? 'warning' : 'ok',
      message: service.suspended === 'suspended' ? 'Service suspendu' : 'Service actif',
      details: {
        name: service.name,
        region: service.region,
        suspended: service.suspended,
        autoDeploy: service.autoDeploy,
      },
    };
  } catch (error: any) {
    return {
      service: 'Render Service',
      status: 'error',
      message: error.message,
    };
  }
}

export async function restartRenderService(): Promise<boolean> {
  try {
    logger.info('Tentative de redémarrage du service Render...');

    await axios.post(
      `https://api.render.com/v1/services/${env.RENDER_SERVICE_ID}/restart`,
      {},
      {
        headers: {
          Authorization: `Bearer ${env.RENDER_TOKEN}`,
        },
        timeout: 15000,
      }
    );

    logger.info('Service Render redémarré avec succès');
    return true;
  } catch (error: any) {
    logger.error({ error }, 'Échec redémarrage service Render');
    return false;
  }
}

export async function performHealthCheck(): Promise<{
  overall: 'healthy' | 'degraded' | 'critical';
  checks: HealthStatus[];
}> {
  logger.info('Début health check');

  const checks: HealthStatus[] = [];

  // MongoDB
  checks.push(await checkMongoDB());

  // Bunny Libraries
  checks.push(
    await checkBunnyLibrary(
      env.BUNNY_LIBRARY_ID,
      env.BUNNY_API_KEY,
      'Principale (454374)'
    )
  );
  checks.push(
    await checkBunnyLibrary(
      env.BUNNY_PUBLIC_LIBRARY_ID,
      env.BUNNY_PUBLIC_API_KEY,
      'Preview (420867)'
    )
  );

  // Payhip
  checks.push(await checkPayhip());

  // Render
  checks.push(await checkRenderService());

  // Déterminer le statut global
  const hasError = checks.some((c) => c.status === 'error');
  const hasWarning = checks.some((c) => c.status === 'warning');

  let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (hasError) overall = 'critical';
  else if (hasWarning) overall = 'degraded';

  logger.info({ overall, checksCount: checks.length }, 'Health check terminé');

  return { overall, checks };
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  performHealthCheck()
    .then(({ overall, checks }) => {
      console.log('\n=== HEALTH CHECK ===');
      console.log(`Statut global: ${overall.toUpperCase()}\n`);

      checks.forEach((check) => {
        const icon = check.status === 'ok' ? '✓' : check.status === 'warning' ? '⚠' : '✗';
        console.log(`${icon} ${check.service}: ${check.message}`);
        if (check.details) {
          Object.entries(check.details).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      });

      process.exit(overall === 'critical' ? 1 : 0);
    })
    .catch((error) => {
      console.error('Erreur fatale:', error);
      process.exit(1);
    });
}
