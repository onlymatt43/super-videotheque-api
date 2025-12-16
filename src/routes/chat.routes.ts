import { Router } from 'express';
import { chat } from '../controllers/chat.controller.js';
import { chatLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = Router();

router.post('/', chatLimiter, chat);

export default router;
