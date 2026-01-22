import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function queryTable() {
  try {
    // Get schema
    const schema = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='article_ideas'");
    console.log('=== Table Schema ===');
    console.log(schema.rows[0]?.sql || 'Table not found');
    console.log('');
    
    // Get sample data
    const data = await client.execute("SELECT * FROM article_ideas LIMIT 5");
    console.log('=== Sample Data (first 5 rows) ===');
    console.log(JSON.stringify(data.rows, null, 2));
    console.log('');
    
    // Get row count
    const count = await client.execute("SELECT COUNT(*) as count FROM article_ideas");
    console.log('=== Row Count ===');
    console.log(`Total rows: ${count.rows[0]?.count}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryTable();
