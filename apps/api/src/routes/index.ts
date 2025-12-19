import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import grantsRoutes from './grantsRoutes.js';

const router = Router();

router.use('/api', healthRoutes);
router.use('/api', grantsRoutes);

export default router;

