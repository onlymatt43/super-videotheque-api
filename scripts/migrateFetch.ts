import axios from 'axios';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Movie } from '../src/models/movie.model.js';
import { logger } from '../src/config/logger.js';

const OLD_LIBRARY_ID = '389178';
const OLD_API_KEY = '348bda20-a24a-40cd-bf58b8525234-d264-4534';
const NEW_LIBRARY_ID = '454374';
const NEW_API_KEY = '7063f0ed-c42f-441b-8b9b2be40f48-c618-431e';

interface BunnyVideo {
  guid: string;
  title: string;
  status: number;
  length: number;
  storageSize: number;
}

// Étape 1: Supprimer les vidéos en erreur sur Bunny
async function cleanupErrorVideos() {
  console.log('\n🧹 ÉTAPE 1/4 - Nettoyage des vidéos en erreur sur Bunny...\n');

  const { data } = await axios.get(
    `https://video.bunnycdn.com/library/${NEW_LIBRARY_ID}/videos`,
    {
      headers: { AccessKey: NEW_API_KEY },
      params: { page: 1, itemsPerPage: 200 },
    }
  );

  const errorVideos = data.items.filter((v: BunnyVideo) => v.status === 5);
  console.log(`Trouvé ${errorVideos.length} vidéos en erreur`);

  let deleted = 0;
  for (const video of errorVideos) {
    try {
      await axios.delete(
        `https://video.bunnycdn.com/library/${NEW_LIBRARY_ID}/videos/${video.guid}`,
        { headers: { AccessKey: NEW_API_KEY } }
      );
      deleted++;
      console.log(`✅ ${deleted}/${errorVideos.length} - Supprimé: ${video.title}`);
    } catch (error: any) {
      console.error(`❌ Erreur suppression ${video.title}: ${error.message}`);
    }
  }

  console.log(`\n✅ ${deleted} vidéos en erreur supprimées\n`);
  return deleted;
}

// Étape 2: Nettoyer MongoDB (garder seulement les vidéos qui existent sur Bunny)
async function cleanupMongoDB() {
  console.log('🧹 ÉTAPE 2/4 - Nettoyage MongoDB...\n');

  await mongoose.connect(env.MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  // Obtenir les vidéos valides sur Bunny
  const { data } = await axios.get(
    `https://video.bunnycdn.com/library/${NEW_LIBRARY_ID}/videos`,
    {
      headers: { AccessKey: NEW_API_KEY },
      params: { page: 1, itemsPerPage: 200 },
    }
  );

  const validBunnyIds = data.items
    .filter((v: BunnyVideo) => v.status === 4) // Ready
    .map((v: BunnyVideo) => v.guid);

  console.log(`Vidéos valides sur Bunny: ${validBunnyIds.length}`);

  // Supprimer les films qui n'existent pas sur Bunny ou sont dans l'ancienne library
  const result = await Movie.deleteMany({
    $or: [
      { bunnyVideoId: { $nin: validBunnyIds } },
      { bunnyLibraryId: OLD_LIBRARY_ID },
    ],
  });

  console.log(`✅ ${result.deletedCount} films supprimés de MongoDB\n`);

  await mongoose.disconnect();
  return result.deletedCount;
}

// Étape 3: Lister les vidéos de l'ancienne library
async function listOldLibraryVideos() {
  console.log('📋 ÉTAPE 3/4 - Liste des vidéos de l\'ancienne library...\n');

  const { data } = await axios.get(
    `https://video.bunnycdn.com/library/${OLD_LIBRARY_ID}/videos`,
    {
      headers: { AccessKey: OLD_API_KEY },
      params: { page: 1, itemsPerPage: 200 },
    }
  );

  const videos = data.items.filter((v: BunnyVideo) => v.status === 4 && v.length > 0);
  console.log(`✅ ${videos.length} vidéos prêtes dans l'ancienne library\n`);

  return videos;
}

// Étape 4: Migrer avec l'API Fetch de Bunny (serveur à serveur)
async function migrateWithFetch(oldVideos: BunnyVideo[]) {
  console.log('🚀 ÉTAPE 4/4 - Migration avec Bunny Fetch API...\n');

  const report = {
    total: oldVideos.length,
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < oldVideos.length; i++) {
    const video = oldVideos[i];
    console.log(`\n[${i + 1}/${oldVideos.length}] ${video.title}`);

    try {
      // URL de la vidéo source dans l'ancienne library
      const sourceUrl = `https://video.bunnycdn.com/play/${OLD_LIBRARY_ID}/${video.guid}`;

      // Créer la vidéo dans la nouvelle library via Fetch
      const { data: newVideo } = await axios.post(
        `https://video.bunnycdn.com/library/${NEW_LIBRARY_ID}/videos/fetch`,
        {
          url: sourceUrl,
          title: video.title,
          headers: {
            AccessKey: OLD_API_KEY,
          },
        },
        {
          headers: {
            AccessKey: NEW_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      // Bunny retourne le guid dans 'videoGuid' ou dans l'objet lui-même
      const newVideoGuid = newVideo.id || newVideo.videoGuid || newVideo.guid;
      
      if (!newVideoGuid) {
        throw new Error(`Pas de GUID retourné par Bunny: ${JSON.stringify(newVideo)}`);
      }

      console.log(`  ✅ Créé sur Bunny: ${newVideoGuid}`);

      // Attendre que Bunny encode
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Créer l'entrée MongoDB
      await mongoose.connect(env.MONGO_URI);
      
      const slug = video.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      await Movie.create({
        title: video.title,
        slug: slug || `video-${newVideoGuid}`,
        bunnyLibraryId: NEW_LIBRARY_ID,
        bunnyVideoId: newVideoGuid,
        videoPath: `/${NEW_LIBRARY_ID}/${newVideoGuid}.mp4`,
        category: 'uncategorized',
        rentalDurationHours: 1,
        isFreePreview: false,
        tags: ['migrated'],
        previewUrl: `https://vz-a6e64a9e-b20.b-cdn.net/${newVideoGuid}/playlist.m3u8`,
        thumbnailUrl: `https://vz-a6e64a9e-b20.b-cdn.net/${newVideoGuid}/thumbnail.jpg`,
      });

      await mongoose.disconnect();

      console.log(`  ✅ Ajouté à MongoDB`);
      report.successful++;
    } catch (error: any) {
      const errorMsg = `${video.title}: ${error.response?.data?.message || error.message}`;
      report.errors.push(errorMsg);
      report.failed++;
      console.error(`  ❌ ${errorMsg}`);
    }
  }

  return report;
}

// Exécution principale
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('🎬 MIGRATION BUNNY OPTIMISÉE (FETCH API)');
  console.log('═══════════════════════════════════════');

  try {
    // Étape 1: Nettoyer les vidéos en erreur
    await cleanupErrorVideos();

    // Étape 2: Nettoyer MongoDB
    await cleanupMongoDB();

    // Étape 3: Lister l'ancienne library
    const oldVideos = await listOldLibraryVideos();

    // Étape 4: Migrer avec Fetch
    const report = await migrateWithFetch(oldVideos);

    // Résumé final
    console.log('\n═══════════════════════════════════════');
    console.log('📊 RÉSUMÉ FINAL');
    console.log('═══════════════════════════════════════');
    console.log(`Total vidéos: ${report.total}`);
    console.log(`✅ Succès: ${report.successful}`);
    console.log(`❌ Échecs: ${report.failed}`);

    if (report.errors.length > 0) {
      console.log('\n❌ Erreurs:');
      report.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    process.exit(report.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    process.exit(1);
  }
}

main();
