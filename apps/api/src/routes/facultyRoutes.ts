import { Router } from 'express';
import { getFacultyLeaderboardHandler } from '../controllers/facultyController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/faculty/leaderboard', asyncHandler(getFacultyLeaderboardHandler));

export default router;

