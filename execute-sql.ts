import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hrms_user:hrms_password@localhost:5432/hrms',
});

async function executeSql() {
  const client = await pool.connect();

  try {
    const sqlFile = path.join(__dirname, 'create-all-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('Executing SQL script...\n');
    await client.query(sql);
    console.log('✅ All tables created successfully!');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

executeSql().catch((error) => {
  process.exit(1);
});
