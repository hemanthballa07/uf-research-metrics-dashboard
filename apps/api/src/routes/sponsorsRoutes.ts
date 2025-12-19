import { Router } from 'express';
import { getSponsorsHandler } from '../controllers/sponsorsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/sponsors', asyncHandler(getSponsorsHandler));

export default router;

