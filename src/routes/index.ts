import { Router } from 'express';
import { movieRouter } from './movie.routes.js';
import { rentalRouter } from './rental.routes.js';
import { payhipRouter } from './payhip.routes.js';
import { publicRouter } from './public.routes.js';
import chatRouter from './chat.routes.js';
import { categoryRouter } from './category.routes.js';

const router = Router();

router.use('/movies', movieRouter);
router.use('/rentals', rentalRouter);
router.use('/payhip', payhipRouter);
router.use('/public', publicRouter);
router.use('/chat', chatRouter);
router.use('/categories', categoryRouter);

export { router as apiRouter };
