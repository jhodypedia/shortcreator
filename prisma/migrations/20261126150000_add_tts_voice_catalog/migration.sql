CREATE TABLE "TtsVoiceCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "age" TEXT,
    "language" TEXT,
    "accent" TEXT,
    "description" TEXT,
    "previewUrl" TEXT,
    "metadata" JSONB,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "TtsVoiceCatalog_provider_language_idx" ON "TtsVoiceCatalog"("provider", "language");
