// src/lib/db.ts throws at import time without DATABASE_URL. Unit tests never
// open a connection (PrismaPg only connects lazily), so a placeholder is enough
// for modules that transitively import the Prisma client.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
