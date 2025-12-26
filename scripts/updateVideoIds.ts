import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { env } from '../src/config/env.js';
import { Movie } from '../src/models/movie.model.js';
import { logger } from '../src/config/logger.js';

interface MigrationDetail {
  success: boolean;
  oldVideoId: string;
  newVideoId: string;
  title: string;
}

interface MigrationReport {
  oldLibraryId: string;
  newLibraryId: string;
  total: number;
  successful: number;
  failed: number;
  details: MigrationDetail[];
  timestamp: string;
}

async function updateVideoIds(reportPath: string) {
  try {
    // Lire le rapport de migration
    const reportContent = readFileSync(reportPath, 'utf-8');
    const report: MigrationReport = JSON.parse(reportContent);

    console.log('\n=== MISE À JOUR DES VIDEO IDS ===');
    console.log(`Rapport: ${reportPath}`);
    console.log(`Total migrations: ${report.total}`);
    console.log(`Succès: ${report.successful}\n`);

    // Connecter à MongoDB
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    // Mettre à jour chaque vidéo
    for (const detail of report.details) {
      if (!detail.success) continue;

      try {
        // Trouver le film par l'ancien videoId
        const movie = await Movie.findOne({ bunnyVideoId: detail.oldVideoId });

        if (!movie) {
          notFound++;
          console.log(`⚠️  Film non trouvé: ${detail.title} (${detail.oldVideoId})`);
          continue;
        }

        // Mettre à jour avec le nouveau videoId
        movie.bunnyVideoId = detail.newVideoId;
        movie.bunnyLibraryId = report.newLibraryId;
        movie.videoPath = `/${report.newLibraryId}/${detail.newVideoId}.mp4`;
        
        // Mettre à jour les URLs
        movie.previewUrl = `https://vz-a6e64a9e-b20.b-cdn.net/${detail.newVideoId}/playlist.m3u8`;
        movie.thumbnailUrl = `https://vz-a6e64a9e-b20.b-cdn.net/${detail.newVideoId}/thumbnail.jpg`;

        await movie.save();
        updated++;
        console.log(`✅ ${updated}/${report.successful} - ${movie.title}`);
      } catch (error: any) {
        errors++;
        console.error(`❌ Erreur: ${detail.title} - ${error.message}`);
      }
    }

    console.log('\n=== RÉSULTAT ===');
    console.log(`✅ Mis à jour: ${updated}`);
    console.log(`⚠️  Non trouvés: ${notFound}`);
    console.log(`❌ Erreurs: ${errors}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Erreur fatale:', error);
    process.exit(1);
  }
}

// Exécution
const reportPath = process.argv[2] || '/tmp/migration-report-1766734238798.json';
updateVideoIds(reportPath);
