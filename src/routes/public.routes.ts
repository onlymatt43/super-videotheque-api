import { Router } from 'express';
import { listPublicPreviews } from '../controllers/publicLibrary.controller.js';

const router = Router();

// GET /api/public/previews - Liste des previews gratuits depuis Bunny public
router.get('/previews', listPublicPreviews);

export { router as publicRouter };
