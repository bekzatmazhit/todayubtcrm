import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "database.sqlite");

function toLatin(str) {
  const map = {
    "\u0430": "a", "\u0431": "b", "\u0432": "v", "\u0433": "g", "\u0434": "d", "\u0435": "e", "\u0451": "e",
    "\u0436": "zh", "\u0437": "z", "\u0438": "i", "\u0439": "i", "\u043a": "k", "\u043b": "l", "\u043c": "m",
    "\u043d": "n", "\u043e": "o", "\u043f": "p", "\u0440": "r", "\u0441": "s", "\u0442": "t", "\u0443": "u",
    "\u0444": "f", "\u0445": "h", "\u0446": "ts", "\u0447": "ch", "\u0448": "sh", "\u0449": "sh", "\u044a": "",
    "\u044b": "y", "\u044c": "", "\u044d": "e", "\u044e": "yu", "\u044f": "ya",
    "\u0410": "A", "\u0411": "B", "\u0412": "V", "\u0413": "G", "\u0414": "D", "\u0415": "E", "\u0401": "E",
    "\u0416": "Zh", "\u0417": "Z", "\u0418": "I", "\u0419": "I", "\u041a": "K", "\u041b": "L", "\u041c": "M",
    "\u041d": "N", "\u041e": "O", "\u041f": "P", "\u0420": "R", "\u0421": "S", "\u0422": "T", "\u0423": "U",
    "\u0424": "F", "\u0425": "H", "\u0426": "Ts", "\u0427": "Ch", "\u0428": "Sh", "\u0429": "Sh", "\u042a": "",
    "\u042b": "Y", "\u042c": "", "\u042d": "E", "\u042e": "Yu", "\u042f": "Ya",
    " ": "", "\u2019": "", "'": "", "\"": "", ".": "", ",": "", "-": "", "_": "",
    "\u04b1": "u", "\u04b0": "U", "\u04af": "u", "\u04ae": "U", "\u049b": "k", "\u049a": "K",
    "\u0493": "g", "\u0492": "G", "\u04a3": "n", "\u04a2": "N", "\u04d9": "a", "\u04d8": "A",
    "\u0456": "i", "\u0406": "I", "\u04e9": "o", "\u04e8": "O", "\u04bb": "h", "\u04ba": "H"
  };
  return str.split("").map(c => map[c] !== undefined ? map[c] : c).join("");
}

export const db = new Database(dbPath);

