import { Router } from 'express';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';
import { createLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = Router();

router.get('/', listCategories);
router.post('/', requireAdmin, createLimiter, createCategory);
router.patch('/:slug', requireAdmin, updateCategory);
router.delete('/:slug', requireAdmin, deleteCategory);

export { router as categoryRouter };
