import { Router } from 'express';
import {
  listUsersHandler,
  createUserHandler,
  updateUserRoleHandler,
  deleteUserHandler,
  revokeUserSessionsHandler,
} from '../controllers/userController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get(
  '/users',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(listUsersHandler),
);

router.post(
  '/users',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(createUserHandler),
);

router.patch(
  '/users/:id/role',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(updateUserRoleHandler),
);

router.delete(
  '/users/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(deleteUserHandler),
);

router.post(
  '/users/:id/revoke-sessions',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(revokeUserSessionsHandler),
);

export default router;
