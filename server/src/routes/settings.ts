import { Router } from 'express';
import { getSettings, updateSettings, getAIUsage } from '../controllers/settingsController';

const router = Router();

router.get('/', getSettings);
router.patch('/', updateSettings);
router.get('/ai-usage', getAIUsage);

export default router;
