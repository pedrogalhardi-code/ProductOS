import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addProjectAttachments,
  deleteProjectAttachment,
} from '../controllers/projectController';
import { projectAttachmentsUpload } from '../middleware/upload';

const router = Router();

router.get('/', listProjects);
router.get('/:id', getProject);
router.post('/', projectAttachmentsUpload, createProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);

// Attachment management on an existing project
router.post('/:id/attachments', projectAttachmentsUpload, addProjectAttachments);
router.delete('/:id/attachments/:attachmentId', deleteProjectAttachment);

export default router;