export function initializeDatabase() {
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id   INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY,
      name     TEXT NOT NULL,
      surname  TEXT NOT NULL,
      phone    TEXT,
      email    TEXT UNIQUE,
      password TEXT,
      role_id  INTEGER NOT NULL,
      FOREIGN KEY(role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id   INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'mandatory'
    );

    CREATE TABLE IF NOT EXISTS groups (
      id         INTEGER PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      profile_id INTEGER,
      curator_id INTEGER,
      FOREIGN KEY(profile_id) REFERENCES profiles(id),
      FOREIGN KEY(curator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT UNIQUE NOT NULL,
      capacity INTEGER DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS time_slots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time   TEXT NOT NULL,
      label      TEXT,
      UNIQUE(start_time, end_time)
    );

    CREATE TABLE IF NOT EXISTS schedule (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id     INTEGER,
      subject_id   INTEGER NOT NULL,
      teacher_id   INTEGER NOT NULL,
      room_id      INTEGER NOT NULL,
      time_slot_id INTEGER NOT NULL,
      cycle        TEXT NOT NULL DEFAULT 'PSP',
      custom_label TEXT,
      FOREIGN KEY(group_id)     REFERENCES groups(id),
      FOREIGN KEY(subject_id)   REFERENCES subjects(id),
      FOREIGN KEY(teacher_id)   REFERENCES users(id),
      FOREIGN KEY(room_id)      REFERENCES rooms(id),
      FOREIGN KEY(time_slot_id) REFERENCES time_slots(id)
    );

    CREATE TABLE IF NOT EXISTS schedule_students (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      student_id  INTEGER NOT NULL,
      FOREIGN KEY(schedule_id) REFERENCES schedule(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id)  REFERENCES students(id),
      UNIQUE(schedule_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id           INTEGER PRIMARY KEY,
      full_name    TEXT NOT NULL,
      phone        TEXT,
      parent_phone TEXT,
      parent_name  TEXT,
      group_id     INTEGER,
      status       TEXT DEFAULT 'active',
      avatar_url   TEXT,
      FOREIGN KEY(group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      date        TEXT NOT NULL,
      FOREIGN KEY(schedule_id) REFERENCES schedule(id) ON DELETE CASCADE,
      UNIQUE(schedule_id, date)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      lesson_id  INTEGER NOT NULL,
      status     TEXT DEFAULT 'present',
      lateness   TEXT DEFAULT 'on_time',
      homework   TEXT DEFAULT 'done',
      comment    TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(lesson_id)  REFERENCES lessons(id),
      UNIQUE(student_id, lesson_id)
    );

    INSERT OR IGNORE INTO subjects (id, name, type) VALUES (8, 'Грамотность чтения', 'mandatory');

    CREATE TABLE IF NOT EXISTS ent_results (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      score      INTEGER NOT NULL DEFAULT 0,
      month      TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(subject_id) REFERENCES subjects(id),
      UNIQUE(student_id, subject_id, month)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      date        TEXT NOT NULL,
      time_slot   TEXT,
      title       TEXT NOT NULL,
      description TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS curatorship_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      curator_id  INTEGER NOT NULL,
      group_id    INTEGER NOT NULL,
      date        TEXT NOT NULL,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(curator_id) REFERENCES users(id),
      FOREIGN KEY(group_id)   REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT DEFAULT 'todo',
      priority    TEXT DEFAULT 'medium',
      assignee_id INTEGER,
      created_by  INTEGER,
      due_date    TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(assignee_id) REFERENCES users(id),
      FOREIGN KEY(created_by)  REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id       INTEGER NOT NULL,
      filename      TEXT NOT NULL,
      original_name TEXT NOT NULL,
      path          TEXT NOT NULL,
      size          INTEGER,
      uploaded_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parent_feedback (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      curator_id INTEGER NOT NULL,
      date       TEXT NOT NULL,
      notes      TEXT,
      status     TEXT DEFAULT 'needs_callback',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(curator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_assignees (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS curator_call_tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      curator_id   INTEGER NOT NULL,
      student_id   INTEGER NOT NULL,
      month        TEXT NOT NULL,
      status       TEXT DEFAULT 'pending',
      call_result  TEXT,
      notes        TEXT,
      completed_at TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(curator_id) REFERENCES users(id),
      FOREIGN KEY(student_id) REFERENCES students(id),
      UNIQUE(curator_id, student_id, month)
    );

    CREATE TABLE IF NOT EXISTS teacher_student_feedback (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject_id INTEGER,
      month      TEXT NOT NULL,
      comment    TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(teacher_id) REFERENCES users(id),
      FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(subject_id) REFERENCES subjects(id),
      UNIQUE(teacher_id, student_id, subject_id, month)
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id    INTEGER NOT NULL,
      user_id    INTEGER NOT NULL,
      text       TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      type       TEXT NOT NULL DEFAULT 'system',
      title      TEXT NOT NULL,
      message    TEXT,
      is_read    INTEGER NOT NULL DEFAULT 0,
      action_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS storage_folders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      parent_id  INTEGER,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(parent_id)  REFERENCES storage_folders(id) ON DELETE CASCADE,
      FOREIGN KEY(creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS storage_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id    INTEGER,
      name         TEXT NOT NULL,
      type         TEXT NOT NULL DEFAULT 'file',
      url_or_path  TEXT NOT NULL,
      uploaded_by  INTEGER,
      created_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(folder_id)   REFERENCES storage_folders(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    );
  `);

  // Broadcast channels & admin banners tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS broadcast_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id   INTEGER NOT NULL,
      channel     TEXT NOT NULL DEFAULT 'important',
      title       TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      priority    TEXT NOT NULL DEFAULT 'normal',
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS broadcast_reads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id  INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      read_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(message_id) REFERENCES broadcast_messages(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS admin_banners (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      text        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'info',
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_by  INTEGER NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      expires_at  TEXT,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );
  `);

  // Migration: drop old unique index (conflicts handled by checkConflicts now)
  try { db.exec(`DROP INDEX IF EXISTS uniq_teacher_slot_cycle`); } catch {}

  // Migration: add custom_label column to schedule if missing
  try { db.exec(`ALTER TABLE schedule ADD COLUMN custom_label TEXT DEFAULT NULL`); } catch {}

  // Migration: create schedule_students if it doesn't exist (idempotent via IF NOT EXISTS above)

  // Migrate: add icon column to storage tables
  try { db.exec(`ALTER TABLE storage_folders ADD COLUMN icon TEXT DEFAULT NULL`); } catch {}
  try { db.exec(`ALTER TABLE storage_items ADD COLUMN icon TEXT DEFAULT NULL`); } catch {}

  // Migrate: add parent_name to students
  try { db.exec(`ALTER TABLE students ADD COLUMN parent_name TEXT`); } catch {}
  // Migrate: add call_result to curator_call_tasks
  try { db.exec(`ALTER TABLE curator_call_tasks ADD COLUMN call_result TEXT`); } catch {}

  // Migrate: add recurring fields to tasks
  try { db.exec(`ALTER TABLE tasks ADD COLUMN is_recurring INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_day INTEGER`); } catch {}

  // Migrate: add avatar_url to users
  try { db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`); } catch {}
  // Migrate: add avatar_url to students
  try { db.exec(`ALTER TABLE students ADD COLUMN avatar_url TEXT`); } catch {}

  // Migrate: add confirmation_status and confirmed_at to tasks
  try { db.exec(`ALTER TABLE tasks ADD COLUMN confirmation_status TEXT DEFAULT 'none'`); } catch {}
  try { db.exec(`ALTER TABLE tasks ADD COLUMN confirmed_at TEXT`); } catch {}
  try { db.exec(`ALTER TABLE tasks ADD COLUMN rejection_reason TEXT`); } catch {}

  // Create task_checklist_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_checklist_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id      INTEGER NOT NULL,
      title        TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      sort_order   INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Wiki tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wiki_articles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      title       TEXT NOT NULL,
      content     TEXT DEFAULT '',
      author_id   INTEGER,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(category_id) REFERENCES wiki_categories(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS dynamic_tables (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id      INTEGER NOT NULL,
      title           TEXT NOT NULL,
      columns_json    TEXT NOT NULL DEFAULT '[]',
      visibility      TEXT NOT NULL DEFAULT 'private',
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS dynamic_table_rows (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id   INTEGER NOT NULL,
      row_data   TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(table_id) REFERENCES dynamic_tables(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS adhoc_lessons (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      teacher_id  INTEGER NOT NULL,
      subject_id  INTEGER,
      room        TEXT,
      date        TEXT NOT NULL,
      time_slot   TEXT NOT NULL,
      description TEXT,
      created_by  INTEGER NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(teacher_id) REFERENCES users(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS adhoc_lesson_students (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      adhoc_lesson_id INTEGER NOT NULL,
      student_id      INTEGER NOT NULL,
      status          TEXT DEFAULT 'present',
      lateness        TEXT DEFAULT 'on_time',
      homework        TEXT DEFAULT 'done',
      comment         TEXT,
      FOREIGN KEY(adhoc_lesson_id) REFERENCES adhoc_lessons(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id),
      UNIQUE(adhoc_lesson_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      user_name   TEXT,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      entity_name TEXT,
      details     TEXT,
      ip          TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  // Quiz / контрольный тест tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      date        TEXT NOT NULL,
      title       TEXT NOT NULL,
      created_by  INTEGER,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(schedule_id) REFERENCES schedule(id) ON DELETE SET NULL,
      FOREIGN KEY(created_by)  REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quiz_results (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id    INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      score      REAL,
      FOREIGN KEY(quiz_id)    REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id),
      UNIQUE(quiz_id, student_id)
    );
  `);

  // Chat tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id   INTEGER NOT NULL,
      receiver_id INTEGER,
      room        TEXT NOT NULL DEFAULT 'general',
      text        TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(sender_id)   REFERENCES users(id),
      FOREIGN KEY(receiver_id) REFERENCES users(id)
    );
  `);

  // ENT Certificates (real exam result files per student)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ent_certificates (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL,
      exam_type    TEXT NOT NULL,
      filename     TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path    TEXT NOT NULL,
      file_size    INTEGER,
      uploaded_by  INTEGER,
      uploaded_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(student_id)  REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id),
      UNIQUE(student_id, exam_type)
    );
  `);

  // ===== ADMISSION TRACKER =====
  db.exec(`
    CREATE TABLE IF NOT EXISTS universities (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      city       TEXT,
      website    TEXT,
      logo_url   TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS specialties (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      code             TEXT NOT NULL,
      name             TEXT NOT NULL,
      profile_subjects TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      UNIQUE(code)
    );

    CREATE TABLE IF NOT EXISTS passing_scores (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id  INTEGER NOT NULL,
      specialty_id   INTEGER NOT NULL,
      year           INTEGER NOT NULL DEFAULT 2026,
      grant_score    INTEGER,
      paid_score     INTEGER,
      FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE,
      FOREIGN KEY(specialty_id)  REFERENCES specialties(id)  ON DELETE CASCADE,
      UNIQUE(university_id, specialty_id, year)
    );
  `);

  // Migrate: add admission tracker fields to students
  try { db.exec(`ALTER TABLE students ADD COLUMN target_university_id INTEGER REFERENCES universities(id)`); } catch {}
  try { db.exec(`ALTER TABLE students ADD COLUMN target_specialty_id  INTEGER REFERENCES specialties(id)`);  } catch {}
  try { db.exec(`ALTER TABLE students ADD COLUMN unt_january_score INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE students ADD COLUMN unt_march_score   INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE students ADD COLUMN unt_grant_1_score INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE students ADD COLUMN unt_grant_2_score INTEGER`); } catch {}

  // Custom columns for admission tracker
  db.exec(`
    CREATE TABLE IF NOT EXISTS admission_custom_columns (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'checkbox',
      position   INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS admission_custom_values (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      column_id  INTEGER NOT NULL,
      value      TEXT,
      UNIQUE(student_id, column_id),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(column_id)  REFERENCES admission_custom_columns(id) ON DELETE CASCADE
    );
  `);

  // Schedule share tokens (for public schedule links)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_share_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token      TEXT UNIQUE NOT NULL,
      group_id   INTEGER,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(group_id)   REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );
  `);

  // Permissions tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      key  TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id       INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE(role_id, permission_id)
    );
  `);

  // Seed permissions
  const permList = [
    ['manage_users',     'Управление пользователями',     'Создание, редактирование, удаление учителей'],
    ['manage_students',  'Управление студентами',         'Создание, редактирование, удаление студентов'],
    ['manage_groups',    'Управление группами',           'Создание, редактирование, удаление групп'],
    ['manage_subjects',  'Управление предметами',         'Создание, редактирование, удаление предметов'],
    ['manage_schedule',  'Управление расписанием',        'Полное управление расписанием'],
    ['view_team',        'Просмотр команды',              'Просмотр списка преподавателей'],
    ['manage_tasks',     'Управление задачами',           'Создание задач и назначение другим'],
    ['manage_storage',   'Управление хранилищем',         'Загрузка и удаление файлов'],
    ['manage_wiki',      'Управление Wiki',               'Редактирование статей базы знаний'],
    ['manage_broadcasts','Управление рассылками',         'Создание и управление рассылками'],
    ['manage_banners',   'Управление баннерами',          'Создание и управление баннерами'],
    ['manage_grades',    'Управление оценками',           'Выставление и редактирование оценок'],
    ['view_audit_log',   'Просмотр аудит-лога',          'Просмотр журнала действий'],
    ['manage_ent',       'Управление ЕНТ',               'Загрузка и редактирование результатов ЕНТ'],
    ['manage_curatorship','Управление кураторством',      'Логи кураторства, звонки, отзывы'],
    ['view_dashboard',   'Просмотр дашборда',            'Просмотр статистики посещаемости'],
    ['use_chat',         'Использование чата',            'Отправка и чтение сообщений'],
    ['manage_permissions','Управление правами',           'Настройка прав доступа для ролей'],
    ['manage_admin_panel','Админ-панель',                 'Доступ к административной панели'],
  ];

  const permInsert = db.prepare("INSERT OR IGNORE INTO permissions (key, name, description) VALUES (?, ?, ?)");
  for (const [key, name, desc] of permList) permInsert.run(key, name, desc);

  // Seed default role permissions (admin=all, umo_head=most, teacher=basic)
  const allPerms = db.prepare("SELECT id, key FROM permissions").all();
  const existingRP = db.prepare("SELECT COUNT(*) as c FROM role_permissions").get().c;
  if (existingRP === 0) {
    const rpInsert = db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    const teacherPerms = ['manage_grades', 'manage_curatorship', 'use_chat', 'manage_tasks', 'manage_storage', 'manage_wiki', 'view_dashboard', 'manage_ent'];
    const umoPerms = [...teacherPerms, 'manage_students', 'manage_groups', 'manage_subjects', 'manage_schedule', 'view_team', 'manage_broadcasts', 'view_audit_log', 'manage_admin_panel'];

    for (const p of allPerms) {
      rpInsert.run(1, p.id); // admin gets all
      if (umoPerms.includes(p.key)) rpInsert.run(2, p.id);
      if (teacherPerms.includes(p.key)) rpInsert.run(3, p.id);
    }
    console.log("✅ Default role permissions seeded");
  }

  // === SEED STATIC DATA ===

  // Roles
  const roleCheck = db.prepare("SELECT id FROM roles WHERE id = ?");
  const roleInsert = db.prepare("INSERT INTO roles (id, name) VALUES (?, ?)");
  [{ id: 1, name: "admin" }, { id: 2, name: "umo_head" }, { id: 3, name: "teacher" }]
    .forEach(r => { if (!roleCheck.get(r.id)) roleInsert.run(r.id, r.name); });

  // Profiles
  if (db.prepare("SELECT COUNT(*) as c FROM profiles").get().c === 0) {
    const pi = db.prepare("INSERT INTO profiles (id, name) VALUES (?, ?)");
    [[1, "\u0424\u041c"], [2, "\u0425\u0411"], [3, "\u0418\u041d\u0424\u041c\u0410\u0422"]].forEach(([id, n]) => pi.run(id, n));
    console.log("\u2705 Profiles seeded");
  }

  // Rooms
  if (db.prepare("SELECT COUNT(*) as c FROM rooms").get().c === 0) {
    const ri = db.prepare("INSERT INTO rooms (name, capacity) VALUES (?, ?)");
    [["Uly Dala", 40], ["Expo", 40], ["Room 101", 25], ["Room 102", 25], ["Lab A", 20], ["Lab B", 20]]
      .forEach(([n, c]) => ri.run(n, c));
    console.log("\u2705 Rooms seeded");
  }

  // Time slots
  if (db.prepare("SELECT COUNT(*) as c FROM time_slots").get().c === 0) {
    const ti = db.prepare("INSERT INTO time_slots (start_time, end_time, label) VALUES (?, ?, ?)");
    [["15:15", "16:35", "1-\u043f\u0430\u0440\u0430"], ["16:40", "18:00", "2-\u043f\u0430\u0440\u0430"], ["18:10", "19:30", "3-\u043f\u0430\u0440\u0430"]]
      .forEach(([s, e, l]) => ti.run(s, e, l));
    console.log("\u2705 Time slots seeded");
  }

  // === LOAD CSV DATA ===
  loadCSV("users", "../database_today - users.csv");
  loadCSV("subjects", "../database_today - subjects .csv");
  loadCSV("groups", "../database_today - groups .csv");
  loadCSV("students", "../database_today - students .csv");
  loadCSV("schedule", "../database_today - schedule .csv");

  generateEmails();

  console.log("\u2705 Database initialized");
  printCredentials();
}

// === CSV LOADING ===

function loadCSV(type, relativePath) {
  const csvPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(csvPath)) { console.warn("\u26a0\ufe0f CSV not found: " + relativePath); return; }
  const data = fs.readFileSync(csvPath, "utf-8");
  const lines = data.split("\n").filter(l => l.trim());
  if (lines.length < 2) return;
  const headers = lines[0].split(",").map(h => h.trim());
  const idx = (name) => headers.indexOf(name);

  switch (type) {
    case "users": return loadUsers(lines, idx);
    case "subjects": return loadSubjects(lines, idx);
    case "groups": return loadGroupsCSV(lines, idx);
    case "students": return loadStudentsCSV(lines, idx);
    case "schedule": return loadScheduleCSV(lines, idx);
  }
}

function loadUsers(lines, idx) {
  if (db.prepare("SELECT COUNT(*) as c FROM users").get().c > 0) return;
  const stmt = db.prepare("INSERT INTO users (id, name, surname, phone, email, password, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",").map(s => s.trim());
    try {
      const id = parseInt(c[idx("id")]);
      const surname = c[idx("surname")] || "Today";
      stmt.run(id, c[idx("name")] || "User", surname, c[idx("phone")] || null, null, surname.toLowerCase() + id, parseInt(c[idx("role_id")]));
      n++;
    } catch (e) { /* skip bad row */ }
  }
  console.log("\ud83d\udc65 Users inserted: " + n);
}

function loadSubjects(lines, idx) {
  if (db.prepare("SELECT COUNT(*) as c FROM subjects").get().c > 0) return;
  // CSV has "Id" and "subject_name"
  const idCol = idx("Id") !== -1 ? idx("Id") : idx("id");
  const nameCol = idx("subject_name") !== -1 ? idx("subject_name") : idx("name");
  const typeCol = idx("type");
  const stmt = db.prepare("INSERT INTO subjects (id, name, type) VALUES (?, ?, ?)");
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",").map(s => s.trim());
    try { stmt.run(parseInt(c[idCol]), c[nameCol], typeCol !== -1 ? c[typeCol] : "mandatory"); n++; }
    catch (e) { /* skip */ }
  }
  console.log("\ud83d\udcda Subjects inserted: " + n);
}

