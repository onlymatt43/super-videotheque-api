# Guide de migration de library Bunny.net

## Variables d'environnement requises

Ajoutez ces variables dans votre fichier `.env` pour la migration :

```bash
# Ancienne library (celle que vous voulez migrer)
OLD_BUNNY_LIBRARY_ID=123456
OLD_BUNNY_API_KEY=votre-ancien-api-key

# Nouvelle library (celle actuellement utilisée)
BUNNY_LIBRARY_ID=654321
BUNNY_API_KEY=votre-nouveau-api-key
BUNNY_PULL_ZONE_HOST=votre-pull-zone.b-cdn.net

# MongoDB (pour mettre à jour les IDs)
MONGO_URI=mongodb+srv://...
```

## Comment lancer la migration

1. **Assurez-vous d'avoir les bonnes variables d'environnement**
   ```bash
   cd /Users/mathieucourchesne/clone/super-videotheque-api
   ```

2. **Vérifiez votre fichier `.env`** avec les variables ci-dessus

3. **Lancez le script**
   ```bash
   npm run migrate:library
   ```

## Ce que fait le script

Pour chaque vidéo de l'ancienne library :
1. ⬇️  Télécharge la vidéo
2. 🆕 Crée une nouvelle entrée dans la nouvelle library
3. ⬆️  Upload la vidéo
4. 📝 Met à jour MongoDB avec le nouveau `bunnyVideoId`
5. 🗑️  Supprime le fichier temporaire

## Durée estimée

- ~1-3 minutes par vidéo selon la taille
- Pour 100 vidéos : environ 2-5 heures

## Rapport de migration

Un rapport JSON sera généré dans `/tmp/migration-report-[timestamp].json` avec :
- Nombre de vidéos migrées avec succès
- Vidéos échouées et raisons
- Mapping ancien ID → nouveau ID

## Important

⚠️  **NE PAS INTERROMPRE** le script pendant la migration
⚠️  **VÉRIFIEZ** que vous avez assez d'espace disque temporaire
⚠️  **TESTEZ** d'abord avec quelques vidéos en limitant le script

## Après la migration

1. Vérifiez que les vidéos fonctionnent sur votre site
2. Vous pouvez supprimer l'ancienne library dans Bunny.net
3. Retirez les variables `OLD_BUNNY_*` de votre `.env`
