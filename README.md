# SUPER-VIDEOTHEQUE – Backend API

Service de location vidéo basé sur Node.js + Express, MongoDB et intégrations Payhip/Bunny.net.

## Développement local

**Prérequis**
- Node.js LTS (recommandé: `22`, voir `.nvmrc`)
- MongoDB (Atlas ou local)

**Démarrage**
```bash
nvm use || true
npm install
npm run dev
```

## Fonctionnalités principales
- REST API structurée (controllers/services/routes).
- **Système multi-codes** : Support de différents types d'accès (temporel, par film, par catégorie).
- Validation serveur des codes Payhip avant création d'une location.
- Gestion des locations uniques avec expiration automatique (TTL MongoDB).
- Génération de liens Bunny.net signés et temporisés pour chaque lecture.
- TypeScript, logger Pino, validations Zod, middlewares d'erreurs prêts pour la prod.

## Système d'accès multi-codes

Le backend supporte maintenant **trois types d'accès** distincts via les codes Payhip :

### Types d'accès

| Type | Description | Durée | Exemple de produit Payhip |
| --- | --- | --- | --- |
| **time** | Accès complet au catalogue | Limité (ex: 1h, 24h) | `TIME_1H` ou `TIME_24H` |
| **film** | Accès à un film spécifique | Permanent | `FILM_676c45a3b9876543210abcde` |
| **category** | Accès à une catégorie complète | Permanent | `CAT_horror` ou `CAT_action` |

### Convention de nommage Payhip

Le backend détecte automatiquement le type d'accès selon le **nom du produit** Payhip :

**Accès temporel complet**
```
TIME_1H          → 1 heure d'accès complet
TIME_2H          → 2 heures d'accès complet
TIME_24H         → 24 heures d'accès complet
"1H Access"      → Détecté comme 1h (contient "1H")
```

**Accès à un film spécifique**
```
FILM_676c45a3b9876543210abcde    → Accès permanent au film avec cet ID
"Film special - FILM_123456"     → Détecté (contient "FILM_")
```

**Accès à une catégorie**
```
CAT_horror       → Accès permanent à tous les films d'horreur
CAT_action       → Accès permanent à tous les films d'action
CAT_comedy       → Accès permanent à tous les films comédie
```

### Création de produits Payhip

1. Allez sur https://payhip.com/dashboard
2. Créez un nouveau produit **License Key**
3. **Nom du produit** : Utilisez une des conventions ci-dessus
4. Le système détectera automatiquement le type d'accès
5. Si aucune convention n'est détectée → accès temporel 1h par défaut (rétrocompatibilité)

### Réponse API enrichie

L'endpoint `POST /payhip/validate` retourne maintenant :

```json
{
  "data": {
    "success": true,
    "licenseKey": "ABC123-XYZ",
    "email": "user@example.com",
    "productId": "12345",
    "accessType": "time",      // "time" | "film" | "category"
    "accessValue": "all",       // "all" | "film_id" | "category_slug"
    "duration": 3600            // en secondes (uniquement pour type "time")
  }
}
```

### Exemples d'utilisation

**Vendre 1h d'accès complet**
- Nom produit Payhip : `TIME_1H`
- Réponse : `{ accessType: "time", accessValue: "all", duration: 3600 }`

**Vendre accès à un film**
- Nom produit Payhip : `FILM_676c45a3b9876543210abcde`
- Réponse : `{ accessType: "film", accessValue: "676c45a3b9876543210abcde", duration: undefined }`

**Vendre accès à une catégorie**
- Nom produit Payhip : `CAT_horror`
- Réponse : `{ accessType: "category", accessValue: "horror", duration: undefined }`

## Déploiement Render

Ce backend est déployé en tant que service Node sur Render.

**URL de production:** https://super-videotheque-api.onrender.com

**Configuration requise:**
- `render.yaml` - Build/Start + env vars

## Variables d'environnement (Render)

Toutes ces variables doivent être configurées dans le dashboard Render pour le service.

| Nom | Description |
| --- | --- |
| `PORT` | Port HTTP (Render fournit via variable d'env). |
| `MONGO_URI` | URI MongoDB Atlas. |
| `PAYHIP_API_BASE_URL` | Racine de l'API Payhip (ex: `https://payhip.com/api/v2`). |
| `PAYHIP_API_KEY` | Jeton d'API Payhip. |
| `PAYHIP_PRODUCT_ID` | Identifiant du produit Payhip qui émet les clés. |
| `BUNNY_PULL_ZONE_HOST` | Hostname Bunny (sans protocole). |
| `BUNNY_SIGNING_KEY` | Clé secrète pour signer les liens. |
| `BUNNY_LIBRARY_ID` | (Optionnel) ID de la librairie Bunny pour l'import automatique. |
| `BUNNY_API_KEY` | (Optionnel) AccessKey Bunny Video API (utilisé par le seeder). |
| `DEFAULT_RENTAL_HOURS` | Durée par défaut d'une location (heures). |
| `ADMIN_PASSWORD` | Mot de passe admin (utilisé pour les routes admin). |

### Import massif depuis Bunny

1. Renseignez `BUNNY_LIBRARY_ID` et `BUNNY_API_KEY` (Access Key de la Video Library) dans `.env`.
2. Assurez-vous que MongoDB est accessible (`MONGO_URI`).
3. Lancez `npm run seed:movies` :

```bash
cd backend
npm run seed:movies
```

Le script interroge l'API Bunny Video, récupère l'ensemble des vidéos de la librairie puis les upsert dans la collection `movies` (création ou mise à jour). Les champs `videoPath` et `previewUrl` sont remplis automatiquement à partir des URLs Bunny.

## Endpoints clés
Base path : `/api`

### Films
- `GET /movies` – liste complète.
- `GET /movies/:id` – détail.
- `POST /movies` – création (titre, slug, infos Bunny, durée location).

### Locations
- `POST /rentals` – crée une location après validation Payhip et renvoie un lien signé Bunny.
- `GET /rentals/:id` – récupère la location, rafraîchit le lien si encore valide.

### Payhip
- `POST /payhip/validate` – vérifie un code Payhip sans créer de location (utile côté front).

## Flow type pour une location
1. Le front appelle `POST /rentals` avec `{ movieId, customerEmail, payhipCode }`.
2. Le backend :
   - vérifie le film + durée,
   - appelle l'API Payhip pour le code,
   - empêche les doublons actifs,
   - crée la location + TTL,
   - génère un lien signé Bunny (TTL max 1h) et le stocke.
3. La réponse contient `{ rental, signedUrl }`.
4. Pour renouveler le lien avant expiration : `GET /rentals/:id`.

## Tests / Postman
- Endpoint `GET /health` pour vérifier que le service tourne.
- Les schémas Zod renvoient des erreurs explicites en cas de payload invalide.

## Prochaines étapes suggérées
- Ajouter l’authentification et la gestion des rôles.
- Brancher un job de nettoyage/logs pour les locations expirées.
- Couvrir les services critiques avec des tests unitaires.
