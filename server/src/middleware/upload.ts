import multer from 'multer';

const MB = 1024 * 1024;

/** Multer middleware for single-file uploads used by /api/documents/analyze */
export const analyzeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * MB },
}).single('file');

/** Multer middleware for multi-file project attachments */
export const projectAttachmentsUpload = multer({
  storage: multer.memoryStorage(),
  // Keep per-file size capped; allow a generous file count so users can attach
  // several PDFs. `parts` is bumped too — multer counts both file and text
  // form fields against the `parts` limit.
  limits: {
    fileSize: 10 * MB,
    files: 50,
    parts: 100,
    fields: 20,
  },
}).array('attachments');
