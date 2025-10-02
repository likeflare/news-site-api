import { createClient, type Client } from "@libsql/client";

let cachedClient: Client | null = null;

export function getDatabaseClient(): Client {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing database credentials. Check environment variables.");
  }

  cachedClient = createClient({
    url,
    authToken,
  });

  return cachedClient;
}

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = getDatabaseClient();
    await client.execute("SELECT 1");
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}