function loadGroupsCSV(lines, idx) {
  if (db.prepare("SELECT COUNT(*) as c FROM groups").get().c > 0) return;
  const stmt = db.prepare("INSERT INTO groups (id, name, profile_id, curator_id) VALUES (?, ?, ?, ?)");
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",").map(s => s.trim());
    try {
      stmt.run(parseInt(c[idx("id")]), c[idx("group_name")], parseInt(c[idx("profile_id")]) || null, parseInt(c[idx("curator_id")]) || null);
      n++;
    } catch (e) { /* skip */ }
  }
  console.log("\ud83d\udcca Groups inserted: " + n);
}

function loadStudentsCSV(lines, idx) {
  if (db.prepare("SELECT COUNT(*) as c FROM students").get().c > 0) return;
  const stmt = db.prepare("INSERT INTO students (id, full_name, phone, parent_phone, group_id, status) VALUES (?, ?, ?, ?, ?, ?)");
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",").map(s => s.trim());
    try {
      const fullName = (c[idx("name")] + " " + c[idx("surname")]).trim();
      stmt.run(parseInt(c[idx("id")]), fullName, c[idx("phone")] || null, c[idx("parent_phone")] || null, parseInt(c[idx("group_id")]) || null, c[idx("status")] || "active");
      n++;
    } catch (e) { /* skip */ }
  }
  console.log("\ud83d\udc68\u200d\ud83c\udf93 Students inserted: " + n);
}

