import axios from 'axios';
import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { pipeline } from 'stream/promises';
import mongoose from 'mongoose';
import { settings } from '../src/config/env.js';
import { Movie } from '../src/models/movie.model.js';

interface BunnyVideo {
  guid: string;
  videoLibraryId: number;
  title: string;
  availableResolutions: string;
  thumbnailFileName?: string;
  category?: string;
  [key: string]: any;
}

interface MigrationResult {
  success: boolean;
  oldVideoId: string;
  newVideoId?: string;
  title: string;
  error?: string;
}

const OLD_LIBRARY_ID = process.env.OLD_BUNNY_LIBRARY_ID || '';
const OLD_API_KEY = process.env.OLD_BUNNY_API_KEY || '';
const NEW_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || settings.bunnyLibraryId || '';
const NEW_API_KEY = process.env.BUNNY_API_KEY || '';

if (!OLD_LIBRARY_ID || !OLD_API_KEY || !NEW_LIBRARY_ID || !NEW_API_KEY) {
  console.error('❌ Variables manquantes. Définissez:');
  console.error('  OLD_BUNNY_LIBRARY_ID');
  console.error('  OLD_BUNNY_API_KEY');
  console.error('  BUNNY_LIBRARY_ID (ou NEW_BUNNY_LIBRARY_ID)');
  console.error('  BUNNY_API_KEY (ou NEW_BUNNY_API_KEY)');
  process.exit(1);
}

const bunnyApiOld = axios.create({
  baseURL: 'https://video.bunnycdn.com',
  headers: { AccessKey: OLD_API_KEY }
});

const bunnyApiNew = axios.create({
  baseURL: 'https://video.bunnycdn.com',
  headers: { AccessKey: NEW_API_KEY }
});

async function listOldLibraryVideos(): Promise<BunnyVideo[]> {
  console.log(`\n📋 Récupération des vidéos de la library ${OLD_LIBRARY_ID}...`);
  const response = await bunnyApiOld.get(`/library/${OLD_LIBRARY_ID}/videos`, {
    params: { page: 1, itemsPerPage: 1000 }
  });
  const videos = response.data.items || [];
  console.log(`✅ ${videos.length} vidéos trouvées\n`);
  return videos;
}

async function downloadVideo(videoId: string, title: string): Promise<string> {
  const tempFile = `/tmp/bunny_${videoId}.mp4`;
  const downloadUrl = `https://video.bunnycdn.com/play/${OLD_LIBRARY_ID}/${videoId}`;
  
  console.log(`  ⬇️  Téléchargement de "${title}"...`);
  
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
    headers: { AccessKey: OLD_API_KEY }
  });

  await pipeline(response.data, createWriteStream(tempFile));
  return tempFile;
}

async function createVideoInNewLibrary(title: string): Promise<string> {
  console.log(`  🆕 Création de la vidéo dans la nouvelle library...`);
  
  const response = await bunnyApiNew.post(`/library/${NEW_LIBRARY_ID}/videos`, {
    title
  });
  
  return response.data.guid;
}

