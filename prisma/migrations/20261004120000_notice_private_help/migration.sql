-- Existing public posts and replies remain public notice-board content.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "helperAssignedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "helperAssignedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Modern accounts with studyYear were created by the preceding OTP signup flow.
-- Legacy accounts with unknown verification history remain unverified.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "studyYear" BETWEEN 1 AND 6;
-- Previous self-selected Helper status is not an Admin appointment.
UPDATE "User" SET "role" = 'POSTER' WHERE "role" = 'HELPER';

CREATE TABLE "HelpRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'Academics',
  "collegeId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "HelpRequest_collegeId_createdAt_id_idx" ON "HelpRequest"("collegeId", "createdAt", "id");
CREATE INDEX "HelpRequest_authorId_collegeId_createdAt_idx" ON "HelpRequest"("authorId", "collegeId", "createdAt");
CREATE TABLE "HelpReply" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "collegeId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL REFERENCES "HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "HelpReply_requestId_collegeId_createdAt_id_idx" ON "HelpReply"("requestId", "collegeId", "createdAt", "id");
CREATE INDEX "HelpReply_authorId_collegeId_idx" ON "HelpReply"("authorId", "collegeId");
CREATE TABLE "DailyQuota" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "collegeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('NOTICE_BOARD', 'HELP_REQUEST')),
  "day" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "collegeId", "kind", "day")
);
CREATE TABLE "RoleAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "targetId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "collegeId" TEXT NOT NULL,
  "oldRole" TEXT NOT NULL,
  "newRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RoleAudit_collegeId_createdAt_id_idx" ON "RoleAudit"("collegeId", "createdAt", "id");
CREATE TABLE "AdminInvite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "collegeId" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "delivered" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdminInvite_email_key" ON "AdminInvite"("email");
CREATE UNIQUE INDEX "AdminInvite_digest_key" ON "AdminInvite"("digest");
