CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "role" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'running',
  "error" TEXT,
  "input" JSONB NOT NULL,
  "output" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiRun_role_createdAt_idx" ON "AiRun"("role", "createdAt");
