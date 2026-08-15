import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RowDataPacket } from "mysql2";
import mysql, { type Pool } from "mysql2/promise";

export async function createPoolFromEnv(): Promise<Pool | undefined> {
  const databaseUrl = process.env.MYSQL_URL;
  if (!databaseUrl) {
    return undefined;
  }

  const pool = mysql.createPool(databaseUrl);
  await runMigrations(pool);
  return pool;
}

async function runMigrations(pool: Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const currentFile = fileURLToPath(import.meta.url);
  const migrationsDir = join(dirname(currentFile), "../../../../packages/db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT version FROM schema_migrations WHERE version = ? LIMIT 1",
      [file]
    );

    const typedRows = rows as Array<{ version: string }>;
    if (typedRows.length > 0) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const statement of statements) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
