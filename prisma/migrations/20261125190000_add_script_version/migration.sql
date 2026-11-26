-- Script beats remain stored as JSON. This additive version marker lets the
-- application recognize the extended beat schema without rewriting old data.
ALTER TABLE "Episode" ADD COLUMN "scriptVersion" INTEGER NOT NULL DEFAULT 2;
