import mongoose from 'mongoose';
import { settings } from '../src/config/env.js';
import { Movie } from '../src/models/movie.model.js';
import { Category } from '../src/models/category.model.js';

async function listProductsInfo() {
  await mongoose.connect(settings.mongoUri);
  
  console.log('\n=== CATÉGORIES (pour produits CAT_) ===\n');
  const categories = await Category.find({});
  categories.forEach(cat => {
    console.log(`Nom: ${cat.label.padEnd(20)} → Produit Payhip: CAT_${cat.slug}`);
  });
  
  console.log('\n=== FILMS (pour produits FILM_) ===\n');
  const movies = await Movie.find({}).select('_id title category');
  movies.forEach(movie => {
    console.log(`Titre: ${movie.title.padEnd(30)} → Produit Payhip: FILM_${movie._id}`);
  });
  
  console.log('\n=== ACCÈS TEMPORELS ===\n');
  console.log('1 heure  → Produit Payhip: TIME_1H');
  console.log('2 heures → Produit Payhip: TIME_2H');
  console.log('24h      → Produit Payhip: TIME_24H');
  
  await mongoose.connection.close();
}

listProductsInfo().catch(console.error);
