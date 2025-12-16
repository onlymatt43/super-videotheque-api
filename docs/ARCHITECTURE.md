# SUPER-VIDEOTHEQUE Backend Plan

## Tech Stack
- Node.js 18 + Express 4
- TypeScript with ts-node-dev for DX, compiled output via tsc
- MongoDB via Mongoose for movies and rentals collections
- REST API layered with controllers, services, and routes
- Zod for request validation
- Axios for outbound HTTP calls (Payhip)
- crypto for Bunny.net signed URL generation

## High-Level Responsibilities
1. **Movies API**: CRUD endpoints to register movies (with Bunny video metadata) and list catalog.
2. **Payhip Validation**: Secure service calling Payhip API using merchant API key to validate purchase/rental codes.
3. **Rentals Service**: Creates single-use rentals mapped to customers (email) + movie, enforcing uniqueness and expiration.
4. **Bunny.net Integration**: Generates short-lived signed links using pull zone hostname + signing key for streaming access.
5. **Config & Observability**: Centralized configuration, error handling middleware, structured logging, graceful shutdown.

## Directory Layout
```
backend/
  src/
    app.ts                 # Express app + middleware wiring
    server.ts              # Entry point + Mongo connection
    config/
      env.ts               # Env parsing and validation
      logger.ts            # Pino logger setup
    models/
      movie.model.ts
      rental.model.ts
    controllers/
      movie.controller.ts
      rental.controller.ts
      payhip.controller.ts
    routes/
      movie.routes.ts
      rental.routes.ts
      payhip.routes.ts
      index.ts
    services/
      movie.service.ts
      rental.service.ts
      payhip.service.ts
      bunny.service.ts
    middlewares/
      error.middleware.ts
      notFound.middleware.ts
      validateRequest.ts
    validations/
      movie.schema.ts
      rental.schema.ts
      payhip.schema.ts
    utils/
      date.ts              # helpers for expirations
  package.json
  tsconfig.json
  .env.sample
  README.md
```

## Data Models
### Movie
- `title`, `slug`, `description`, `thumbnailUrl`
- `bunnyLibraryId`, `bunnyVideoId`, `videoPath`
- `rentalDurationHours`

### Rental
- `movie` (ref)
- `customerEmail`
- `payhipCode`
- `status` (active, expired)
- `expiresAt`
- `lastSignedUrl` (optional)
- `createdAt`, `updatedAt`

### Payhip Validation Flow
1. Client submits Payhip code when requesting rental.
2. Backend hits Payhip API `GET https://payhip.com/api/v2/vouchers/{code}` with `Authorization: Bearer <PAYHIP_API_KEY>`.
3. Response validated + cached (future enhancement). Failure -> 400.

### Rental Flow
1. Validate body (movieId, email, payhipCode).
2. Ensure movie exists.
3. Validate Payhip code (service call).
4. Check for existing active rental for same movie+email.
5. Create rental with `expiresAt = now + movie.rentalDurationHours`.
6. Generate signed Bunny URL with TTL <= remaining rental time.
7. Return rental info + signed link.

### Bunny.net Signed Link
```
expires = Math.floor(Date.now() / 1000) + ttlSeconds
path = `/${videoPath}`
token = base64url(HMAC_SHA256(path + expires, BUNNY_SIGNING_KEY))
link = `https://${BUNNY_PULL_ZONE_HOST}${path}?token=${token}&expires=${expires}`
```

## Environment Variables
- `PORT`
- `MONGO_URI`
- `PAYHIP_API_BASE_URL`
- `PAYHIP_API_KEY`
- `BUNNY_PULL_ZONE_HOST`
- `BUNNY_SIGNING_KEY`
- `DEFAULT_RENTAL_HOURS`

## Testing & Tooling
- Scripts: `dev`, `build`, `start`, `lint` (future), `test` placeholder.
- Use ESLint/Prettier later if needed.

This document drives the scaffolding that follows.
