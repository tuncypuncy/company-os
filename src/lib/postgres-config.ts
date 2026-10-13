import type { PoolConfig } from "pg";
export function postgresConfig(
  connectionString: string,
  ca?: string,
): PoolConfig {
  const trustedCa = ca ?? process.env.DATABASE_CA_CERT?.trim();
  const connection = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(connection.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  for (const key of [...connection.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("ssl") || key === "options")
      connection.searchParams.delete(key);
  }
  return {
    connectionString: connection.toString(),
    max: 5,
    connectionTimeoutMillis: 15000,
    options: "-c search_path=company_os,public",
    ssl: { ...(trustedCa ? { ca: trustedCa } : {}), rejectUnauthorized: true },
  };
}
