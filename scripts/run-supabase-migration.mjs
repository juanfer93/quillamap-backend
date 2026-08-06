import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error('Usage: node scripts/run-supabase-migration.mjs <migration.sql>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to run a migration.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const absolutePath = resolve(migrationPath);
const sql = readFileSync(absolutePath, 'utf8');

try {
  await client.connect();
  await client.query('begin');
  await client.query(sql);
  await client.query('commit');
  console.log(`Migration applied: ${absolutePath}`);
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