async function uploadVideoFile(newVideoId: string, filePath: string, title: string): Promise<void> {
  console.log(`  ⬆️  Upload du fichier vidéo...`);
  
  const fs = await import('fs');
  const fileStream = fs.createReadStream(filePath);
  
  await bunnyApiNew.put(
    `/library/${NEW_LIBRARY_ID}/videos/${newVideoId}`,
    fileStream,
    {
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );
  
  console.log(`  ✅ Upload terminé pour "${title}"`);
}

async function updateMovieInDatabase(oldVideoId: string, newVideoId: string): Promise<void> {
  const movie = await Movie.findOne({ bunnyVideoId: oldVideoId });
  
  if (movie) {
    movie.bunnyVideoId = newVideoId;
    movie.bunnyLibraryId = NEW_LIBRARY_ID;
    
    // Mettre à jour le videoPath si nécessaire
    const newPullZoneHost = settings.bunnyPullZoneHost;
    movie.videoPath = `https://${newPullZoneHost}/${newVideoId}/playlist.m3u8`;
    
    await movie.save();
    console.log(`  📝 MongoDB mis à jour pour "${movie.title}"`);
  }
}

async function migrateVideo(video: BunnyVideo): Promise<MigrationResult> {
  const { guid: oldVideoId, title } = video;
  
  console.log(`\n🎬 Migration: ${title}`);
  
  try {
    // 1. Télécharger la vidéo
    const tempFile = await downloadVideo(oldVideoId, title);
    
    // 2. Créer l'entrée dans la nouvelle library
    const newVideoId = await createVideoInNewLibrary(title);
    
    // 3. Uploader le fichier
    await uploadVideoFile(newVideoId, tempFile, title);
    
    // 4. Nettoyer le fichier temporaire
    await unlink(tempFile);
    console.log(`  🗑️  Fichier temporaire supprimé`);
    
    // 5. Mettre à jour MongoDB si connecté
    if (mongoose.connection.readyState === 1) {
      await updateMovieInDatabase(oldVideoId, newVideoId);
    }
    
    console.log(`  ✅ Migration réussie: ${oldVideoId} → ${newVideoId}`);
    
    return {
      success: true,
      oldVideoId,
      newVideoId,
      title
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error(`  ❌ Erreur: ${errorMessage}`);
    
    return {
      success: false,
      oldVideoId,
      title,
      error: errorMessage
    };
  }
}

async function main() {
  console.log('\n🚀 Démarrage de la migration de library Bunny.net\n');
  console.log(`📦 Ancienne library: ${OLD_LIBRARY_ID}`);
  console.log(`📦 Nouvelle library: ${NEW_LIBRARY_ID}\n`);
  
  // Connexion MongoDB (optionnelle)
  try {
    await mongoose.connect(settings.mongoUri);
    console.log('✅ Connecté à MongoDB\n');
  } catch (error) {
    console.log('⚠️  MongoDB non connecté (les vidéos seront migrées mais pas la DB)\n');
  }
  
  // Récupérer la liste des vidéos
  const videos = await listOldLibraryVideos();
  
  if (videos.length === 0) {
    console.log('ℹ️  Aucune vidéo à migrer');
    process.exit(0);
  }
  
  // Confirmer avant de continuer
  console.log(`⚠️  Vous allez migrer ${videos.length} vidéos.`);
  console.log('   Cela peut prendre du temps selon la taille des vidéos.\n');
  
  // Migration
  const results: MigrationResult[] = [];
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`\n[${i + 1}/${videos.length}]`);
    
    const result = await migrateVideo(video);
    results.push(result);
    
    // Petite pause entre chaque vidéo pour ne pas surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Résumé
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ DE LA MIGRATION');
  console.log('═══════════════════════════════════════════════════\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Réussies: ${successful.length}`);
  console.log(`❌ Échouées: ${failed.length}`);
  console.log(`📦 Total: ${results.length}\n`);
  
  if (failed.length > 0) {
    console.log('❌ Vidéos échouées:');
    failed.forEach(f => {
      console.log(`   - ${f.title} (${f.oldVideoId}): ${f.error}`);
    });
  }
  
  // Sauvegarder le rapport
  const fs = await import('fs/promises');
  const report = {
    timestamp: new Date().toISOString(),
    oldLibraryId: OLD_LIBRARY_ID,
    newLibraryId: NEW_LIBRARY_ID,
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    details: results
  };
  
  await fs.writeFile(
    `/tmp/migration-report-${Date.now()}.json`,
    JSON.stringify(report, null, 2)
  );
  
  console.log(`\n📄 Rapport sauvegardé: /tmp/migration-report-${Date.now()}.json`);
  
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  
  console.log('\n✨ Migration terminée!\n');
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n💥 Erreur fatale:', error);
  process.exit(1);
});
