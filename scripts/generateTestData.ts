import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logSecurityEvent, logAnalyticsEvent } from '../src/services/analytics.service.js';

async function generateTestData() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    console.log('📝 Génération de données de test...\n');

    // Simuler tentatives login admin échouées
    for (let i = 0; i < 5; i++) {
      await logSecurityEvent('admin_login_failed', `192.168.1.${100 + i}`, {
        userAgent: 'Mozilla/5.0 Test',
        path: '/api/movies',
      });
    }
    console.log('✅ 5 tentatives login admin échouées');

    // Simuler codes invalides
    for (let i = 0; i < 8; i++) {
      await logSecurityEvent('invalid_code', `10.0.0.${50 + i}`, {
        licenseKey: `INVALID_CODE_${i}`,
        email: `test${i}@example.com`,
        reason: i % 3 === 0 ? 'license_not_found' : i % 3 === 1 ? 'license_disabled' : 'code_expired',
      });
    }
    console.log('✅ 8 codes invalides');

    // Simuler accès suspects
    for (let i = 0; i < 3; i++) {
      await logSecurityEvent('suspicious_access', '45.142.212.61', {
        reason: 'Too many requests',
        endpoint: '/api/movies',
      });
    }
    console.log('✅ 3 accès suspects');

    // Simuler nouveaux codes ajoutés
    for (let i = 0; i < 15; i++) {
      await logAnalyticsEvent('code_added', {
        userId: `user${i}@example.com`,
        metadata: {
          accessType: i % 3 === 0 ? 'time' : i % 3 === 1 ? 'film' : 'category',
          accessValue: i % 3 === 0 ? 'all' : i % 3 === 1 ? '67890abc' : 'action',
          productName: `TEST_PRODUCT_${i}`,
        },
      });
    }
    console.log('✅ 15 nouveaux codes ajoutés');

    // Simuler codes expirés
    for (let i = 0; i < 7; i++) {
      await logAnalyticsEvent('code_expired', {
        userId: `expired${i}@example.com`,
        metadata: {
          accessType: 'time',
        },
      });
    }
    console.log('✅ 7 codes expirés');

    // Simuler vues de films (simuler avec des IDs)
    const fakeMovieIds = ['movie1', 'movie2', 'movie3', 'movie1', 'movie2', 'movie1'];
    for (const movieId of fakeMovieIds) {
      await logAnalyticsEvent('movie_viewed', {
        userId: 'viewer@example.com',
        movieId,
        category: movieId === 'movie1' ? 'action' : movieId === 'movie2' ? 'comedy' : 'drama',
      });
    }
    console.log('✅ 6 vues de films (movie1: 3, movie2: 2, movie3: 1)');

    // Simuler erreurs
    for (let i = 0; i < 4; i++) {
      await logAnalyticsEvent('error', {
        userId: 'user@example.com',
        metadata: {
          errorType: i % 2 === 0 ? 'video_load_failed' : 'payment_failed',
          message: `Test error ${i}`,
        },
      });
    }
    console.log('✅ 4 erreurs (2 video_load_failed, 2 payment_failed)');

    console.log('\n✨ Données de test générées avec succès!\n');
    console.log('🧪 Maintenant tu peux tester:');
    console.log('   npm run security:analytics');
    console.log('   npm run cron:full\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

generateTestData();
