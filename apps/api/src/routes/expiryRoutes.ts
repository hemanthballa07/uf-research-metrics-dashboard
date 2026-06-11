import { Router } from 'express';
import { getExpiringGrantsHandler } from '../controllers/expiryController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/grants/expiring', asyncHandler(getExpiringGrantsHandler));

export default router;
