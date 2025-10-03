#!/usr/bin/env node
const { createClient } = require("@libsql/client");
const fs = require("fs");
require("dotenv").config();

async function runMigration() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const migration = fs.readFileSync("./migrations/create_article_likes.sql", "utf8");
    
    // Remove comments, split by semicolon
    const cleanedMigration = migration
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanedMigration
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Running ${statements.length} migration statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.replace(/\n/g, " ").replace(/\s+/g, " ").substring(0, 80);
      console.log(`[${i+1}/${statements.length}] ${preview}...`);
      await client.execute(statement);
      console.log(`✓ Success\n`);
    }

    console.log("✅ Migration completed successfully!");

    // Verify table exists
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='article_likes'"
    );
    console.log("✅ Table verification:", result.rows.length > 0 ? "article_likes table exists" : "ERROR: Table not found");

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();
