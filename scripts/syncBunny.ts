import axios from 'axios';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { Movie } from '../src/models/movie.model.js';

interface BunnyVideo {
  guid: string;
  title: string;
  dateUploaded: string;
  views: number;
  length: number;
  status: number;
  thumbnailFileName?: string;
}

interface SyncResult {
  library: string;
  total: number;
  synced: number;
  errors: string[];
}

async function listBunnyVideos(libraryId: string, apiKey: string): Promise<BunnyVideo[]> {
  try {
    const response = await axios.get(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        headers: { AccessKey: apiKey },
        params: { page: 1, itemsPerPage: 1000 },
      }
    );
    return response.data.items || [];
  } catch (error) {
    logger.error({ error, libraryId }, 'Erreur listage vidéos Bunny');
    throw error;
  }
}

async function syncLibrary(
  libraryId: string,
  apiKey: string,
  libraryName: string,
  isPreview: boolean = false
): Promise<SyncResult> {
  const result: SyncResult = {
    library: libraryName,
    total: 0,
    synced: 0,
    errors: [],
  };

  try {
    logger.info({ libraryId, libraryName }, 'Début sync library');

    const videos = await listBunnyVideos(libraryId, apiKey);
    result.total = videos.length;

    logger.info({ count: videos.length, library: libraryName }, 'Vidéos trouvées');

    for (const video of videos) {
      try {
        // Vérifie si le film existe déjà
        const existingMovie = await Movie.findOne({
          [isPreview ? 'previewVideoId' : 'videoId']: video.guid,
        });

        if (existingMovie) {
          logger.debug(
            { videoId: video.guid, title: video.title },
            'Vidéo déjà en DB'
          );
          continue;
        }

        // Crée un nouveau film si c'est la library principale
        if (!isPreview) {
          const newMovie = await Movie.create({
            title: video.title,
            videoId: video.guid,
            category: 'uncategorized',
            duration: Math.round(video.length / 60), // secondes -> minutes
            releaseYear: new Date(video.dateUploaded).getFullYear(),
            thumbnail: video.thumbnailFileName || '',
            description: `Importé automatiquement le ${new Date().toLocaleDateString('fr-CA')}`,
            tags: ['auto-imported'],
            views: video.views || 0,
          });

          logger.info({ movieId: newMovie._id, title: video.title }, 'Film créé');
          result.synced++;
        } else {
          // Pour les previews, on log juste qu'il y a une preview orpheline
          logger.warn(
            { videoId: video.guid, title: video.title },
            'Preview sans film associé'
          );
        }
      } catch (error: any) {
        const errorMsg = `Erreur sync ${video.title}: ${error.message}`;
        logger.error({ error, video }, errorMsg);
        result.errors.push(errorMsg);
      }
    }

    logger.info(result, 'Sync library terminée');
  } catch (error: any) {
    const errorMsg = `Erreur sync library ${libraryName}: ${error.message}`;
    logger.error({ error, libraryName }, errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

export async function syncAllLibraries(): Promise<SyncResult[]> {
  let shouldDisconnect = false;

  try {
    // Connecter seulement si pas déjà connecté
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
      logger.info('Connecté à MongoDB');
      shouldDisconnect = true;
    }

    const results: SyncResult[] = [];

    // Sync library principale
    const mainResult = await syncLibrary(
      env.BUNNY_LIBRARY_ID,
      env.BUNNY_API_KEY,
      'Library Principale (454374)',
      false
    );
    results.push(mainResult);

    // Sync library preview
    const previewResult = await syncLibrary(
      env.BUNNY_PUBLIC_LIBRARY_ID,
      env.BUNNY_PUBLIC_API_KEY,
      'Library Preview (420867)',
      true
    );
    results.push(previewResult);

    return results;
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
      logger.info('Déconnecté de MongoDB');
    }
  }
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAllLibraries()
    .then((results) => {
      console.log('\n=== RÉSULTATS SYNC BUNNY ===');
      results.forEach((result) => {
        console.log(`\n${result.library}:`);
        console.log(`  Total: ${result.total} vidéos`);
        console.log(`  Synchronisées: ${result.synced} nouvelles`);
        if (result.errors.length > 0) {
          console.log(`  Erreurs: ${result.errors.length}`);
          result.errors.forEach((err) => console.log(`    - ${err}`));
        }
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur fatale:', error);
      process.exit(1);
    });
}
