import { Router } from 'express';
import { validateCode } from '../controllers/payhip.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { payhipValidationSchema } from '../validations/payhip.schema.js';

const router = Router();

router.post('/validate', validateRequest(payhipValidationSchema), validateCode);

export { router as payhipRouter };
