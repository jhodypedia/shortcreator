CREATE TABLE "AiVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "seriesId" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiVersion_seriesId_entity_entityId_createdAt_idx" ON "AiVersion"("seriesId", "entity", "entityId", "createdAt");
