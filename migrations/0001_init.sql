-- Better Auth core tables (email + password only).
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- Site content: two JSON documents, 'draft' (what the editor autosaves) and
-- 'published' (what the live site serves). Publishing copies one to the other.
CREATE TABLE IF NOT EXISTS "documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "data" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TEXT NOT NULL,
  "updatedBy" TEXT
);

-- Messages sent through Contact blocks on the live site.
CREATE TABLE IF NOT EXISTS "submissions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "page" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "message" TEXT,
  "createdAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "submissions_createdAt_idx" ON "submissions" ("createdAt");

-- Small key/value store (e.g. the auth secret when none is configured).
CREATE TABLE IF NOT EXISTS "settings" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL
);
