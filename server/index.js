import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { WebSocketServer } from "ws";
import { initializeDatabase, db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storageUploadsDir = path.join(uploadsDir, "storage");
if (!fs.existsSync(storageUploadsDir)) fs.mkdirSync(storageUploadsDir, { recursive: true });
const avatarsDir = path.join(uploadsDir, "avatars");
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const storageFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageUploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const storageUpload = multer({ storage: storageFileStorage, limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
const PORT = 3001;

// Безопасные заголовки
app.use(helmet({
  crossOriginResourcePolicy: false, // чтобы не ломать отдачу файлов/аватарок
}));

// CORS: отражаем Origin (localhost или ваш IP), без credentials
// Можно задать список через CLIENT_ORIGIN, CLIENT_ORIGIN_EXTRA (через запятую)
const allowedOriginsEnv = process.env.CLIENT_ORIGIN || "http://localhost:8080";
const extraOriginsEnv = process.env.CLIENT_ORIGIN_EXTRA || "";
const allowedOrigins = [
  ...allowedOriginsEnv.split(",").map(o => o.trim()).filter(Boolean),
  ...extraOriginsEnv.split(",").map(o => o.trim()).filter(Boolean),
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // запросы без Origin (например, curl)
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// Парсим JSON
app.use(express.json({ limit: "1mb" }));

// Общий лимит запросов (DDoS/брутфорс защита по IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 1000,
});
app.use(globalLimiter);

initializeDatabase();

// ====================== HELPERS ======================

function logAction(req, { action, entityType, entityId, entityName, details, userId, userName } = {}) {
  try {
    const ip = req?.ip || req?.headers?.["x-forwarded-for"] || req?.connection?.remoteAddress || "";
    db.prepare(
      "INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, entity_name, details, ip) VALUES (?,?,?,?,?,?,?,?)"
    ).run(userId || null, userName || null, action, entityType || null, entityId || null, entityName || null, details || null, ip);
  } catch (e) { console.error("Audit log error:", e.message); }
}

function generateLessonDates(cycle) {
  const dates = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 14);
  const end = new Date(today);
  end.setDate(today.getDate() + 56);

  let days = [];
  if (cycle === "\u041f\u0421\u041f" || cycle === "PSP") days = [1, 3, 5];
  else if (cycle === "\u0412\u0427\u0421" || cycle === "VChS") days = [2, 4, 6];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// ====================== AUTH ======================

// Более строгий лимит только на логин
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/login", loginLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = db.prepare(`
      SELECT u.id, u.name, u.surname, u.email, u.phone, u.password, u.avatar_url, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?
    `).get(email);

    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid email or password" });

    logAction(req, { action: "login", entityType: "user", entityId: user.id, entityName: user.name + " " + user.surname, userId: user.id, userName: user.name + " " + user.surname });
    res.json({ id: user.id.toString(), email: user.email, full_name: user.name + " " + user.surname, role: user.role, avatar_url: user.avatar_url || null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/password-reset-request", (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const user = db.prepare("SELECT u.id, u.name, u.surname FROM users u WHERE u.email = ?").get(email);
    if (!user) return res.status(404).json({ error: "Пользователь с таким email не найден" });
    const admins = db.prepare("SELECT u.id FROM users u WHERE u.role_id = 1").all();
    for (const admin of admins) {
      createNotification(admin.id, 'system', `Запрос на сброс пароля`, `${user.name} ${user.surname} (${email}) запросил сброс пароля`, '/admin');
    }
    logAction(req, { action: "password_reset_request", entityType: "user", entityId: user.id, entityName: user.name + " " + user.surname });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== USERS ======================

app.get("/api/users", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.surname, u.email, u.phone, u.avatar_url, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.id
    `).all();
    res.json(users);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/users/:id", (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.name, u.surname, u.email, u.phone, u.avatar_url, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== GROUPS ======================

app.get("/api/groups", (req, res) => {
  try {
    const groups = db.prepare(`
      SELECT g.id, g.name, g.profile_id, g.curator_id,
             p.name as profile_name,
             u.name || ' ' || u.surname as curator_name,
             COUNT(s.id) as students_count
      FROM groups g
      LEFT JOIN profiles p ON g.profile_id = p.id
      LEFT JOIN users u ON g.curator_id = u.id
      LEFT JOIN students s ON s.group_id = g.id
      GROUP BY g.id, g.name, g.profile_id, p.name, g.curator_id, u.name, u.surname
      ORDER BY g.id
    `).all();
    res.json(groups);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/groups", (req, res) => {
  try {
    const { name, profile_id, curator_id } = req.body;
    if (!name) return res.status(400).json({ error: "Group name is required" });
    const result = db.prepare("INSERT INTO groups (name, profile_id, curator_id) VALUES (?, ?, ?)").run(name, profile_id || null, curator_id || null);
    logAction(req, { action: "create", entityType: "group", entityId: result.lastInsertRowid, entityName: name, details: JSON.stringify({ profile_id, curator_id }) });
    res.json({ id: result.lastInsertRowid, name });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/groups/:id", (req, res) => {
  try {
    const { name, profile_id, curator_id } = req.body;
    db.prepare("UPDATE groups SET name = COALESCE(?, name), profile_id = COALESCE(?, profile_id), curator_id = COALESCE(?, curator_id) WHERE id = ?")
      .run(name || null, profile_id || null, curator_id || null, req.params.id);
    logAction(req, { action: "update", entityType: "group", entityId: Number(req.params.id), entityName: name });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/groups/:id", (req, res) => {
  try {
    const g = db.prepare("SELECT name FROM groups WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM groups WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "group", entityId: Number(req.params.id), entityName: g?.name });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== SUBJECTS ======================

app.get("/api/subjects", (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM subjects ORDER BY id").all());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== ROOMS ======================

app.get("/api/rooms", (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM rooms ORDER BY id").all());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== TIME SLOTS ======================

app.get("/api/time-slots", (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM time_slots ORDER BY id").all());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== PROFILES ======================

app.get("/api/profiles", (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM profiles ORDER BY id").all());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== SCHEDULE (CRUD + CONFLICT CHECK) ======================

app.get("/api/schedule", (req, res) => {
  try {
    const { teacher_id } = req.query;
    let query = `
      SELECT s.id, s.group_id, s.subject_id, s.teacher_id, s.room_id, s.time_slot_id, s.cycle,
             g.name as group_name,
             subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name,
             r.name as room_name,
             ts.start_time, ts.end_time, ts.label as time_label
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN users u ON s.teacher_id = u.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
    `;
    const params = [];
    if (teacher_id) { query += " WHERE s.teacher_id = ?"; params.push(parseInt(teacher_id)); }
    query += " ORDER BY ts.start_time, g.name";
    res.json(db.prepare(query).all(...params));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/schedule", (req, res) => {
  try {
    const { group_id, subject_id, teacher_id, room_id, time_slot_id, cycle } = req.body;
    if (!group_id || !subject_id || !teacher_id || !room_id || !time_slot_id || !cycle)
      return res.status(400).json({ error: "All fields are required" });

    // Conflict check
    const conflicts = checkConflicts({ teacher_id, room_id, time_slot_id, cycle, group_id });
    if (conflicts.length > 0) return res.status(409).json({ error: "Conflict detected", conflicts });

    const result = db.prepare(
      "INSERT INTO schedule (group_id, subject_id, teacher_id, room_id, time_slot_id, cycle) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(group_id, subject_id, teacher_id, room_id, time_slot_id, cycle);

    const created = db.prepare(`
      SELECT s.*, g.name as group_name, subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name, r.name as room_name,
             ts.start_time, ts.end_time, ts.label as time_label
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN users u ON s.teacher_id = u.id LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    logAction(req, { action: "create", entityType: "schedule", entityId: result.lastInsertRowid, entityName: created?.group_name + ' / ' + created?.subject_name });
    res.json(created);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/schedule/:id", (req, res) => {
  try {
    const { group_id, subject_id, teacher_id, room_id, time_slot_id, cycle } = req.body;
    const id = parseInt(req.params.id);

    // Conflict check excluding current entry
    const conflicts = checkConflicts({ teacher_id, room_id, time_slot_id, cycle, exclude_id: id, group_id });
    if (conflicts.length > 0) return res.status(409).json({ error: "Conflict detected", conflicts });

    db.prepare(
      "UPDATE schedule SET group_id=?, subject_id=?, teacher_id=?, room_id=?, time_slot_id=?, cycle=? WHERE id=?"
    ).run(group_id, subject_id, teacher_id, room_id, time_slot_id, cycle, id);

    const updated = db.prepare(`
      SELECT s.*, g.name as group_name, subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name, r.name as room_name,
             ts.start_time, ts.end_time, ts.label as time_label
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN users u ON s.teacher_id = u.id LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      WHERE s.id = ?
    `).get(id);

    logAction(req, { action: "update", entityType: "schedule", entityId: id, entityName: updated?.group_name + ' / ' + updated?.subject_name });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/schedule/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM schedule WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "schedule", entityId: Number(req.params.id) });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Move a lesson to a different teacher / time slot (partial update, no room change)
app.patch("/api/schedule/:id/move", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { teacher_id, time_slot_id, cycle } = req.body;
    if (!teacher_id || !time_slot_id || !cycle)
      return res.status(400).json({ error: "Требуются teacher_id, time_slot_id и cycle" });

    // Get current entry to find its group
    const current = db.prepare("SELECT group_id FROM schedule WHERE id = ?").get(id);
    if (!current) return res.status(404).json({ error: "Entry not found" });

    // Check for teacher conflict (exclude current entry)
    const teacherConflict = db.prepare(`
      SELECT s.id, g.name as group_name, subj.name as subject_name
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      WHERE s.teacher_id = ? AND s.time_slot_id = ? AND s.cycle = ? AND s.id != ?
    `).get(teacher_id, time_slot_id, cycle, id);

    if (teacherConflict) {
      return res.status(409).json({
        error: `Учитель уже занят в это время (${teacherConflict.group_name} — ${teacherConflict.subject_name})`
      });
    }

    // Check for group conflict (exclude current entry)
    const groupConflict = db.prepare(`
      SELECT s.id, g.name as group_name, subj.name as subject_name
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      WHERE s.group_id = ? AND s.time_slot_id = ? AND s.cycle = ? AND s.id != ?
    `).get(current.group_id, time_slot_id, cycle, id);

    if (groupConflict) {
      return res.status(409).json({
        error: `Группа уже занята в это время (${groupConflict.group_name} — ${groupConflict.subject_name})`
      });
    }

    db.prepare("UPDATE schedule SET teacher_id = ?, time_slot_id = ?, cycle = ? WHERE id = ?")
      .run(teacher_id, time_slot_id, cycle, id);

    const updated = db.prepare(`
      SELECT s.*, g.name as group_name, subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name, r.name as room_name,
             ts.start_time, ts.end_time, ts.label as time_label
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN users u ON s.teacher_id = u.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      WHERE s.id = ?
    `).get(id);

    // Notify the teacher whose schedule was changed
    createNotification(
      teacher_id, 'schedule',
      'Изменение в расписании',
      updated
        ? `Урок ${updated.group_name} — ${updated.subject_name} перенесён на ${updated.start_time}`
        : 'Ваше расписание было изменено',
      '/calendar'
    );

    res.json(updated);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: "Учитель уже занят в это время" });
    res.status(500).json({ error: error.message });
  }
});

// Publish schedule — notify all teachers
app.post("/api/schedule/publish", (req, res) => {
  try {
    const { cycle } = req.body;
    const cycleLabel = cycle === "PSP" ? "ПСП (пн/ср/пт)" : "ВЧС (вт/чт/сб)";
    const teachers = db.prepare("SELECT id FROM users WHERE role = 'teacher'").all();
    for (const teacher of teachers) {
      createNotification(
        teacher.id, 'schedule',
        'Расписание опубликовано',
        `Актуальное расписание для цикла ${cycleLabel} доступно в Календаре`,
        '/calendar'
      );
    }
    res.json({ success: true, notified: teachers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Conflict checking endpoint
app.post("/api/schedule/check-conflicts", (req, res) => {
  try {
    const { teacher_id, room_id, time_slot_id, cycle, exclude_id } = req.body;
    const conflicts = checkConflicts({ teacher_id, room_id, time_slot_id, cycle, exclude_id });
    res.json({ conflicts, hasConflict: conflicts.length > 0 });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

function checkConflicts({ teacher_id, room_id, time_slot_id, cycle, exclude_id, group_id }) {
  const conflicts = [];
  let excludeClause = "";
  const params1 = [teacher_id, time_slot_id, cycle];
  const params2 = [room_id, time_slot_id, cycle];
  const params3 = group_id ? [group_id, time_slot_id, cycle] : null;

  if (exclude_id) {
    excludeClause = " AND s.id != ?";
    params1.push(exclude_id);
    params2.push(exclude_id);
    if (params3) params3.push(exclude_id);
  }

  // Teacher conflict: same teacher, same time slot, same cycle
  const teacherConflicts = db.prepare(`
    SELECT s.id, g.name as group_name, subj.name as subject_name, u.name || ' ' || u.surname as teacher_name
    FROM schedule s
    LEFT JOIN groups g ON s.group_id = g.id
    LEFT JOIN subjects subj ON s.subject_id = subj.id
    LEFT JOIN users u ON s.teacher_id = u.id
    WHERE s.teacher_id = ? AND s.time_slot_id = ? AND s.cycle = ?${excludeClause}
  `).all(...params1);

  if (teacherConflicts.length > 0) {
    conflicts.push(...teacherConflicts.map(c => ({ type: "teacher", ...c })));
  }

  // Room conflict: same room, same time slot, same cycle
  const roomConflicts = db.prepare(`
    SELECT s.id, g.name as group_name, subj.name as subject_name, r.name as room_name
    FROM schedule s
    LEFT JOIN groups g ON s.group_id = g.id
    LEFT JOIN subjects subj ON s.subject_id = subj.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE s.room_id = ? AND s.time_slot_id = ? AND s.cycle = ?${excludeClause}
  `).all(...params2);

  if (roomConflicts.length > 0) {
    conflicts.push(...roomConflicts.map(c => ({ type: "room", ...c })));
  }

  // Group conflict: same group, same time slot, same cycle
  if (params3) {
    const groupConflicts = db.prepare(`
      SELECT s.id, g.name as group_name, subj.name as subject_name
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      WHERE s.group_id = ? AND s.time_slot_id = ? AND s.cycle = ?${excludeClause}
    `).all(...params3);
    if (groupConflicts.length > 0) {
      conflicts.push(...groupConflicts.map(c => ({ type: "group", ...c })));
    }
  }

  return conflicts;
}

// ====================== LESSONS (generated from schedule) ======================

app.get("/api/lessons", (req, res) => {
  try {
    const { teacher_id } = req.query;
    let query = `
      SELECT s.id, s.group_id, s.subject_id, s.teacher_id, s.room_id, s.time_slot_id, s.cycle,
             g.name as group_name, subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name,
             r.name as room_name,
             ts.start_time, ts.end_time
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN users u ON s.teacher_id = u.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
    `;
    const params = [];
    if (teacher_id) { query += " WHERE s.teacher_id = ?"; params.push(parseInt(teacher_id)); }
    query += " ORDER BY ts.start_time";

    const schedule = db.prepare(query).all(...params);

    const studentsByGroup = db.prepare("SELECT id, full_name, group_id FROM students WHERE group_id = ?");

    const result = schedule.map(entry => ({
      id: entry.id,
      group_id: entry.group_id,
      subject_id: entry.subject_id,
      teacher_id: entry.teacher_id,
      group_name: entry.group_name,
      subject_name: entry.subject_name,
      teacher_name: entry.teacher_name,
      cycle: entry.cycle,
      start_time: entry.start_time,
      end_time: entry.end_time,
      room_name: entry.room_name,
      dates: generateLessonDates(entry.cycle),
      students: studentsByGroup.all(entry.group_id),
    }));

    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== STUDENTS ======================

app.get("/api/students", (req, res) => {
  try {
    const students = db.prepare(`
      SELECT s.id, s.full_name, s.phone, s.parent_phone, s.parent_name, s.group_id, s.status, g.name as group_name,
        (SELECT ROUND(AVG(CASE WHEN a.status='present' THEN 1.0 ELSE 0.0 END)*100,1) FROM attendance a WHERE a.student_id = s.id) as attendance_rate,
        (SELECT SUM(e.score) FROM ent_results e WHERE e.student_id = s.id AND e.month = (SELECT MAX(e2.month) FROM ent_results e2 WHERE e2.student_id = s.id)) as last_ent_score
      FROM students s LEFT JOIN groups g ON s.group_id = g.id ORDER BY s.full_name
    `).all();
    res.json(students);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/students/:id", (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.id, s.full_name, s.phone, s.parent_phone, s.parent_name, s.group_id, s.status, g.name as group_name
      FROM students s LEFT JOIN groups g ON s.group_id = g.id WHERE s.id = ?
    `).get(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const stats = db.prepare(`
      SELECT COUNT(*) as total_lessons,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN lateness='late' THEN 1 ELSE 0 END) as late_count,
        ROUND(AVG(CASE WHEN status='present' THEN 1.0 ELSE 0.0 END)*100,1) as attendance_rate
      FROM attendance WHERE student_id = ?
    `).get(req.params.id);

    const recent = db.prepare(`
      SELECT a.status, a.lateness, a.homework, a.comment, l.date,
        subj.name as subject_name
      FROM attendance a JOIN lessons l ON a.lesson_id = l.id
      LEFT JOIN schedule sc ON l.schedule_id = sc.id
      LEFT JOIN subjects subj ON sc.subject_id = subj.id
      WHERE a.student_id = ? ORDER BY l.date DESC LIMIT 10
    `).all(req.params.id);

    const entResults = db.prepare(`
      SELECT e.score, e.month, subj.name as subject_name
      FROM ent_results e JOIN subjects subj ON e.subject_id = subj.id
      WHERE e.student_id = ? ORDER BY e.month DESC, subj.name
    `).all(req.params.id);

    res.json({ ...student, attendance_stats: stats, recent_attendance: recent, ent_results: entResults });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/students", (req, res) => {
  try {
    const { full_name, phone, parent_phone, parent_name, group_id, status } = req.body;
    if (!full_name) return res.status(400).json({ error: "Student name is required" });
    const result = db.prepare(
      "INSERT INTO students (full_name, phone, parent_phone, parent_name, group_id, status) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(full_name, phone || null, parent_phone || null, parent_name || null, group_id || null, status || "active");
    logAction(req, { action: "create", entityType: "student", entityId: result.lastInsertRowid, entityName: full_name });
    res.json({ id: result.lastInsertRowid, full_name });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/students/:id", (req, res) => {
  try {
    const st = db.prepare("SELECT full_name FROM students WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM students WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "student", entityId: Number(req.params.id), entityName: st?.full_name });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== ATTENDANCE ======================

app.post("/api/attendance", (req, res) => {
  try {
    const { student_id, lesson_id, schedule_id, date, status, lateness, homework, comment } = req.body;
    if (!student_id) return res.status(400).json({ error: "student_id required" });
    if (!lesson_id && (!schedule_id || !date)) return res.status(400).json({ error: "lesson_id or schedule_id+date required" });

    // Resolve or create lesson
    let lesson = lesson_id ? db.prepare("SELECT id FROM lessons WHERE id = ?").get(lesson_id) : null;
    if (!lesson && schedule_id && date) {
      db.prepare("INSERT OR IGNORE INTO lessons (schedule_id, date) VALUES (?, ?)").run(schedule_id, date);
      lesson = db.prepare("SELECT id FROM lessons WHERE schedule_id = ? AND date = ?").get(schedule_id, date);
    }

    const actualLessonId = lesson ? lesson.id : lesson_id;

    db.prepare(`
      INSERT INTO attendance (student_id, lesson_id, status, lateness, homework, comment)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, lesson_id) DO UPDATE SET
        status=excluded.status, lateness=excluded.lateness, homework=excluded.homework, comment=excluded.comment
    `).run(student_id, actualLessonId, status || "present", lateness || "on_time", homework || "done", comment || null);

    // Notify curator when student is marked absent
    if ((status || "present") === "absent") {
      try {
        const studentInfo = db.prepare(`
          SELECT s.full_name, g.curator_id, g.name as group_name
          FROM students s LEFT JOIN groups g ON s.group_id = g.id WHERE s.id = ?
        `).get(student_id);
        if (studentInfo && studentInfo.curator_id) {
          createNotification(
            studentInfo.curator_id, 'student_alert',
            `Студент отсутствует: ${studentInfo.full_name}`,
            `Группа: ${studentInfo.group_name}`,
            '/curatorship'
          );
        }
      } catch (e) { /* non-critical */ }
    }

    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== AD-HOC LESSONS ======================

app.get("/api/adhoc-lessons", (req, res) => {
  try {
    const { date, teacher_id } = req.query;
    let query = `SELECT al.*, u.name as teacher_name, u.surname as teacher_surname,
                        s.name as subject_name
                 FROM adhoc_lessons al
                 LEFT JOIN users u ON al.teacher_id = u.id
                 LEFT JOIN subjects s ON al.subject_id = s.id`;
    const params = [];
    const conditions = [];
    if (date) { conditions.push("al.date = ?"); params.push(date); }
    if (teacher_id) { conditions.push("al.teacher_id = ?"); params.push(teacher_id); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY al.time_slot";
    const lessons = db.prepare(query).all(...params);
    // Attach students
    const stmtStudents = db.prepare(`
      SELECT als.*, st.full_name, st.group_id, g.name as group_name
      FROM adhoc_lesson_students als
      JOIN students st ON als.student_id = st.id
      LEFT JOIN groups g ON st.group_id = g.id
      WHERE als.adhoc_lesson_id = ?
    `);
    for (const lesson of lessons) {
      lesson.students = stmtStudents.all(lesson.id);
    }
    res.json(lessons);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/adhoc-lessons", (req, res) => {
  try {
    const { title, teacher_id, subject_id, room, date, time_slot, description, student_ids, created_by } = req.body;
    if (!title || !teacher_id || !date || !time_slot || !created_by) {
      return res.status(400).json({ error: "title, teacher_id, date, time_slot, created_by required" });
    }
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: "At least one student required" });
    }
    const result = db.prepare(
      `INSERT INTO adhoc_lessons (title, teacher_id, subject_id, room, date, time_slot, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(title, teacher_id, subject_id || null, room || null, date, time_slot, description || null, created_by);
    const lessonId = result.lastInsertRowid;
    const insertStudent = db.prepare(
      `INSERT OR IGNORE INTO adhoc_lesson_students (adhoc_lesson_id, student_id) VALUES (?, ?)`
    );
    for (const sid of student_ids) {
      insertStudent.run(lessonId, sid);
    }
    res.json({ id: lessonId, success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/adhoc-lessons/:id/attendance", (req, res) => {
  try {
    const { id } = req.params;
    const { students } = req.body; // [{ student_id, status, lateness, homework, comment }]
    if (!students || !Array.isArray(students)) return res.status(400).json({ error: "students array required" });
    const stmt = db.prepare(`
      UPDATE adhoc_lesson_students SET status = ?, lateness = ?, homework = ?, comment = ?
      WHERE adhoc_lesson_id = ? AND student_id = ?
    `);
    for (const s of students) {
      stmt.run(s.status || "present", s.lateness || "on_time", s.homework || "done", s.comment || null, id, s.student_id);
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/adhoc-lessons/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM adhoc_lessons WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== ENT RESULTS ======================

app.get("/api/ent-results", (req, res) => {
  try {
    const { month, group_id } = req.query;
    let query = `
      SELECT e.id, e.student_id, e.subject_id, e.score, e.month,
             s.full_name as student_name, subj.name as subject_name, s.group_id, g.name as group_name
      FROM ent_results e
      JOIN students s ON e.student_id = s.id
      JOIN subjects subj ON e.subject_id = subj.id
      LEFT JOIN groups g ON s.group_id = g.id
    `;
    const conditions = [];
    const params = [];
    if (month) { conditions.push("e.month = ?"); params.push(month); }
    if (group_id) { conditions.push("s.group_id = ?"); params.push(parseInt(group_id)); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY s.full_name, subj.name";
    res.json(db.prepare(query).all(...params));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/ent-results", (req, res) => {
  try {
    const { student_id, subject_id, score, month } = req.body;
    if (!student_id || !subject_id || score === undefined || !month)
      return res.status(400).json({ error: "All fields required" });
    db.prepare(`
      INSERT INTO ent_results (student_id, subject_id, score, month) VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, subject_id, month) DO UPDATE SET score=excluded.score
    `).run(student_id, subject_id, score, month);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Batch save ENT results
app.post("/api/ent-results/batch", (req, res) => {
  try {
    const { scores } = req.body;
    if (!Array.isArray(scores) || scores.length === 0)
      return res.status(400).json({ error: "scores array required" });
    const upsert = db.prepare(`
      INSERT INTO ent_results (student_id, subject_id, score, month)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, subject_id, month) DO UPDATE SET score = excluded.score
    `);
    const tx = db.transaction(() => {
      for (const s of scores) {
        if (!s.student_id || !s.subject_id || s.score === undefined || !s.month) continue;
        upsert.run(parseInt(s.student_id), parseInt(s.subject_id), parseInt(s.score), s.month);
      }
    });
    tx();
    res.json({ success: true, count: scores.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== NOTES ======================

app.get("/api/notes", (req, res) => {
  try {
    const { user_id } = req.query;
    let query = "SELECT * FROM notes";
    const params = [];
    if (user_id) { query += " WHERE user_id = ?"; params.push(parseInt(user_id)); }
    query += " ORDER BY date DESC, created_at DESC";
    res.json(db.prepare(query).all(...params));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/notes", (req, res) => {
  try {
    const { user_id, date, time_slot, title, description } = req.body;
    if (!user_id || !title || !date) return res.status(400).json({ error: "user_id, title, date required" });
    const result = db.prepare("INSERT INTO notes (user_id, date, time_slot, title, description) VALUES (?, ?, ?, ?, ?)")
      .run(user_id, date, time_slot || null, title, description || null);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/notes/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== NOTIFICATIONS ======================

function createNotification(user_id, type, title, message, action_url = null) {
  try {
    db.prepare("INSERT INTO notifications (user_id, type, title, message, is_read, action_url) VALUES (?, ?, ?, ?, 0, ?)")
      .run(user_id, type, title, message || null, action_url);
  } catch (e) {
    console.error("Failed to create notification:", e.message);
  }
}

app.get("/api/notifications/my", (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    const notifications = db.prepare(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).all(parseInt(user_id));
    res.json(notifications);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/notifications/read-all", (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(parseInt(user_id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/notifications/:id/read", (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== CURATORSHIP ======================

app.get("/api/curatorship", (req, res) => {
  try {
    const { curator_id } = req.query;
    let query = `
      SELECT cl.*, g.name as group_name, u.name || ' ' || u.surname as curator_name
      FROM curatorship_logs cl
      JOIN groups g ON cl.group_id = g.id
      JOIN users u ON cl.curator_id = u.id
    `;
    const params = [];
    if (curator_id) { query += " WHERE cl.curator_id = ?"; params.push(parseInt(curator_id)); }
    query += " ORDER BY cl.date DESC";
    res.json(db.prepare(query).all(...params));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/curatorship", (req, res) => {
  try {
    const { curator_id, group_id, date, type, title, description } = req.body;
    if (!curator_id || !group_id || !date || !type || !title)
      return res.status(400).json({ error: "curator_id, group_id, date, type, title required" });
    const result = db.prepare("INSERT INTO curatorship_logs (curator_id, group_id, date, type, title, description) VALUES (?, ?, ?, ?, ?, ?)")
      .run(curator_id, group_id, date, type, title, description || null);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== TASKS ======================

const getTaskAssignees = (taskId) =>
  db.prepare(`SELECT u.id, u.name || ' ' || u.surname as full_name, u.avatar_url FROM task_assignees ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = ?`).all(taskId);

app.get("/api/tasks", (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT t.*,
        c.name || ' ' || c.surname as creator_name
      FROM tasks t
      LEFT JOIN users c ON t.created_by = c.id
      ORDER BY t.created_at DESC
    `).all();
    const checklistStmt = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN is_completed=1 THEN 1 ELSE 0 END) as done FROM task_checklist_items WHERE task_id = ?");
    const result = tasks.map(t => {
      const cl = checklistStmt.get(t.id);
      return { ...t, assignees: getTaskAssignees(t.id), checklist_total: cl.total, checklist_done: cl.done || 0 };
    });
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/tasks", (req, res) => {
  try {
    const { title, description, status, priority, assignee_ids, created_by, due_date, is_recurring, recurrence_day } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const result = db.prepare(
      "INSERT INTO tasks (title, description, status, priority, created_by, due_date, is_recurring, recurrence_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(title, description || null, status || "todo", priority || "medium", created_by || null, due_date || null, is_recurring ? 1 : 0, recurrence_day ?? null);
    const taskId = result.lastInsertRowid;
    if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
      const ins = db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)");
      for (const uid of assignee_ids) {
        ins.run(taskId, uid);
        createNotification(uid, 'task', `Вам назначена задача: ${title}`, description || null, '/tasks');
      }
    }
    logAction(req, { action: "create", entityType: "task", entityId: taskId, entityName: title, userId: created_by });
    res.json({ id: taskId, success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/tasks/:id", (req, res) => {
  try {
    const { title, description, status, priority, due_date, assignee_ids, is_recurring, recurrence_day, confirmation_status, rejection_reason, acting_user_id } = req.body;
    const taskId = req.params.id;

    // If confirmation action, enforce that only the creator can confirm/reject
    if (confirmation_status === "confirmed" || confirmation_status === "rejected") {
      const task = db.prepare("SELECT created_by, title FROM tasks WHERE id = ?").get(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (acting_user_id && task.created_by !== acting_user_id) {
        return res.status(403).json({ error: "Only the task creator can confirm or reject" });
      }
      // Notify assignees about confirmation/rejection
      const assignees = getTaskAssignees(taskId);
      for (const a of assignees) {
        if (confirmation_status === "confirmed") {
          createNotification(a.id, 'task', `Задача подтверждена: ${task.title}`, 'Автор подтвердил выполнение задачи', '/tasks');
        } else {
          createNotification(a.id, 'task', `Задача отклонена: ${task.title}`, rejection_reason || 'Без причины', '/tasks');
        }
      }
    }

    // If sending for review, notify the creator
    if (confirmation_status === "pending") {
      const task = db.prepare("SELECT created_by, title FROM tasks WHERE id = ?").get(taskId);
      if (task && task.created_by) {
        createNotification(task.created_by, 'task', `Задача на проверке: ${task.title}`, 'Исполнитель отправил задачу на проверку', '/tasks');
      }
    }

    db.prepare(`
      UPDATE tasks SET title=COALESCE(?,title), description=COALESCE(?,description),
        status=COALESCE(?,status), priority=COALESCE(?,priority),
        due_date=COALESCE(?,due_date), is_recurring=COALESCE(?,is_recurring),
        recurrence_day=COALESCE(?,recurrence_day),
        confirmation_status=COALESCE(?,confirmation_status),
        rejection_reason=COALESCE(?,rejection_reason),
        confirmed_at=CASE WHEN ? IN ('confirmed','rejected') THEN datetime('now') ELSE confirmed_at END,
        updated_at=datetime('now') WHERE id=?
    `).run(title||null, description||null, status||null, priority||null, due_date||null, is_recurring !== undefined ? (is_recurring ? 1 : 0) : null, recurrence_day ?? null, confirmation_status||null, rejection_reason||null, confirmation_status||'none', taskId);
    if (Array.isArray(assignee_ids)) {
      db.prepare("DELETE FROM task_assignees WHERE task_id = ?").run(taskId);
      const ins = db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)");
      for (const uid of assignee_ids) ins.run(taskId, uid);
    }
    logAction(req, { action: "update", entityType: "task", entityId: Number(taskId), entityName: title, details: JSON.stringify({ status, priority, confirmation_status }) });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/tasks/:id", (req, res) => {
  try {
    const t = db.prepare("SELECT title FROM tasks WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "task", entityId: Number(req.params.id), entityName: t?.title });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== TASK COMMENTS ======================

app.get("/api/tasks/:id/comments", (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT tc.id, tc.task_id, tc.user_id, tc.text, tc.created_at,
             u.name || ' ' || u.surname as author_name,
             u.avatar_url as author_avatar_url
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `).all(req.params.id);
    res.json(comments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tasks/:id/comments", (req, res) => {
  try {
    const { user_id, text } = req.body;
    if (!text || !user_id) return res.status(400).json({ error: "user_id and text required" });
    const result = db.prepare(
      "INSERT INTO task_comments (task_id, user_id, text) VALUES (?, ?, ?)"
    ).run(req.params.id, user_id, text);
    // Parse @mentions and notify
    parseMentionsAndNotify(text, req.params.id, user_id);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/tasks/comments/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM task_comments WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== TASK ATTACHMENTS ======================

app.use("/uploads", express.static(uploadsDir));

app.get("/api/tasks/:id/attachments", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC").all(req.params.id);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tasks/:id/attachments", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const result = db.prepare(
      "INSERT INTO task_attachments (task_id, filename, original_name, path, size) VALUES (?, ?, ?, ?, ?)"
    ).run(req.params.id, req.file.filename, req.file.originalname, "/uploads/" + req.file.filename, req.file.size);
    res.json({ id: result.lastInsertRowid, filename: req.file.filename, original_name: req.file.originalname, path: "/uploads/" + req.file.filename });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/tasks/attachments/:id", (req, res) => {
  try {
    const att = db.prepare("SELECT * FROM task_attachments WHERE id = ?").get(req.params.id);
    if (att) {
      db.prepare("DELETE FROM task_attachments WHERE id = ?").run(req.params.id);
      try { fs.unlinkSync(path.join(uploadsDir, att.filename)); } catch {}
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== TASK CHECKLIST ======================

app.get("/api/tasks/:id/checklist", (req, res) => {
  try {
    const items = db.prepare("SELECT * FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order, id").all(req.params.id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tasks/:id/checklist", (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as m FROM task_checklist_items WHERE task_id = ?").get(req.params.id);
    const result = db.prepare(
      "INSERT INTO task_checklist_items (task_id, title, sort_order) VALUES (?, ?, ?)"
    ).run(req.params.id, title, (maxOrder?.m || 0) + 1);
    res.json({ id: result.lastInsertRowid, task_id: parseInt(req.params.id), title, is_completed: 0, sort_order: (maxOrder?.m || 0) + 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/tasks/checklist/:id", (req, res) => {
  try {
    const { title, is_completed } = req.body;
    db.prepare(`
      UPDATE task_checklist_items SET title=COALESCE(?,title), is_completed=COALESCE(?,is_completed) WHERE id=?
    `).run(title || null, is_completed !== undefined ? is_completed : null, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/tasks/checklist/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM task_checklist_items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Process recurring tasks: create new copies for today if needed
app.post("/api/tasks/process-recurring", (req, res) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const todayStr = today.toISOString().split('T')[0];
    const recurring = db.prepare(`
      SELECT * FROM tasks WHERE is_recurring = 1 AND recurrence_day = ? AND status IN ('done', 'archive')
    `).all(dayOfWeek);

    let created = 0;
    for (const task of recurring) {
      // Check if already created today
      const exists = db.prepare(`
        SELECT id FROM tasks WHERE title = ? AND is_recurring = 0 AND created_at >= ? AND created_at < date(?, '+1 day')
      `).get(task.title, todayStr, todayStr);
      if (exists) continue;

      const result = db.prepare(
        "INSERT INTO tasks (title, description, status, priority, created_by, is_recurring, recurrence_day) VALUES (?, ?, 'todo', ?, ?, 0, NULL)"
      ).run(task.title, task.description, task.priority, task.created_by);
      // Copy assignees
      const assignees = db.prepare("SELECT user_id FROM task_assignees WHERE task_id = ?").all(task.id);
      const ins = db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)");
      for (const a of assignees) ins.run(result.lastInsertRowid, a.user_id);
      // Copy checklist items
      const checkItems = db.prepare("SELECT title, sort_order FROM task_checklist_items WHERE task_id = ?").all(task.id);
      const insCheck = db.prepare("INSERT INTO task_checklist_items (task_id, title, sort_order) VALUES (?, ?, ?)");
      for (const item of checkItems) insCheck.run(result.lastInsertRowid, item.title, item.sort_order);
      created++;
    }
    res.json({ success: true, created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== ADMIN CRUD ======================

// Users: create
app.post("/api/users", (req, res) => {
  try {
    const { name, surname, phone, email, password, role } = req.body;
    if (!name || !surname) return res.status(400).json({ error: "name and surname required" });
    const roleMap = { admin: 1, umo_head: 2, teacher: 3 };
    const role_id = roleMap[role] ?? 3;
    const pwd = password || surname.toLowerCase() + Date.now();
    const result = db.prepare(
      "INSERT INTO users (name, surname, phone, email, password, role_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(name, surname, phone || null, email || null, pwd, role_id);
    logAction(req, { action: "create", entityType: "user", entityId: result.lastInsertRowid, entityName: name + " " + surname, details: JSON.stringify({ role, email }) });
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Users: update
app.put("/api/users/:id", (req, res) => {
  try {
    const { name, surname, phone, email, role, password, current_password } = req.body;
    const roleMap = { admin: 1, umo_head: 2, teacher: 3 };
    const role_id = role ? roleMap[role] : null;

    // If changing password, verify current password
    if (password) {
      const user = db.prepare("SELECT password FROM users WHERE id = ?").get(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (current_password && user.password !== current_password) {
        return res.status(400).json({ error: "Текущий пароль неверный" });
      }
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(password, req.params.id);
    }

    db.prepare(`
      UPDATE users SET
        name    = COALESCE(?, name),
        surname = COALESCE(?, surname),
        phone   = COALESCE(?, phone),
        email   = COALESCE(?, email),
        role_id = COALESCE(?, role_id)
      WHERE id = ?
    `).run(name || null, surname || null, phone || null, email || null, role_id, req.params.id);
    logAction(req, { action: "update", entityType: "user", entityId: Number(req.params.id), entityName: (name || '') + ' ' + (surname || ''), details: JSON.stringify({ role, email }) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Users: delete (archive — set role to inactive flag via status col doesn't exist, so just delete)
app.delete("/api/users/:id", (req, res) => {
  try {
    const u = db.prepare("SELECT name, surname FROM users WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "user", entityId: Number(req.params.id), entityName: u ? u.name + " " + u.surname : null });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Students: update
app.put("/api/students/:id", (req, res) => {
  try {
    const { full_name, phone, parent_phone, parent_name, group_id, status } = req.body;
    db.prepare(`
      UPDATE students SET
        full_name    = COALESCE(?, full_name),
        phone        = COALESCE(?, phone),
        parent_phone = COALESCE(?, parent_phone),
        parent_name  = COALESCE(?, parent_name),
        group_id     = COALESCE(?, group_id),
        status       = COALESCE(?, status)
      WHERE id = ?
    `).run(full_name || null, phone || null, parent_phone || null, parent_name || null, group_id || null, status || null, req.params.id);
    logAction(req, { action: "update", entityType: "student", entityId: Number(req.params.id), entityName: full_name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Subjects: create
app.post("/api/subjects", (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const result = db.prepare("INSERT INTO subjects (name, type) VALUES (?, ?)").run(name, type || "mandatory");
    logAction(req, { action: "create", entityType: "subject", entityId: result.lastInsertRowid, entityName: name });
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Subjects: update
app.put("/api/subjects/:id", (req, res) => {
  try {
    const { name, type } = req.body;
    db.prepare("UPDATE subjects SET name = COALESCE(?, name), type = COALESCE(?, type) WHERE id = ?")
      .run(name || null, type || null, req.params.id);
    logAction(req, { action: "update", entityType: "subject", entityId: Number(req.params.id), entityName: name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Subjects: delete
app.delete("/api/subjects/:id", (req, res) => {
  try {
    const subj = db.prepare("SELECT name FROM subjects WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM subjects WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "subject", entityId: Number(req.params.id), entityName: subj?.name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Profiles: create
app.post("/api/profiles", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const result = db.prepare("INSERT INTO profiles (name) VALUES (?)").run(name);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== CURATORSHIP EXTENDED ======================

app.get("/api/curatorship/my-groups", (req, res) => {
  try {
    const { curator_id } = req.query;
    if (!curator_id) return res.status(400).json({ error: "curator_id required" });
    const groups = db.prepare(`
      SELECT g.id, g.name, g.profile_id,
             p.name as profile_name,
             COUNT(s.id) as students_count
      FROM groups g
      LEFT JOIN profiles p ON g.profile_id = p.id
      LEFT JOIN students s ON s.group_id = g.id
      WHERE g.curator_id = ?
      GROUP BY g.id, g.name, g.profile_id, p.name
      ORDER BY g.name
    `).all(parseInt(curator_id));
    res.json(groups);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/curatorship/my-students", (req, res) => {
  try {
    const { curator_id } = req.query;
    if (!curator_id) return res.status(400).json({ error: "curator_id required" });
    const students = db.prepare(`
      SELECT s.id, s.full_name, s.phone, s.parent_phone, s.parent_name, s.status, s.group_id,
             g.name as group_name,
             (SELECT SUM(e.score) FROM ent_results e WHERE e.student_id = s.id AND e.month = (SELECT MAX(e2.month) FROM ent_results e2 WHERE e2.student_id = s.id)) as last_ent_score
      FROM students s
      JOIN groups g ON s.group_id = g.id
      WHERE g.curator_id = ?
      ORDER BY g.name, s.full_name
    `).all(parseInt(curator_id));
    res.json(students);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/curatorship/metrics", (req, res) => {
  try {
    const { curator_id } = req.query;
    if (!curator_id) return res.status(400).json({ error: "curator_id required" });

    const groups = db.prepare("SELECT id FROM groups WHERE curator_id = ?").all(parseInt(curator_id));
    const groupIds = groups.map(g => g.id);
    if (!groupIds.length) return res.json({ groups_count: 0, students_count: 0, attendance: null, ent_delta: null, at_risk: 0 });

    const gPlaceholders = groupIds.map(() => "?").join(",");
    const students = db.prepare(`SELECT id FROM students WHERE group_id IN (${gPlaceholders})`).all(...groupIds);
    const studentIds = students.map(s => s.id);
    if (!studentIds.length) return res.json({ groups_count: groupIds.length, students_count: 0, attendance: null, ent_delta: null, at_risk: 0 });

    const sPlaceholders = studentIds.map(() => "?").join(",");

    // Attendance this week
    const today = new Date();
    const day = today.getDay();
    const daysToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const monStr = monday.toISOString().slice(0, 10);
    const sunStr = sunday.toISOString().slice(0, 10);

    const att = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE a.student_id IN (${sPlaceholders}) AND l.date BETWEEN ? AND ?
    `).get(...studentIds, monStr, sunStr);
    const attendancePct = att.total > 0 ? Math.round(att.present * 100 / att.total) : null;

    // ENT delta: current month avg vs last month avg
    const curMonth = today.toISOString().slice(0, 7);
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = prevDate.toISOString().slice(0, 7);

    const curAvg = db.prepare(`SELECT AVG(score) as avg FROM ent_results WHERE student_id IN (${sPlaceholders}) AND month LIKE ?`).get(...studentIds, curMonth + "%");
    const prevAvg = db.prepare(`SELECT AVG(score) as avg FROM ent_results WHERE student_id IN (${sPlaceholders}) AND month LIKE ?`).get(...studentIds, prevMonth + "%");
    const entDelta = curAvg.avg != null && prevAvg.avg != null
      ? Math.round((curAvg.avg - prevAvg.avg) * 10) / 10 : null;

    // At-risk: more than 3 absences in last 30 days
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(today.getDate() - 30);
    const thirtyStr = thirtyAgo.toISOString().slice(0, 10);

    const atRisk = db.prepare(`
      SELECT COUNT(DISTINCT a.student_id) as cnt
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE a.student_id IN (${sPlaceholders}) AND a.status = 'absent' AND l.date >= ?
      GROUP BY a.student_id HAVING COUNT(*) > 3
    `).all(...studentIds, thirtyStr);

    res.json({
      groups_count: groupIds.length,
      students_count: studentIds.length,
      attendance: attendancePct,
      ent_delta: entDelta,
      at_risk: atRisk.length,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/curatorship/student/:id/details", (req, res) => {
  try {
    const studentId = parseInt(req.params.id);

    const entHistory = db.prepare(`
      SELECT e.month, e.score, subj.name as subject_name
      FROM ent_results e
      JOIN subjects subj ON e.subject_id = subj.id
      WHERE e.student_id = ?
      ORDER BY e.month
    `).all(studentId);

    const absences = db.prepare(`
      SELECT l.date, a.comment, a.status, a.lateness
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE a.student_id = ? AND a.status = 'absent'
      ORDER BY l.date DESC
    `).all(studentId);

    const student = db.prepare("SELECT group_id FROM students WHERE id = ?").get(studentId);
    const notes = student ? db.prepare(`
      SELECT cl.date, cl.title, cl.description, cl.type,
             u.name || ' ' || u.surname as author
      FROM curatorship_logs cl
      JOIN users u ON cl.curator_id = u.id
      WHERE cl.group_id = ?
      ORDER BY cl.date DESC
      LIMIT 20
    `).all(student.group_id) : [];

    res.json({ ent_history: entHistory, absences, notes });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Student monthly stats (per-subject breakdown for date range)
app.get("/api/curatorship/student/:id/monthly-stats", (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    const stats = db.prepare(`
      SELECT subj.name as subject_name,
        COUNT(a.id) as total_lessons,
        SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.lateness='late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.homework='done' THEN 1 ELSE 0 END) as homework_done
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sch ON l.schedule_id = sch.id
      JOIN subjects subj ON sch.subject_id = subj.id
      WHERE a.student_id = ? AND l.date BETWEEN ? AND ?
      GROUP BY subj.id, subj.name
      ORDER BY subj.name
    `).all(studentId, from, to);

    // Overall summary
    const overall = db.prepare(`
      SELECT COUNT(a.id) as total_lessons,
        SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.lateness='late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.homework='done' THEN 1 ELSE 0 END) as homework_done
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE a.student_id = ? AND l.date BETWEEN ? AND ?
    `).get(studentId, from, to);

    res.json({ subjects: stats, overall });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Attendance grid: students × dates for a group
app.get("/api/curatorship/attendance-grid", (req, res) => {
  try {
    const { group_id, from, to } = req.query;
    if (!group_id || !from || !to) return res.status(400).json({ error: "group_id, from, to required" });

    const students = db.prepare(`
      SELECT id, full_name FROM students WHERE group_id = ? AND status = 'active' ORDER BY full_name
    `).all(parseInt(group_id));

    if (!students.length) return res.json({ dates: [], students: [] });

    // Get all unique lesson dates for this group in range
    const dates = db.prepare(`
      SELECT DISTINCT l.date
      FROM lessons l
      JOIN schedule sch ON l.schedule_id = sch.id
      WHERE sch.group_id = ? AND l.date BETWEEN ? AND ?
      ORDER BY l.date
    `).all(parseInt(group_id), from, to).map(r => r.date);

    const studentIds = students.map(s => s.id);
    const sPlaceholders = studentIds.map(() => "?").join(",");

    // Get all attendance records for these students in range
    const records = db.prepare(`
      SELECT a.student_id, l.date, a.status, a.lateness
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sch ON l.schedule_id = sch.id
      WHERE a.student_id IN (${sPlaceholders}) AND sch.group_id = ? AND l.date BETWEEN ? AND ?
    `).all(...studentIds, parseInt(group_id), from, to);

    // Build lookup: { student_id: { date: status } }
    const lookup = {};
    for (const r of records) {
      if (!lookup[r.student_id]) lookup[r.student_id] = {};
      lookup[r.student_id][r.date] = r.status === 'present' ? (r.lateness === 'late' ? 'late' : 'present') : 'absent';
    }

    const result = students.map(s => {
      const attendance = {};
      let present = 0, total = dates.length;
      for (const d of dates) {
        const val = lookup[s.id]?.[d] || null;
        attendance[d] = val;
        if (val === 'present' || val === 'late') present++;
      }
      return { id: s.id, full_name: s.full_name, attendance, total: `${present}/${total}` };
    });

    res.json({ dates, students: result });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== PARENT FEEDBACK ======================

app.get("/api/parent-feedback", (req, res) => {
  try {
    const { curator_id, student_id } = req.query;
    let query = `
      SELECT pf.*, s.full_name as student_name, s.parent_phone, s.parent_name,
             u.name || ' ' || u.surname as curator_name,
             g.name as group_name
      FROM parent_feedback pf
      JOIN students s ON pf.student_id = s.id
      JOIN users u ON pf.curator_id = u.id
      LEFT JOIN groups g ON s.group_id = g.id
    `;
    const conditions = [];
    const params = [];
    if (curator_id) { conditions.push("pf.curator_id = ?"); params.push(parseInt(curator_id)); }
    if (student_id) { conditions.push("pf.student_id = ?"); params.push(parseInt(student_id)); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY pf.date DESC";
    res.json(db.prepare(query).all(...params));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/parent-feedback", (req, res) => {
  try {
    const { student_id, curator_id, date, notes, status } = req.body;
    if (!student_id || !curator_id || !date) return res.status(400).json({ error: "student_id, curator_id, date required" });
    const result = db.prepare(
      "INSERT INTO parent_feedback (student_id, curator_id, date, notes, status) VALUES (?, ?, ?, ?, ?)"
    ).run(parseInt(student_id), parseInt(curator_id), date, notes || null, status || "needs_callback");
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/parent-feedback/:id", (req, res) => {
  try {
    const { notes, status, date } = req.body;
    db.prepare("UPDATE parent_feedback SET notes=COALESCE(?,notes), status=COALESCE(?,status), date=COALESCE(?,date) WHERE id=?")
      .run(notes || null, status || null, date || null, req.params.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/parent-feedback/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM parent_feedback WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== CURATOR CALL TASKS ======================

// Generate call tasks for current month (auto-creates if not existing)
app.post("/api/curatorship/call-tasks/generate", (req, res) => {
  try {
    const { curator_id } = req.body;
    if (!curator_id) return res.status(400).json({ error: "curator_id required" });

    const month = new Date().toISOString().slice(0, 7); // e.g. '2026-03'
    const groups = db.prepare("SELECT id FROM groups WHERE curator_id = ?").all(parseInt(curator_id));
    const groupIds = groups.map(g => g.id);
    if (!groupIds.length) return res.json({ generated: 0 });

    const gPlaceholders = groupIds.map(() => "?").join(",");
    const students = db.prepare(`SELECT id FROM students WHERE group_id IN (${gPlaceholders}) AND status = 'active'`).all(...groupIds);

    const insert = db.prepare(
      "INSERT OR IGNORE INTO curator_call_tasks (curator_id, student_id, month) VALUES (?, ?, ?)"
    );
    let generated = 0;
    const tx = db.transaction(() => {
      for (const s of students) {
        const result = insert.run(parseInt(curator_id), s.id, month);
        if (result.changes > 0) generated++;
      }
    });
    tx();

    res.json({ generated, total: students.length, month });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get call tasks for a curator and month
app.get("/api/curatorship/call-tasks", (req, res) => {
  try {
    const { curator_id, month } = req.query;
    if (!curator_id) return res.status(400).json({ error: "curator_id required" });
    const m = month || new Date().toISOString().slice(0, 7);

    const tasks = db.prepare(`
      SELECT ct.id, ct.student_id, ct.status, ct.call_result, ct.notes, ct.completed_at,
             s.full_name, s.parent_phone, s.parent_name, g.name as group_name
      FROM curator_call_tasks ct
      JOIN students s ON ct.student_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE ct.curator_id = ? AND ct.month = ?
      ORDER BY ct.status ASC, s.full_name ASC
    `).all(parseInt(curator_id), m);

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    res.json({ tasks, total, completed, month: m });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Complete a call task
app.patch("/api/curatorship/call-tasks/:id", (req, res) => {
  try {
    const { status, call_result, notes } = req.body;
    const newStatus = status || 'completed';
    if (newStatus === 'completed') {
      if (!notes || notes.trim().length < 20) {
        return res.status(400).json({ error: "Комментарий должен содержать минимум 20 символов" });
      }
      if (!call_result) {
        return res.status(400).json({ error: "Выберите итог обзвона" });
      }
    }
    db.prepare(
      "UPDATE curator_call_tasks SET status = ?, call_result = COALESCE(?, call_result), notes = COALESCE(?, notes), completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END WHERE id = ?"
    ).run(newStatus, call_result || null, notes || null, newStatus, parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Admin: summary of all curators' call progress
app.get("/api/curatorship/call-tasks/summary", (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const summary = db.prepare(`
      SELECT u.id as curator_id,
             u.name || ' ' || u.surname as curator_name,
             g_agg.group_names,
             COUNT(ct.id) as total_tasks,
             SUM(CASE WHEN ct.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
      FROM curator_call_tasks ct
      JOIN users u ON ct.curator_id = u.id
      LEFT JOIN (
        SELECT g.curator_id, GROUP_CONCAT(DISTINCT g.name) as group_names
        FROM groups g
        WHERE g.curator_id IS NOT NULL
        GROUP BY g.curator_id
      ) g_agg ON g_agg.curator_id = u.id
      WHERE ct.month = ?
      GROUP BY u.id, u.name, u.surname
      ORDER BY u.name, u.surname
    `).all(month);

    res.json({ summary, month });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== TEACHER STUDENT FEEDBACK ======================

// Generate feedback tasks for a teacher (from schedule)
app.post("/api/teacher-feedback/generate", (req, res) => {
  try {
    const { teacher_id } = req.body;
    if (!teacher_id) return res.status(400).json({ error: "teacher_id required" });

    const month = new Date().toISOString().slice(0, 7);
    // Find all groups & subjects this teacher teaches
    const scheduleEntries = db.prepare(`
      SELECT DISTINCT s.group_id, s.subject_id FROM schedule s WHERE s.teacher_id = ?
    `).all(parseInt(teacher_id));

    if (!scheduleEntries.length) return res.json({ generated: 0, total: 0, month });

    const insert = db.prepare(
      "INSERT OR IGNORE INTO teacher_student_feedback (teacher_id, student_id, subject_id, month) VALUES (?, ?, ?, ?)"
    );
    let generated = 0;
    let total = 0;
    const tx = db.transaction(() => {
      for (const entry of scheduleEntries) {
        const students = db.prepare(
          "SELECT id FROM students WHERE group_id = ? AND status = 'active'"
        ).all(entry.group_id);
        for (const st of students) {
          total++;
          const result = insert.run(parseInt(teacher_id), st.id, entry.subject_id, month);
          if (result.changes > 0) generated++;
        }
      }
    });
    tx();

    res.json({ generated, total, month });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get teacher's feedback tasks for a month
app.get("/api/teacher-feedback", (req, res) => {
  try {
    const { teacher_id, month } = req.query;
    if (!teacher_id) return res.status(400).json({ error: "teacher_id required" });
    const m = month || new Date().toISOString().slice(0, 7);

    const tasks = db.prepare(`
      SELECT tf.id, tf.student_id, tf.subject_id, tf.comment, tf.created_at,
             s.full_name, s.parent_phone, s.parent_name, g.name as group_name,
             subj.name as subject_name
      FROM teacher_student_feedback tf
      JOIN students s ON tf.student_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON tf.subject_id = subj.id
      WHERE tf.teacher_id = ? AND tf.month = ?
      ORDER BY g.name, s.full_name, subj.name
    `).all(parseInt(teacher_id), m);

    const total = tasks.length;
    const completed = tasks.filter(t => t.comment && t.comment.trim().length > 0).length;

    res.json({ tasks, total, completed, month: m });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Update teacher feedback comment
app.patch("/api/teacher-feedback/:id", (req, res) => {
  try {
    const { comment } = req.body;
    db.prepare(
      "UPDATE teacher_student_feedback SET comment = ? WHERE id = ?"
    ).run(comment || null, parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Curator: get all teacher feedbacks for a student in a month
app.get("/api/teacher-feedback/by-student", (req, res) => {
  try {
    const { student_id, month } = req.query;
    if (!student_id) return res.status(400).json({ error: "student_id required" });
    const m = month || new Date().toISOString().slice(0, 7);

    const feedbacks = db.prepare(`
      SELECT tf.id, tf.comment, tf.created_at,
             u.name || ' ' || u.surname as teacher_name,
             subj.name as subject_name
      FROM teacher_student_feedback tf
      JOIN users u ON tf.teacher_id = u.id
      LEFT JOIN subjects subj ON tf.subject_id = subj.id
      WHERE tf.student_id = ? AND tf.month = ? AND tf.comment IS NOT NULL AND tf.comment != ''
      ORDER BY subj.name
    `).all(parseInt(student_id), m);

    res.json(feedbacks);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Admin: summary of all teachers' feedback completion
app.get("/api/teacher-feedback/summary", (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const summary = db.prepare(`
      SELECT u.id as teacher_id,
             u.name || ' ' || u.surname as teacher_name,
             COUNT(tf.id) as total_tasks,
             SUM(CASE WHEN tf.comment IS NOT NULL AND tf.comment != '' THEN 1 ELSE 0 END) as completed_tasks
      FROM teacher_student_feedback tf
      JOIN users u ON tf.teacher_id = u.id
      WHERE tf.month = ?
      GROUP BY u.id, u.name, u.surname
      ORDER BY u.name, u.surname
    `).all(month);

    res.json({ summary, month });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== STORAGE ======================

app.get("/api/storage/folders", (req, res) => {
  try {
    const parentId = req.query.parent_id;
    let rows;
    if (parentId === undefined || parentId === "" || parentId === "null") {
      rows = db.prepare("SELECT * FROM storage_folders WHERE parent_id IS NULL ORDER BY name ASC").all();
    } else {
      rows = db.prepare("SELECT * FROM storage_folders WHERE parent_id = ? ORDER BY name ASC").all(Number(parentId));
    }
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/storage/folders", (req, res) => {
  try {
    const { name, parent_id, creator_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Folder name is required" });
    const result = db.prepare(
      "INSERT INTO storage_folders (name, parent_id, creator_id) VALUES (?, ?, ?)"
    ).run(name.trim(), parent_id ?? null, creator_id ?? null);
    logAction(req, { action: "create", entityType: "storage_folder", entityId: result.lastInsertRowid, entityName: name.trim(), userId: creator_id });
    res.json({ id: result.lastInsertRowid, name: name.trim(), parent_id: parent_id ?? null, creator_id: creator_id ?? null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch("/api/storage/folders/:id", (req, res) => {
  try {
    const { name, icon } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push("name = ?"); params.push(name.trim()); }
    if (icon !== undefined) { updates.push("icon = ?"); params.push(icon); }
    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(req.params.id);
    db.prepare(`UPDATE storage_folders SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/storage/folders/:id", (req, res) => {
  try {
    // Gather all physical files inside this folder tree before cascade delete
    const allItems = db.prepare(`
      WITH RECURSIVE sub(id) AS (
        SELECT id FROM storage_folders WHERE id = ?
        UNION ALL
        SELECT f.id FROM storage_folders f JOIN sub ON f.parent_id = sub.id
      )
      SELECT i.url_or_path, i.type FROM storage_items i
      JOIN sub ON i.folder_id = sub.id
    `).all(req.params.id);
    for (const item of allItems) {
      if (item.type === "file") {
        try { fs.unlinkSync(path.join(storageUploadsDir, path.basename(item.url_or_path))); } catch {}
      }
    }
    db.prepare("DELETE FROM storage_folders WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "storage_folder", entityId: Number(req.params.id) });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/storage/items", (req, res) => {
  try {
    const folderId = req.query.folder_id;
    let rows;
    if (folderId === undefined || folderId === "" || folderId === "null") {
      rows = db.prepare("SELECT * FROM storage_items WHERE folder_id IS NULL ORDER BY created_at DESC").all();
    } else {
      rows = db.prepare("SELECT * FROM storage_items WHERE folder_id = ? ORDER BY created_at DESC").all(Number(folderId));
    }
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/storage/items/link", (req, res) => {
  try {
    const { folder_id, name, url_or_path, uploaded_by } = req.body;
    if (!name || !url_or_path) return res.status(400).json({ error: "name and url_or_path required" });
    const result = db.prepare(
      "INSERT INTO storage_items (folder_id, name, type, url_or_path, uploaded_by) VALUES (?, ?, 'link', ?, ?)"
    ).run(folder_id ?? null, name.trim(), url_or_path.trim(), uploaded_by ?? null);
    res.json({ id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/storage/items/file", storageUpload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { folder_id, uploaded_by } = req.body;
    const url_or_path = `/uploads/storage/${req.file.filename}`;
    const result = db.prepare(
      "INSERT INTO storage_items (folder_id, name, type, url_or_path, uploaded_by) VALUES (?, ?, 'file', ?, ?)"
    ).run(folder_id ? Number(folder_id) : null, req.file.originalname, url_or_path, uploaded_by ? Number(uploaded_by) : null);
    res.json({ id: result.lastInsertRowid, url_or_path, name: req.file.originalname });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch("/api/storage/items/:id", (req, res) => {
  try {
    const { name, icon } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push("name = ?"); params.push(name.trim()); }
    if (icon !== undefined) { updates.push("icon = ?"); params.push(icon); }
    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(req.params.id);
    db.prepare(`UPDATE storage_items SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/storage/items/:id", (req, res) => {
  try {
    const item = db.prepare("SELECT * FROM storage_items WHERE id = ?").get(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.type === "file") {
      try { fs.unlinkSync(path.join(storageUploadsDir, path.basename(item.url_or_path))); } catch {}
    }
    db.prepare("DELETE FROM storage_items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== AVATAR UPLOAD ======================

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG/PNG/WebP images are allowed"));
  },
});

app.post("/api/users/:id/avatar", avatarUpload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file provided" });
    const userId = req.params.id;
    const user = db.prepare("SELECT id, avatar_url FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Delete old avatar file if exists
    if (user.avatar_url) {
      const oldPath = path.join(__dirname, user.avatar_url);
      try { fs.unlinkSync(oldPath); } catch {}
    }

    const filename = `avatar_${userId}_${Date.now()}.webp`;
    const filePath = path.join(avatarsDir, filename);

    // Resize & crop to 400x400 square, compress as webp
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: "cover", position: "center" })
      .webp({ quality: 80 })
      .toFile(filePath);

    const avatarUrl = `/uploads/avatars/${filename}`;
    db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(avatarUrl, userId);
    res.json({ avatar_url: avatarUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/users/:id/avatar", (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.prepare("SELECT id, avatar_url FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.avatar_url) {
      const filePath = path.join(__dirname, user.avatar_url);
      try { fs.unlinkSync(filePath); } catch {}
    }
    db.prepare("UPDATE users SET avatar_url = NULL WHERE id = ?").run(userId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== HEALTH + ROLES ======================

// ====================== WIKI ======================

// Categories
app.get("/api/wiki/categories", (req, res) => {
  try {
    const cats = db.prepare("SELECT * FROM wiki_categories ORDER BY order_index ASC, id ASC").all();
    res.json(cats);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/wiki/categories", (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
    const maxOrder = db.prepare("SELECT COALESCE(MAX(order_index), 0) as m FROM wiki_categories").get().m;
    const result = db.prepare("INSERT INTO wiki_categories (name, order_index) VALUES (?, ?)").run(name.trim(), maxOrder + 1);
    logAction(req, { action: "create", entityType: "wiki_category", entityId: result.lastInsertRowid, entityName: name.trim() });
    res.json({ id: result.lastInsertRowid, name: name.trim(), order_index: maxOrder + 1 });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/wiki/categories/:id", (req, res) => {
  try {
    const { name, order_index } = req.body;
    const id = parseInt(req.params.id);
    if (name !== undefined) db.prepare("UPDATE wiki_categories SET name = ? WHERE id = ?").run(name.trim(), id);
    if (order_index !== undefined) db.prepare("UPDATE wiki_categories SET order_index = ? WHERE id = ?").run(order_index, id);
    logAction(req, { action: "update", entityType: "wiki_category", entityId: id, entityName: name?.trim() });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/wiki/categories/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cat = db.prepare("SELECT name FROM wiki_categories WHERE id = ?").get(id);
    db.prepare("DELETE FROM wiki_articles WHERE category_id = ?").run(id);
    db.prepare("DELETE FROM wiki_categories WHERE id = ?").run(id);
    logAction(req, { action: "delete", entityType: "wiki_category", entityId: id, entityName: cat?.name });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Articles
app.get("/api/wiki/articles", (req, res) => {
  try {
    const { category_id } = req.query;
    let articles;
    if (category_id) {
      articles = db.prepare(`
        SELECT a.*, u.name || ' ' || u.surname as author_name
        FROM wiki_articles a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.category_id = ?
        ORDER BY a.title ASC
      `).all(parseInt(category_id));
    } else {
      articles = db.prepare(`
        SELECT a.*, u.name || ' ' || u.surname as author_name, c.name as category_name
        FROM wiki_articles a
        LEFT JOIN users u ON a.author_id = u.id
        LEFT JOIN wiki_categories c ON a.category_id = c.id
        ORDER BY c.order_index ASC, a.title ASC
      `).all();
    }
    res.json(articles);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/wiki/articles/:id", (req, res) => {
  try {
    const article = db.prepare(`
      SELECT a.*, u.name || ' ' || u.surname as author_name, c.name as category_name
      FROM wiki_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN wiki_categories c ON a.category_id = c.id
      WHERE a.id = ?
    `).get(parseInt(req.params.id));
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/wiki/articles", (req, res) => {
  try {
    const { category_id, title, content, author_id } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
    if (!category_id) return res.status(400).json({ error: "Category is required" });
    const result = db.prepare(
      "INSERT INTO wiki_articles (category_id, title, content, author_id) VALUES (?, ?, ?, ?)"
    ).run(parseInt(category_id), title.trim(), content || "", author_id ? parseInt(author_id) : null);
    const article = db.prepare(`
      SELECT a.*, u.name || ' ' || u.surname as author_name
      FROM wiki_articles a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);
    logAction(req, { action: "create", entityType: "wiki_article", entityId: result.lastInsertRowid, entityName: title.trim(), userId: author_id });
    res.json(article);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/wiki/articles/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, content, category_id } = req.body;
    const updates = [];
    const params = [];
    if (title !== undefined) { updates.push("title = ?"); params.push(title.trim()); }
    if (content !== undefined) { updates.push("content = ?"); params.push(content); }
    if (category_id !== undefined) { updates.push("category_id = ?"); params.push(parseInt(category_id)); }
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE wiki_articles SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    const article = db.prepare(`
      SELECT a.*, u.name || ' ' || u.surname as author_name, c.name as category_name
      FROM wiki_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN wiki_categories c ON a.category_id = c.id
      WHERE a.id = ?
    `).get(id);
    logAction(req, { action: "update", entityType: "wiki_article", entityId: id, entityName: article?.title });
    res.json(article);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/wiki/articles/:id", (req, res) => {
  try {
    const art = db.prepare("SELECT title FROM wiki_articles WHERE id = ?").get(parseInt(req.params.id));
    db.prepare("DELETE FROM wiki_articles WHERE id = ?").run(parseInt(req.params.id));
    logAction(req, { action: "delete", entityType: "wiki_article", entityId: parseInt(req.params.id), entityName: art?.title });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/health", (req, res) => {
  try {
    const startMs = Date.now();
    db.prepare("SELECT 1").get();
    const dbResponseMs = Date.now() - startMs;

    const uptimeSeconds = Math.floor(process.uptime());

    // Calculate uploads directory size
    function dirSize(dir) {
      let total = 0;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) total += dirSize(full);
          else try { total += fs.statSync(full).size; } catch {}
        }
      } catch {}
      return total;
    }

    const dbPath = path.join(__dirname, "database.sqlite");
    let dbSize = 0;
    try { dbSize = fs.statSync(dbPath).size; } catch {}
    const uploadsSize = dirSize(uploadsDir);

    const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    const studentCount = db.prepare("SELECT COUNT(*) as c FROM students").get().c;

    res.json({
      status: "ok",
      uptime_seconds: uptimeSeconds,
      db_response_ms: dbResponseMs,
      db_size_bytes: dbSize,
      uploads_size_bytes: uploadsSize,
      total_size_bytes: dbSize + uploadsSize,
      user_count: userCount,
      student_count: studentCount,
      memory: process.memoryUsage(),
      node_version: process.version,
    });
  } catch (e) {
    res.status(500).json({ status: "error", error: e.message });
  }
});

// ====================== DYNAMIC TABLES ======================

app.get("/api/dynamic-tables", (req, res) => {
  try {
    const { user_id } = req.query;
    const uid = user_id ? parseInt(user_id) : null;
    // Get user role
    let userRole = null;
    if (uid) {
      const u = db.prepare("SELECT r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?").get(uid);
      userRole = u ? u.role : null;
    }
    // Return tables visible to this user
    const tables = db.prepare(`
      SELECT dt.*, u.name || ' ' || u.surname as creator_name
      FROM dynamic_tables dt
      LEFT JOIN users u ON dt.creator_id = u.id
      ORDER BY dt.updated_at DESC
    `).all();

    const filtered = tables.filter(t => {
      if (userRole === 'admin' || userRole === 'umo_head') return true;
      if (t.creator_id === uid) return true;
      if (t.visibility === 'all_teachers') return true;
      if (t.visibility === 'readonly') return true;
      if (t.visibility === 'admin_only' && (userRole === 'admin' || userRole === 'umo_head')) return true;
      return false;
    });

    res.json(filtered);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/dynamic-tables", (req, res) => {
  try {
    const { creator_id, title, columns_json, visibility } = req.body;
    if (!creator_id || !title) return res.status(400).json({ error: "creator_id and title required" });
    const cols = typeof columns_json === 'string' ? columns_json : JSON.stringify(columns_json || []);
    const result = db.prepare(
      "INSERT INTO dynamic_tables (creator_id, title, columns_json, visibility) VALUES (?, ?, ?, ?)"
    ).run(parseInt(creator_id), title, cols, visibility || 'private');
    const newTable = db.prepare("SELECT dt.*, u.name || ' ' || u.surname as creator_name FROM dynamic_tables dt LEFT JOIN users u ON dt.creator_id = u.id WHERE dt.id = ?").get(result.lastInsertRowid);
    logAction(req, { action: "create", entityType: "dynamic_table", entityId: result.lastInsertRowid, entityName: title, userId: parseInt(creator_id) });
    res.json(newTable);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/dynamic-tables/:id", (req, res) => {
  try {
    const { title, columns_json, visibility } = req.body;
    const id = parseInt(req.params.id);
    const existing = db.prepare("SELECT * FROM dynamic_tables WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Table not found" });
    const cols = columns_json ? (typeof columns_json === 'string' ? columns_json : JSON.stringify(columns_json)) : existing.columns_json;
    db.prepare("UPDATE dynamic_tables SET title = ?, columns_json = ?, visibility = ?, updated_at = datetime('now') WHERE id = ?")
      .run(title || existing.title, cols, visibility || existing.visibility, id);
    const updated = db.prepare("SELECT dt.*, u.name || ' ' || u.surname as creator_name FROM dynamic_tables dt LEFT JOIN users u ON dt.creator_id = u.id WHERE dt.id = ?").get(id);
    logAction(req, { action: "update", entityType: "dynamic_table", entityId: id, entityName: title || existing.title });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/dynamic-tables/:id", (req, res) => {
  try {
    const tbl = db.prepare("SELECT title FROM dynamic_tables WHERE id = ?").get(parseInt(req.params.id));
    db.prepare("DELETE FROM dynamic_tables WHERE id = ?").run(parseInt(req.params.id));
    logAction(req, { action: "delete", entityType: "dynamic_table", entityId: parseInt(req.params.id), entityName: tbl?.title });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Dynamic table rows
app.get("/api/dynamic-tables/:id/rows", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM dynamic_table_rows WHERE table_id = ? ORDER BY sort_order, id").all(parseInt(req.params.id));
    res.json(rows.map(r => ({ ...r, row_data: JSON.parse(r.row_data || '{}') })));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/dynamic-tables/:id/rows", (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    const { row_data } = req.body;
    const data = typeof row_data === 'string' ? row_data : JSON.stringify(row_data || {});
    const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as m FROM dynamic_table_rows WHERE table_id = ?").get(tableId);
    const result = db.prepare("INSERT INTO dynamic_table_rows (table_id, row_data, sort_order) VALUES (?, ?, ?)")
      .run(tableId, data, (maxOrder?.m || 0) + 1);
    db.prepare("UPDATE dynamic_tables SET updated_at = datetime('now') WHERE id = ?").run(tableId);
    res.json({ id: result.lastInsertRowid, table_id: tableId, row_data: JSON.parse(data), sort_order: (maxOrder?.m || 0) + 1 });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/dynamic-table-rows/:id", (req, res) => {
  try {
    const rowId = parseInt(req.params.id);
    const { row_data } = req.body;
    const data = typeof row_data === 'string' ? row_data : JSON.stringify(row_data || {});
    db.prepare("UPDATE dynamic_table_rows SET row_data = ? WHERE id = ?").run(data, rowId);
    const row = db.prepare("SELECT * FROM dynamic_table_rows WHERE id = ?").get(rowId);
    if (row) {
      db.prepare("UPDATE dynamic_tables SET updated_at = datetime('now') WHERE id = ?").run(row.table_id);
    }
    res.json({ id: rowId, row_data: JSON.parse(data) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/dynamic-table-rows/:id", (req, res) => {
  try {
    const row = db.prepare("SELECT table_id FROM dynamic_table_rows WHERE id = ?").get(parseInt(req.params.id));
    db.prepare("DELETE FROM dynamic_table_rows WHERE id = ?").run(parseInt(req.params.id));
    if (row) {
      db.prepare("UPDATE dynamic_tables SET updated_at = datetime('now') WHERE id = ?").run(row.table_id);
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/roles", (req, res) => {
  try {
    const roles = db.prepare("SELECT * FROM roles ORDER BY id").all();
    const permissions = db.prepare(`
      SELECT rp.role_id, p.id as permission_id, p.key, p.name, p.description
      FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id
      ORDER BY rp.role_id, p.id
    `).all();
    const rolesWithPerms = roles.map(r => ({
      ...r,
      permissions: permissions.filter(p => p.role_id === r.id)
    }));
    res.json(rolesWithPerms);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== @MENTIONS HELPER ======================

function parseMentionsAndNotify(text, taskId, commentAuthorId) {
  const mentionRegex = /@(\S+)/g;
  let match;
  const mentioned = new Set();
  while ((match = mentionRegex.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    // Find user by name match (name, full_name pattern)
    const user = db.prepare(
      `SELECT id, name, surname FROM users WHERE LOWER(name) = ? OR LOWER(surname) = ? OR LOWER(name || '' || surname) = ? OR LOWER(name || '_' || surname) = ?`
    ).get(tag, tag, tag, tag);
    if (user && user.id !== commentAuthorId && !mentioned.has(user.id)) {
      mentioned.add(user.id);
      const author = db.prepare("SELECT name, surname FROM users WHERE id = ?").get(commentAuthorId);
      const authorName = author ? `${author.name} ${author.surname}` : 'Кто-то';
      createNotification(
        user.id,
        'mention',
        `${authorName} упомянул вас`,
        text.length > 100 ? text.substring(0, 100) + '...' : text,
        '/tasks'
      );
    }
  }
}

// ====================== BROADCAST CHANNELS ======================

app.get("/api/broadcasts", (req, res) => {
  try {
    const userId = req.query.user_id;
    const messages = db.prepare(`
      SELECT bm.*, u.name || ' ' || u.surname as author_name, u.avatar_url as author_avatar,
        CASE WHEN br.id IS NOT NULL THEN 1 ELSE 0 END as is_read
      FROM broadcast_messages bm
      JOIN users u ON bm.author_id = u.id
      LEFT JOIN broadcast_reads br ON br.message_id = bm.id AND br.user_id = ?
      ORDER BY bm.created_at DESC
      LIMIT 100
    `).all(userId || 0);
    res.json(messages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broadcasts/unread-count", (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.json({ count: 0 });
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM broadcast_messages bm
      WHERE NOT EXISTS (SELECT 1 FROM broadcast_reads br WHERE br.message_id = bm.id AND br.user_id = ?)
    `).get(userId);
    res.json({ count: result.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/broadcasts", (req, res) => {
  try {
    const { author_id, channel, title, content, priority } = req.body;
    if (!title || !author_id) return res.status(400).json({ error: "title and author_id required" });
    const result = db.prepare(
      "INSERT INTO broadcast_messages (author_id, channel, title, content, priority) VALUES (?, ?, ?, ?, ?)"
    ).run(author_id, channel || 'important', title, content || '', priority || 'normal');
    logAction(req, { action: "create", entityType: "broadcast", entityId: result.lastInsertRowid, entityName: title, userId: author_id });
    // Notify all users
    const allUsers = db.prepare("SELECT id FROM users").all();
    for (const u of allUsers) {
      if (u.id !== author_id) {
        createNotification(u.id, 'broadcast', `📢 ${title}`, content ? (content.length > 100 ? content.substring(0, 100) + '...' : content) : null, '/broadcasts');
      }
    }
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/broadcasts/:id/read", (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    db.prepare("INSERT OR IGNORE INTO broadcast_reads (message_id, user_id) VALUES (?, ?)").run(req.params.id, user_id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/broadcasts/:id", (req, res) => {
  try {
    const b = db.prepare("SELECT title FROM broadcast_messages WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM broadcast_messages WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "broadcast", entityId: Number(req.params.id), entityName: b?.title });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== ADMIN BANNERS ======================

app.get("/api/banners/active", (req, res) => {
  try {
    const banners = db.prepare(`
      SELECT ab.*, u.name || ' ' || u.surname as creator_name
      FROM admin_banners ab
      JOIN users u ON ab.created_by = u.id
      WHERE ab.is_active = 1 AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
      ORDER BY ab.created_at DESC
    `).all();
    res.json(banners);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/banners", (req, res) => {
  try {
    const banners = db.prepare(`
      SELECT ab.*, u.name || ' ' || u.surname as creator_name
      FROM admin_banners ab
      JOIN users u ON ab.created_by = u.id
      ORDER BY ab.created_at DESC
    `).all();
    res.json(banners);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/banners", (req, res) => {
  try {
    const { text, type, created_by, expires_at } = req.body;
    if (!text || !created_by) return res.status(400).json({ error: "text and created_by required" });
    const result = db.prepare(
      "INSERT INTO admin_banners (text, type, created_by, expires_at) VALUES (?, ?, ?, ?)"
    ).run(text, type || 'info', created_by, expires_at || null);
    logAction(req, { action: "create", entityType: "banner", entityId: result.lastInsertRowid, entityName: text.substring(0, 50), userId: created_by });
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/banners/:id", (req, res) => {
  try {
    const { text, type, is_active, expires_at } = req.body;
    db.prepare(`
      UPDATE admin_banners SET
        text = COALESCE(?, text),
        type = COALESCE(?, type),
        is_active = COALESCE(?, is_active),
        expires_at = COALESCE(?, expires_at)
      WHERE id = ?
    `).run(text || null, type || null, is_active !== undefined ? is_active : null, expires_at !== undefined ? expires_at : null, req.params.id);
    logAction(req, { action: "update", entityType: "banner", entityId: Number(req.params.id), details: JSON.stringify({ text, is_active }) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/banners/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM admin_banners WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "banner", entityId: Number(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== AUDIT LOG ======================

app.get("/api/audit-log", (req, res) => {
  try {
    const { limit = 50, offset = 0, entity_type, action, search, from, to } = req.query;
    const conditions = [];
    const params = [];

    if (entity_type) { conditions.push("entity_type = ?"); params.push(entity_type); }
    if (action) { conditions.push("action = ?"); params.push(action); }
    if (search) { conditions.push("(user_name LIKE ? OR entity_name LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (from) { conditions.push("created_at >= ?"); params.push(from); }
    if (to) { conditions.push("created_at <= ?"); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(...params).count;
    const logs = db.prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), parseInt(offset));

    res.json({ logs, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== CHAT ======================

app.get("/api/chat/messages", (req, res) => {
  try {
    const { room = 'general', limit = 100, before } = req.query;
    let query = `SELECT m.*, u.name as sender_name, u.surname as sender_surname, u.avatar_url as sender_avatar
                 FROM chat_messages m JOIN users u ON m.sender_id = u.id
                 WHERE m.room = ?`;
    const params = [room];
    if (before) { query += " AND m.id < ?"; params.push(parseInt(before)); }
    query += " ORDER BY m.id DESC LIMIT ?";
    params.push(parseInt(limit));
    const messages = db.prepare(query).all(...params);
    res.json(messages.reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/chat/messages", (req, res) => {
  try {
    const { sender_id, text, room = 'general' } = req.body;
    if (!sender_id || !text?.trim()) return res.status(400).json({ error: "sender_id and text required" });
    const result = db.prepare("INSERT INTO chat_messages (sender_id, room, text) VALUES (?, ?, ?)").run(sender_id, room, text.trim());
    const msg = db.prepare(`SELECT m.*, u.name as sender_name, u.surname as sender_surname, u.avatar_url as sender_avatar
                            FROM chat_messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`).get(result.lastInsertRowid);
    // Broadcast to WebSocket clients
    broadcastChat(msg);
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== DASHBOARD ======================

app.get("/api/dashboard/attendance-stats", (req, res) => {
  try {
    const { months = 6 } = req.query;
    // Monthly attendance by group
    const stats = db.prepare(`
      SELECT g.name as group_name, g.id as group_id,
             strftime('%Y-%m', l.date) as month,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
             COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
             COUNT(a.id) as total_records
      FROM groups g
      LEFT JOIN students s ON s.group_id = g.id
      LEFT JOIN attendance a ON a.student_id = s.id
      LEFT JOIN lessons l ON a.lesson_id = l.id
      WHERE l.date >= date('now', '-' || ? || ' months')
      GROUP BY g.id, strftime('%Y-%m', l.date)
      ORDER BY month, g.name
    `).all(parseInt(months));

    // Overall stats
    const overall = db.prepare(`
      SELECT
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as total_present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as total_absent,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as total_late,
        COUNT(a.id) as total_records
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.date >= date('now', '-' || ? || ' months')
    `).get(parseInt(months));

    // Top absent students
    const topAbsent = db.prepare(`
      SELECT s.full_name, g.name as group_name,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN attendance a ON a.student_id = s.id
      LEFT JOIN lessons l ON a.lesson_id = l.id
      WHERE l.date >= date('now', '-' || ? || ' months')
      GROUP BY s.id
      HAVING absent_count > 0
      ORDER BY absent_count DESC
      LIMIT 10
    `).all(parseInt(months));

    res.json({ byGroup: stats, overall, topAbsent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== PERMISSIONS ======================

app.get("/api/permissions", (req, res) => {
  try {
    const permissions = db.prepare("SELECT * FROM permissions ORDER BY id").all();
    res.json(permissions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/roles/:roleId/permissions", (req, res) => {
  try {
    const perms = db.prepare(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `).all(req.params.roleId);
    res.json(perms);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/roles/:roleId/permissions", (req, res) => {
  try {
    const { permission_ids } = req.body;
    if (!Array.isArray(permission_ids)) return res.status(400).json({ error: "permission_ids array required" });
    const roleId = parseInt(req.params.roleId);
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
    const ins = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const pid of permission_ids) ins.run(roleId, pid);
    logAction(req, { action: "update_permissions", entityType: "role", entityId: roleId, details: JSON.stringify(permission_ids) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/users/:id/permissions", (req, res) => {
  try {
    const user = db.prepare("SELECT role_id FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const perms = db.prepare(`
      SELECT p.key FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `).all(user.role_id);
    res.json(perms.map(p => p.key));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== START ======================

const server = app.listen(PORT, () => {
  console.log("\ud83d\ude80 Server running on http://localhost:" + PORT);
});

// ====================== WEBSOCKET ======================

const wss = new WebSocketServer({ server });
const wsClients = new Map(); // userId -> Set<ws>

function broadcastChat(msg) {
  const data = JSON.stringify({ type: 'chat_message', payload: msg });
  for (const [, sockets] of wsClients) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(data);
    }
  }
}

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'auth') {
        userId = data.userId;
        if (!wsClients.has(userId)) wsClients.set(userId, new Set());
        wsClients.get(userId).add(ws);
        ws.send(JSON.stringify({ type: 'auth_ok' }));

        // Broadcast online users
        const online = [...wsClients.keys()];
        const onlineMsg = JSON.stringify({ type: 'online_users', payload: online });
        for (const [, sockets] of wsClients) {
          for (const s of sockets) { if (s.readyState === 1) s.send(onlineMsg); }
        }
      }
    } catch {}
  });

  ws.on('close', () => {
    if (userId && wsClients.has(userId)) {
      wsClients.get(userId).delete(ws);
      if (wsClients.get(userId).size === 0) wsClients.delete(userId);
      // Broadcast updated online users
      const online = [...wsClients.keys()];
      const onlineMsg = JSON.stringify({ type: 'online_users', payload: online });
      for (const [, sockets] of wsClients) {
        for (const s of sockets) { if (s.readyState === 1) s.send(onlineMsg); }
      }
    }
  });
});

process.on("unhandledRejection", (reason, promise) => { console.error("Unhandled Rejection:", reason); });
process.on("uncaughtException", (error) => { console.error("Uncaught Exception:", error); process.exit(1); });
server.on("error", (err) => { console.error("Server error:", err); });
