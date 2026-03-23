import { Pool } from "pg";

declare global {
  var __engagementDbPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL belum diset. Tambahkan koneksi PostgreSQL di file .env.local terlebih dahulu."
    );
  }

  const sslEnabled = process.env.PGSSL?.trim() === "true";

  return new Pool({
    connectionString,
    ssl: sslEnabled
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });
}

export function getDbPool() {
  if (!globalThis.__engagementDbPool) {
    globalThis.__engagementDbPool = createPool();
  }

  return globalThis.__engagementDbPool;
}
