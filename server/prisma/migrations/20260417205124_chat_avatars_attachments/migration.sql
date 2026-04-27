-- AlterTable
ALTER TABLE "doc_versions" ADD COLUMN "changes" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "project_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_attachments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
