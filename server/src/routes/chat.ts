import { Router } from 'express';
import { chatStream, chatExtract } from '../controllers/chatController';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { analyzeUpload } from '../middleware/upload';

const router = Router();

router.post('/stream', aiRateLimiter, chatStream);
router.post('/extract', analyzeUpload, chatExtract);

export default router;
