import { Router } from 'express';
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  generateDocument,
  reviewDocument,
  getVersions,
  restoreVersion,
  addComment,
  getComments,
  updateComment,
  analyzeDocument,
} from '../controllers/documentController';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { exportController } from '../controllers/exportController';
import { analyzeUpload } from '../middleware/upload';

const router = Router();

// Document CRUD
router.get('/', listDocuments);
router.post('/', createDocument);
router.get('/:id', getDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', deleteDocument);

// AI generation, review, and document analysis (rate limited)
router.post('/generate', aiRateLimiter, generateDocument);
router.post('/:id/review', aiRateLimiter, reviewDocument);
router.post('/analyze', aiRateLimiter, analyzeUpload, analyzeDocument);

// Versioning
router.get('/:id/versions', getVersions);
router.post('/:id/versions/:versionId/restore', restoreVersion);

// Export
router.post('/:id/export', exportController);

// Comments
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.patch('/comments/:commentId', updateComment);

export default router;
