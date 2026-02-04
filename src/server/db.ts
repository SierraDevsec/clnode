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
  // 시퀀스 먼저 생성
  await db.exec(`
    CREATE SEQUENCE IF NOT EXISTS tool_uses_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS activities_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS contexts_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS events_seq START 1;
  `);

  await db.exec(`
    -- 세션 테이블: Claude Code 세션 단위
    CREATE TABLE IF NOT EXISTS sessions (
      session_id     VARCHAR PRIMARY KEY,
      project_path   VARCHAR,
      started_at     TIMESTAMP DEFAULT current_timestamp,
      ended_at       TIMESTAMP,
      status         VARCHAR DEFAULT 'active'
    );

    -- 에이전트 테이블: 세션 내 서브에이전트
    CREATE TABLE IF NOT EXISTS agents (
      agent_id       VARCHAR PRIMARY KEY,
      session_id     VARCHAR NOT NULL,
      parent_agent_id VARCHAR,
      agent_type     VARCHAR,
      model          VARCHAR,
      started_at     TIMESTAMP DEFAULT current_timestamp,
      ended_at       TIMESTAMP,
      status         VARCHAR DEFAULT 'active'
    );

    -- 태스크 테이블: 에이전트가 수행하는 작업
    CREATE TABLE IF NOT EXISTS tasks (
      task_id        VARCHAR PRIMARY KEY,
      agent_id       VARCHAR NOT NULL,
      session_id     VARCHAR NOT NULL,
      description    VARCHAR,
      status         VARCHAR DEFAULT 'pending',
      created_at     TIMESTAMP DEFAULT current_timestamp,
      updated_at     TIMESTAMP DEFAULT current_timestamp
    );

    -- 도구 사용 기록
    CREATE TABLE IF NOT EXISTS tool_uses (
      id             INTEGER PRIMARY KEY DEFAULT nextval('tool_uses_seq'),
      session_id     VARCHAR NOT NULL,
      agent_id       VARCHAR,
      tool_name      VARCHAR NOT NULL,
      tool_input     VARCHAR,
      tool_output    VARCHAR,
      used_at        TIMESTAMP DEFAULT current_timestamp
    );

    -- 활동 로그
    CREATE TABLE IF NOT EXISTS activities (
      id             INTEGER PRIMARY KEY DEFAULT nextval('activities_seq'),
      session_id     VARCHAR NOT NULL,
      agent_id       VARCHAR,
      event_type     VARCHAR NOT NULL,
      summary        VARCHAR,
      created_at     TIMESTAMP DEFAULT current_timestamp
    );

    -- 컨텍스트 저장소
    CREATE TABLE IF NOT EXISTS contexts (
      id             INTEGER PRIMARY KEY DEFAULT nextval('contexts_seq'),
      session_id     VARCHAR NOT NULL,
      agent_id       VARCHAR,
      key            VARCHAR NOT NULL,
      value          VARCHAR,
      created_at     TIMESTAMP DEFAULT current_timestamp
    );

    -- 원시 이벤트 로그
    CREATE TABLE IF NOT EXISTS events (
      id             INTEGER PRIMARY KEY DEFAULT nextval('events_seq'),
      session_id     VARCHAR,
      event_type     VARCHAR NOT NULL,
      payload        VARCHAR,
      received_at    TIMESTAMP DEFAULT current_timestamp
    );
  `);
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
