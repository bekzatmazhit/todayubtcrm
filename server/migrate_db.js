import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log("Starting DB Migration for ON DELETE CASCADE and composite indexes...");

try {
  // 1. Disable foreign keys enforcement for migration
  db.pragma('foreign_keys = OFF');

  // 2. Start transaction
  db.exec('BEGIN TRANSACTION;');

  // Define the tables and their new schemas with ON DELETE CASCADE
  const tablesToMigrate = {
    attendance: `
      CREATE TABLE attendance_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        lesson_id  INTEGER NOT NULL,
        status     TEXT DEFAULT 'present',
        lateness   TEXT DEFAULT 'on_time',
        homework   TEXT DEFAULT 'done',
        comment    TEXT,
        created_at TEXT DEFAULT (datetime('now')), 
        group_id   INTEGER,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(lesson_id)  REFERENCES lessons(id) ON DELETE CASCADE,
        UNIQUE(student_id, lesson_id)
      );
    `,
    ent_results: `
      CREATE TABLE ent_results_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        score      INTEGER NOT NULL DEFAULT 0,
        month      TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')), 
        group_id   INTEGER,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE(student_id, subject_id, month)
      );
    `,
    parent_feedback: `
      CREATE TABLE parent_feedback_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        curator_id INTEGER NOT NULL,
        date       TEXT NOT NULL,
        notes      TEXT,
        status     TEXT DEFAULT 'needs_callback',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(curator_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `,
    curator_call_tasks: `
      CREATE TABLE curator_call_tasks_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        curator_id   INTEGER NOT NULL,
        student_id   INTEGER NOT NULL,
        month        TEXT NOT NULL,
        status       TEXT DEFAULT 'pending',
        call_result  TEXT,
        notes        TEXT,
        completed_at TEXT,
        created_at   TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(curator_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE(curator_id, student_id, month)
      );
    `,
    teacher_student_feedback: `
      CREATE TABLE teacher_student_feedback_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        subject_id INTEGER,
        month      TEXT NOT NULL,
        comment    TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE(teacher_id, student_id, subject_id, month)
      );
    `,
    schedule_students: `
      CREATE TABLE schedule_students_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL,
        student_id  INTEGER NOT NULL,
        FOREIGN KEY(schedule_id) REFERENCES schedule(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id)  REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE(schedule_id, student_id)
      );
    `,
    quiz_results: `
      CREATE TABLE quiz_results_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id    INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        score      REAL,
        FOREIGN KEY(quiz_id)    REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE(quiz_id, student_id)
      );
    `,
    student_monthly_reports: `
      CREATE TABLE student_monthly_reports_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        teacher_summary TEXT, 
        stats_json TEXT,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE(student_id, month)
      );
    `
  };

  for (const [tableName, createSql] of Object.entries(tablesToMigrate)) {
    console.log(`Migrating table: ${tableName}`);
    // Create new table
    db.exec(createSql);
    // Copy data
    db.exec(`INSERT INTO ${tableName}_new SELECT * FROM ${tableName};`);
    // Drop old table
    db.exec(`DROP TABLE ${tableName};`);
    // Rename new table to original name
    db.exec(`ALTER TABLE ${tableName}_new RENAME TO ${tableName};`);
  }

  // 3. Create missing composite indexes
  console.log("Creating composite indexes...");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ent_student_month ON ent_results(student_id, month);
    CREATE INDEX IF NOT EXISTS idx_lessons_schedule_date ON lessons(schedule_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_lesson ON attendance(student_id, lesson_id);
  `);

  // 4. Commit transaction
  db.exec('COMMIT;');
  
  // 5. Re-enable foreign keys
  db.pragma('foreign_keys = ON');

  console.log("Migration completed successfully! 🎉");

} catch (error) {
  console.error("Migration failed, rolling back...", error);
  try {
    db.exec('ROLLBACK;');
  } catch (rollbackError) {
    console.error("Rollback failed!", rollbackError);
  }
  process.exit(1);
}