function loadScheduleCSV(lines, idx) {
  if (db.prepare("SELECT COUNT(*) as c FROM schedule").get().c > 0) return;

  // Build lookup maps for rooms and time slots
  const rooms = db.prepare("SELECT id, name FROM rooms").all();
  const roomMap = {};
  rooms.forEach(r => { roomMap[r.name] = r.id; });

  const slots = db.prepare("SELECT id, start_time FROM time_slots").all();
  const slotMap = {};
  slots.forEach(s => { slotMap[s.start_time] = s.id; });

  const stmt = db.prepare("INSERT INTO schedule (group_id, subject_id, teacher_id, room_id, time_slot_id, cycle) VALUES (?, ?, ?, ?, ?, ?)");
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",").map(s => s.trim());
    try {
      const roomName = c[idx("room_name")];
      const startTime = c[idx("start_time")];
      const roomId = roomMap[roomName];
      const slotId = slotMap[startTime];
      if (!roomId || !slotId) { console.warn("  skip row " + i + ": room=" + roomName + " slot=" + startTime); continue; }
      const cycle = c[idx("cycle")] || "PSP";
      // Normalize Cyrillic cycle names to Latin
      const normalizedCycle = cycle === "\u041f\u0421\u041f" ? "PSP" : cycle === "\u0412\u0427\u0421" ? "VChS" : cycle;
      stmt.run(parseInt(c[idx("group_id")]), parseInt(c[idx("subject_id")]), parseInt(c[idx("teacher_id")]), roomId, slotId, normalizedCycle);
      n++;
    } catch (e) { /* skip */ }
  }
  console.log("\ud83d\udcc5 Schedule inserted: " + n);
}

// === HELPERS ===

function generateEmails() {
  const users = db.prepare("SELECT id, name, surname FROM users").all();
  if (!users.length) return;
  const stmt = db.prepare("UPDATE users SET email = ? WHERE id = ?");
  for (const u of users) {
    const name = toLatin((u.name || "").trim().toLowerCase().replace(/\s+/g, "") || "user");
    const surname = toLatin((u.surname || "").trim().toLowerCase().replace(/\s+/g, "") || "today");
    try { stmt.run(name + "." + surname + "@today.edu", u.id); } catch (e) { /* skip */ }
  }
  console.log("\u2705 Emails generated for " + users.length + " users");
}

function printCredentials() {
  console.log("\n\ud83d\udd10 ===== LOGIN CREDENTIALS =====\n");
  db.prepare("SELECT u.id, u.name, u.surname, u.email, u.password, r.name as role FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.id").all()
    .forEach(u => { console.log("Email: " + u.email + "\nPassword: " + u.password + "\n" + u.name + " " + u.surname + " (" + u.role + ")\n"); });
  console.log("================================\n");
}
