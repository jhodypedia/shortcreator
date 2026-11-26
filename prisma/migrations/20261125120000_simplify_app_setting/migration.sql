-- Rebuild AppSetting with the key/value shape used by the admin setup flow.
CREATE TABLE "new_AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

INSERT INTO "new_AppSetting" ("key", "value")
SELECT "key", "value" FROM "AppSetting";

DROP TABLE "AppSetting";
ALTER TABLE "new_AppSetting" RENAME TO "AppSetting";
