import { Router } from 'express';
import { register, login, me, updateProfile } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, me);
router.patch('/profile', authMiddleware, updateProfile);

export default router;
