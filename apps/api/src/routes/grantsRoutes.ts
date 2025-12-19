import { Router } from 'express';
import { getGrantsHandler } from '../controllers/grantsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/grants', asyncHandler(getGrantsHandler));

export default router;

