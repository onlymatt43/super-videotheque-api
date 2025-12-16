/**
 * Script pour gérer les previews gratuits
 * 
 * Usage:
 *   npm run previews:list          - Voir tous les films et leur statut
 *   npm run previews:enable <id>   - Activer le preview gratuit pour un film
 *   npm run previews:disable <id>  - Désactiver le preview gratuit
 *   npm run previews:enable-all    - Activer pour tous les films
 *   npm run previews:disable-all   - Désactiver pour tous les films
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Movie } from '../src/models/movie.model.js';

const MONGO_URI = process.env.MONGO_URI!;

const connect = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB\n');
};

const disconnect = async () => {
  await mongoose.disconnect();
};

const listMovies = async () => {
  const movies = await Movie.find().sort({ createdAt: -1 });
  
  console.log('📽️  Films dans la base de données:\n');
  console.log('─'.repeat(80));
  
  for (const movie of movies) {
    const status = movie.isFreePreview ? '✅ PREVIEW GRATUIT' : '🔒 Payant';
    console.log(`${status}  │  ${movie._id}  │  ${movie.title}`);
  }
  
  console.log('─'.repeat(80));
  console.log(`\nTotal: ${movies.length} films`);
  console.log(`Previews gratuits: ${movies.filter(m => m.isFreePreview).length}`);
};

const enablePreview = async (movieId: string) => {
  const movie = await Movie.findByIdAndUpdate(
    movieId,
    { isFreePreview: true },
    { new: true }
  );
  
  if (!movie) {
    console.log(`❌ Film non trouvé: ${movieId}`);
    return;
  }
  
  console.log(`✅ Preview gratuit activé pour: ${movie.title}`);
};

const disablePreview = async (movieId: string) => {
  const movie = await Movie.findByIdAndUpdate(
    movieId,
    { isFreePreview: false },
    { new: true }
  );
  
  if (!movie) {
    console.log(`❌ Film non trouvé: ${movieId}`);
    return;
  }
  
  console.log(`🔒 Preview gratuit désactivé pour: ${movie.title}`);
};

const enableAll = async () => {
  const result = await Movie.updateMany({}, { isFreePreview: true });
  console.log(`✅ Preview gratuit activé pour ${result.modifiedCount} films`);
};

const disableAll = async () => {
  const result = await Movie.updateMany({}, { isFreePreview: false });
  console.log(`🔒 Preview gratuit désactivé pour ${result.modifiedCount} films`);
};

const main = async () => {
  const [,, command, arg] = process.argv;
  
  await connect();
  
  try {
    switch (command) {
      case 'list':
        await listMovies();
        break;
      case 'enable':
        if (!arg) {
          console.log('❌ Usage: npm run previews:enable <movie_id>');
          break;
        }
        await enablePreview(arg);
        break;
      case 'disable':
        if (!arg) {
          console.log('❌ Usage: npm run previews:disable <movie_id>');
          break;
        }
        await disablePreview(arg);
        break;
      case 'enable-all':
        await enableAll();
        break;
      case 'disable-all':
        await disableAll();
        break;
      default:
        console.log(`
📽️  Gestion des Previews Gratuits
─────────────────────────────────

Commandes disponibles:
  npm run previews:list          - Voir tous les films
  npm run previews:enable <id>   - Activer preview gratuit
  npm run previews:disable <id>  - Désactiver preview gratuit
  npm run previews:enable-all    - Activer pour tous
  npm run previews:disable-all   - Désactiver pour tous
        `);
    }
  } finally {
    await disconnect();
  }
};

main().catch(console.error);
