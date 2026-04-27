-- AlterTable
ALTER TABLE "projects" ADD COLUMN "referenceContextMaterial" TEXT NOT NULL DEFAULT '';
ALTER TABLE "projects" ADD COLUMN "referenceContextLength" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN "driveContextFolderId" TEXT;
ALTER TABLE "projects" ADD COLUMN "driveContextFolderName" TEXT;
ALTER TABLE "projects" ADD COLUMN "localContextFolderLabel" TEXT;
ALTER TABLE "projects" ADD COLUMN "referenceContextSyncedAt" DATETIME;
