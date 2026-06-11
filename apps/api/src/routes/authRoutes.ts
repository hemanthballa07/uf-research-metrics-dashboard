import { Router } from 'express';
import { loginHandler, meHandler, logoutHandler, changePasswordHandler } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/auth/login', asyncHandler(loginHandler));
router.post('/auth/logout', authenticate, asyncHandler(logoutHandler));
router.get('/auth/me', authenticate, asyncHandler(meHandler));
router.patch('/auth/change-password', authenticate, asyncHandler(changePasswordHandler));

export default router;
