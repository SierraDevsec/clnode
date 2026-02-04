import { Database } from "duckdb-async";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  "../../data"
);

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = path.join(DATA_DIR, "clnode.duckdb");
  db = await Database.create(dbPath);
  await initSchema(db);
  return db;
}

async function initSchema(db: Database): Promise<void> {
  await db.exec(`
    CREATE SEQUENCE IF NOT EXISTS context_entries_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS file_changes_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS tasks_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS activity_log_seq START 1;
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id         VARCHAR PRIMARY KEY,
      name       VARCHAR NOT NULL,
      path       VARCHAR NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         VARCHAR PRIMARY KEY,
      project_id VARCHAR,
      started_at TIMESTAMP DEFAULT now(),
      ended_at   TIMESTAMP,
      status     VARCHAR DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS agents (
      id              VARCHAR PRIMARY KEY,
      session_id      VARCHAR,
      agent_name      VARCHAR NOT NULL,
      agent_type      VARCHAR,
      parent_agent_id VARCHAR,
      status          VARCHAR DEFAULT 'active',
      started_at      TIMESTAMP DEFAULT now(),
      completed_at    TIMESTAMP,
      context_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS context_entries (
      id         INTEGER PRIMARY KEY DEFAULT nextval('context_entries_seq'),
      session_id VARCHAR,
      agent_id   VARCHAR,
      entry_type VARCHAR NOT NULL,
      content    TEXT NOT NULL,
      tags       VARCHAR[],
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS file_changes (
      id          INTEGER PRIMARY KEY DEFAULT nextval('file_changes_seq'),
      session_id  VARCHAR,
      agent_id    VARCHAR,
      file_path   VARCHAR NOT NULL,
      change_type VARCHAR NOT NULL,
      created_at  TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY DEFAULT nextval('tasks_seq'),
      project_id  VARCHAR,
      title       VARCHAR NOT NULL,
      description TEXT,
      status      VARCHAR DEFAULT 'pending',
      assigned_to VARCHAR,
      created_at  TIMESTAMP DEFAULT now(),
      updated_at  TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY DEFAULT nextval('activity_log_seq'),
      session_id VARCHAR,
      agent_id   VARCHAR,
      event_type VARCHAR NOT NULL,
      details    JSON,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
