-- Preserve all existing accounts and posts; legacy study years remain unknown.
ALTER TABLE "User" ADD COLUMN "collegeId" TEXT NOT NULL DEFAULT 'centurion';
ALTER TABLE "User" ADD COLUMN "studyYear" INTEGER CHECK ("studyYear" IS NULL OR "studyYear" BETWEEN 1 AND 6);
ALTER TABLE "Post" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Academics';
ALTER TABLE "Post" ADD COLUMN "collegeId" TEXT NOT NULL DEFAULT 'centurion';
CREATE INDEX "User_collegeId_idx" ON "User"("collegeId");
CREATE INDEX "Post_collegeId_createdAt_idx" ON "Post"("collegeId", "createdAt");

CREATE TABLE "Reply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Reply_postId_collegeId_createdAt_idx" ON "Reply"("postId", "collegeId", "createdAt");

-- Invalidate only outstanding legacy plaintext verification codes. No account/post data is dropped.
DROP TABLE "Otp";
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Otp_email_key" ON "Otp"("email");
CREATE INDEX "Otp_expiresAt_idx" ON "Otp"("expiresAt");

CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "expiresAt" BIGINT NOT NULL
);
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
