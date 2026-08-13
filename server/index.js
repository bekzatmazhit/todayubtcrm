import "dotenv/config";
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
import bcrypt from "bcryptjs";
import crypto from "crypto";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import { logAction, generateLessonDates } from "./utils.js";

import authRouter from "./routes/auth.js";
import attendanceRouter from "./routes/attendance.js";
import scheduleRouter from "./routes/schedule.js";
import entRouter from "./routes/ent.js";
import studentsRouter from "./routes/students.js";
import usersRouter from "./routes/users.js";


const JWT_SECRET = process.env.JWT_SECRET || "today_crm_super_secret_key_123!";

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
const PORT = process.env.PORT || 3001;

// Безопасные заголовки
app.use(helmet({
  crossOriginResourcePolicy: false, // чтобы не ломать отдачу файлов/аватарок
}));

// CORS: отражаем Origin, без credentials.
// Если CLIENT_ORIGIN не задан, то разрешаем запросы с любых origin.
const allowedOriginsEnv = process.env.CLIENT_ORIGIN?.trim() || "";
const extraOriginsEnv = process.env.CLIENT_ORIGIN_EXTRA?.trim() || "";
const allowedOrigins = [
  ...allowedOriginsEnv.split(",").map(o => o.trim()).filter(Boolean),
  ...extraOriginsEnv.split(",").map(o => o.trim()).filter(Boolean),
];

if (allowedOrigins.length === 0) {
  console.log("CORS: CLIENT_ORIGIN не задан, разрешены все origin");
} else {
  console.log("CORS: разрешены origin", allowedOrigins);
}

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

// Serve static assets EARLY so JS/CSS load fast (before API routes)
const distDir = path.resolve(__dirname, "..", "dist");
console.log("📂 distDir resolved to:", distDir, "| exists:", fs.existsSync(distDir));
app.use(express.static(distDir, { maxAge: '1d' }));


// ====================== HELPERS ======================

// ====================== AUTH ======================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// ====================== AUTH MIDDLEWARE ======================
function authMiddleware(req, res, next) {
  if (req.path === '/login' || req.path === '/auth/login' || req.path === '/password-reset-request' || req.path.startsWith('/public/')) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
}

app.use('/api', authMiddleware);

app.use("/api/login", authRouter(db, loginLimiter, handleAvatarUpload));
app.use("/api/users", usersRouter(db, loginLimiter, handleAvatarUpload));
app.use("/api/students", studentsRouter(db, loginLimiter, handleAvatarUpload));
app.use("/api/attendance", attendanceRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/ent-results", entRouter);




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





// ====================== GROUPS ======================

app.get("/api/groups", (req, res) => {
  try {
    const { status } = req.query;
    const statusFilter = status || 'active';
    const statusCondition = statusFilter === 'all' ? '' : 'WHERE g.status = ?';
    const params = statusFilter === 'all' ? [] : [statusFilter];
    const groups = db.prepare(`
      SELECT g.id, g.name, g.profile_id, g.curator_id, g.status, g.avatar_url,
             p.name as profile_name,
             u.name || ' ' || u.surname as curator_name,
             (SELECT COUNT(*) FROM students s2 WHERE s2.group_id = g.id AND s2.status = 'active') as students_count
      FROM groups g
      LEFT JOIN profiles p ON g.profile_id = p.id
      LEFT JOIN users u ON g.curator_id = u.id
      ${statusCondition}
      GROUP BY g.id, g.name, g.profile_id, p.name, g.curator_id, u.name, u.surname, g.avatar_url
      ORDER BY g.id
    `).all(...params);
    res.json(groups);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/groups", (req, res) => {
  try {
    const { name, profile_id, curator_id, avatar_url } = req.body;
    if (!name) return res.status(400).json({ error: "Group name is required" });
    const result = db.prepare("INSERT INTO groups (name, profile_id, curator_id, avatar_url) VALUES (?, ?, ?, ?)").run(name, profile_id || null, curator_id || null, avatar_url || null);
    logAction(req, { action: "create", entityType: "group", entityId: result.lastInsertRowid, entityName: name, details: JSON.stringify({ profile_id, curator_id }) });
    res.json({ id: result.lastInsertRowid, name });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/api/groups/:id", (req, res) => {
  try {
    const { name, profile_id, curator_id, status, avatar_url } = req.body;
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push("name = ?"); params.push(name || null); }
    if (profile_id !== undefined) { fields.push("profile_id = ?"); params.push(profile_id || null); }
    if (curator_id !== undefined) { fields.push("curator_id = ?"); params.push(curator_id || null); }
    if (status !== undefined) { fields.push("status = ?"); params.push(status || null); }
    if (avatar_url !== undefined) { fields.push("avatar_url = ?"); params.push(avatar_url || null); }
    
    if (fields.length > 0) {
      params.push(req.params.id);
      db.prepare(`UPDATE groups SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    }
    
    logAction(req, { action: "update", entityType: "group", entityId: Number(req.params.id), entityName: name });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/groups/:id", (req, res) => {
  try {
    const g = db.prepare("SELECT name FROM groups WHERE id = ?").get(req.params.id);
    db.prepare("UPDATE groups SET status = 'archived' WHERE id = ?").run(req.params.id);
    logAction(req, { action: "archive", entityType: "group", entityId: Number(req.params.id), entityName: g?.name });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/api/groups/:id/hard", (req, res) => {
  try {
    const id = req.params.id;
    const g = db.prepare("SELECT name FROM groups WHERE id = ?").get(id);
    if (!g) return res.status(404).json({ error: "Group not found" });

    db.transaction(() => {
      db.prepare("UPDATE students SET group_id = NULL WHERE group_id = ?").run(id);
      db.prepare("DELETE FROM quizzes WHERE schedule_id IN (SELECT id FROM schedule WHERE group_id = ?)").run(id);
      db.prepare("DELETE FROM attendance WHERE lesson_id IN (SELECT id FROM lessons WHERE schedule_id IN (SELECT id FROM schedule WHERE group_id = ?))").run(id);
      db.prepare("DELETE FROM schedule WHERE group_id = ?").run(id);
      db.prepare("DELETE FROM curatorship_logs WHERE group_id = ?").run(id);
      db.prepare("DELETE FROM groups WHERE id = ?").run(id);
    })();
    
    logAction(req, { action: "delete", entityType: "group", entityId: Number(id), entityName: g.name });
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
    res.json(db.prepare("SELECT * FROM time_slots ORDER BY start_time").all());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/time-slots", (req, res) => {
  try {
    const { start_time, end_time, label } = req.body;
    if (!start_time || !end_time) return res.status(400).json({ error: "start_time and end_time required" });
    // Return existing slot or create new
    let slot = db.prepare("SELECT * FROM time_slots WHERE start_time = ? AND end_time = ?").get(start_time, end_time);
    if (!slot) {
      const result = db.prepare("INSERT INTO time_slots (start_time, end_time, label) VALUES (?, ?, ?)").run(start_time, end_time, label || null);
      slot = db.prepare("SELECT * FROM time_slots WHERE id = ?").get(result.lastInsertRowid);
    }
    res.json(slot);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== PROFILES ======================

app.get("/api/profiles", (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM profiles ORDER BY id").all());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== SCHEDULE (CRUD + CONFLICT CHECK) ======================











// Move a lesson to a different teacher, group or time slot (partial update, no room change)


// Publish schedule — notify all teachers


// Create public schedule share token (admin only)


// Delete a share token


// List share tokens (admin)

// Singular alias (same handler)
app.get("/api/schedule/share-token", (req, res) => res.redirect(307, "/api/schedule/share-tokens"));

// PUBLIC endpoint — no auth required — returns schedule for a share token
app.get("/api/public/schedule/:token", (req, res) => {
  try {
    const tokenRow = db.prepare("SELECT * FROM schedule_share_tokens WHERE token = ?").get(req.params.token);
    if (!tokenRow) return res.status(404).json({ error: "Ссылка недействительна" });

    let query = `
      SELECT s.id, s.group_id, s.subject_id, s.teacher_id, s.room_id, s.time_slot_id, s.cycle,
             s.custom_label,
             g.name as group_name, g.avatar_url as group_avatar,
             subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name,
             u.avatar_url as teacher_avatar,
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
    if (tokenRow.group_id) {
      query += " WHERE s.group_id = ?";
      params.push(tokenRow.group_id);
    }
    query += " ORDER BY ts.start_time, g.name";

    const entries = db.prepare(query).all(...params);

    // Group info
    const group = tokenRow.group_id
      ? db.prepare("SELECT id, name FROM groups WHERE id = ?").get(tokenRow.group_id)
      : null;

    // All groups (for cross-group view)
    const groups = db.prepare("SELECT id, name FROM groups ORDER BY name").all();

    res.json({ entries, group, groups, token: req.params.token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Conflict checking endpoint



// ====================== LESSONS (generated from schedule) ======================

app.get("/api/lessons", (req, res) => {
  try {
    const { teacher_id } = req.query;
    let query = `
      SELECT s.id, s.group_id, s.subject_id, s.teacher_id, s.room_id, s.time_slot_id, s.cycle,
             s.custom_label,
             g.name as group_name, g.avatar_url as group_avatar, subj.name as subject_name,
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

    const studentsByGroup = db.prepare("SELECT id, full_name, group_id FROM students WHERE group_id = ? AND status = 'active'");
    const studentsBySchedule = db.prepare(`
      SELECT st.id, st.full_name, st.group_id
      FROM schedule_students ss
      JOIN students st ON ss.student_id = st.id
      WHERE ss.schedule_id = ?
    `);

    const result = schedule.map(entry => {
      // If group_id is set, get all students from that group; otherwise get custom students
      const students = entry.group_id
        ? studentsByGroup.all(entry.group_id)
        : studentsBySchedule.all(entry.id);

      return {
        id: entry.id,
        group_id: entry.group_id,
        subject_id: entry.subject_id,
        teacher_id: entry.teacher_id,
        group_name: entry.group_name || entry.custom_label || 'Сводная группа',
        subject_name: entry.subject_name,
        teacher_name: entry.teacher_name,
        cycle: entry.cycle,
        start_time: entry.start_time,
        end_time: entry.end_time,
        room_name: entry.room_name,
        custom_label: entry.custom_label,
        dates: generateLessonDates(entry.cycle),
        students,
      };
    });

    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== STUDENTS ======================






// ====================== STUDENT-360 DASHBOARD (MODULARIZED) ======================
app.get("/api/student-360/:id/overview", (req, res) => {
  try {
    const sid = parseInt(req.params.id);
    if (!sid) return res.status(400).json({ error: "Invalid student id" });
    const student = db.prepare(`
      SELECT s.id, s.full_name, s.phone, s.parent_phone, s.parent_name,
             s.group_id, s.status, s.avatar_url,
             g.name as group_name, g.avatar_url as group_avatar,
             p.name as profile_name, g.curator_id,
             u.name || ' ' || u.surname as curator_name, u.phone as curator_phone
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN profiles p ON g.profile_id = p.id
      LEFT JOIN users u ON g.curator_id = u.id
      WHERE s.id = ?
    `).get(sid);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const attStats = db.prepare(`
      SELECT COUNT(*) AS total_lessons,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN lateness='late'  THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN homework='done'  THEN 1 ELSE 0 END) AS hw_done_count,
        ROUND(AVG(CASE WHEN status='present' THEN 1.0 ELSE 0.0 END)*100,1) AS attendance_rate,
        ROUND(AVG(CASE WHEN homework='done'  THEN 1.0 ELSE 0.0 END)*100,1) AS homework_rate
      FROM attendance WHERE student_id = ?
    `).get(sid);

    const attRecords = db.prepare("SELECT status FROM attendance WHERE student_id = ? ORDER BY lesson_id DESC LIMIT 20").all(sid);
    let consecutiveAbsences = 0;
    for (const r of attRecords) { if (r.status === 'absent') consecutiveAbsences++; else break; }

    const entFlat = db.prepare("SELECT e.month, e.score FROM ent_results e WHERE e.student_id = ? ORDER BY e.month").all(sid);
    const entMap = {};
    for (const row of entFlat) {
      if (!entMap[row.month]) entMap[row.month] = { month: row.month, total: 0 };
      entMap[row.month].total += row.score;
    }
    const entByMonth = Object.values(entMap).sort((a, b) => a.month.localeCompare(b.month));
    const lastEntTotal  = entByMonth.length > 0 ? entByMonth[entByMonth.length - 1].total : null;
    const prevEntTotal  = entByMonth.length > 1 ? entByMonth[entByMonth.length - 2].total : null;
    const entDelta      = lastEntTotal !== null && prevEntTotal !== null ? lastEntTotal - prevEntTotal : null;

    res.json({
      id: student.id, full_name: student.full_name, phone: student.phone, parentPhone: student.parent_phone, parentName: student.parent_name, status: student.status, avatar_url: student.avatar_url,
      group: { id: student.group_id, name: student.group_name, avatar_url: student.group_avatar, profileName: student.profile_name, curatorName: student.curator_name, curatorPhone: student.curator_phone },
      hero: { attendanceRate: attStats.attendance_rate, homeworkRate: attStats.homework_rate, totalLessons: attStats.total_lessons, presentCount: attStats.present_count, absentCount: attStats.absent_count, lateCount: attStats.late_count, hwDoneCount: attStats.hw_done_count, entLastScore: lastEntTotal, entDelta, consecutiveAbsences }
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/student-360/:id/attendance", (req, res) => {
  try {
    const sid = parseInt(req.params.id);
    const { start, end } = req.query;
    let dateFilterLesson = "", params = { sid };
    if (start && end) {
      dateFilterLesson = " AND l.date >= @start AND l.date <= @end ";
      params.start = start; params.end = end;
    }

    const attMonthly = db.prepare(`SELECT strftime('%Y-%m', l.date) AS month, COUNT(*) AS total, SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present, SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent, SUM(CASE WHEN a.lateness='late' THEN 1 ELSE 0 END) AS late, ROUND(AVG(CASE WHEN a.status='present' THEN 1.0 ELSE 0.0 END)*100,1) AS rate FROM attendance a JOIN lessons l ON a.lesson_id = l.id WHERE a.student_id = @sid ${dateFilterLesson} GROUP BY month ORDER BY month`).all(params);
    const attBySubject = db.prepare(`SELECT subj.name AS subject, COUNT(*) AS total, SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present, SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent, SUM(CASE WHEN a.homework='done' THEN 1 ELSE 0 END) AS hw_done, ROUND(AVG(CASE WHEN a.status='present' THEN 1.0 ELSE 0.0 END)*100,1) AS rate FROM attendance a JOIN lessons l ON a.lesson_id = l.id JOIN schedule sc ON l.schedule_id = sc.id JOIN subjects subj ON sc.subject_id = subj.id WHERE a.student_id = @sid ${dateFilterLesson} GROUP BY subj.id ORDER BY subj.name`).all(params);
    const attRecords = db.prepare(`SELECT l.date, subj.name AS subject, u.name || ' ' || u.surname AS teacher, a.status, a.lateness, a.homework, a.comment FROM attendance a JOIN lessons l ON a.lesson_id = l.id JOIN schedule sc ON l.schedule_id = sc.id LEFT JOIN subjects subj ON sc.subject_id = subj.id LEFT JOIN users u ON sc.teacher_id = u.id WHERE a.student_id = @sid ${dateFilterLesson} ORDER BY l.date DESC LIMIT 40`).all(params);
    res.json({ byMonth: attMonthly, bySubject: attBySubject, records: attRecords });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/student-360/:id/ent", (req, res) => {
  try {
    const sid = parseInt(req.params.id);
    const student = db.prepare("SELECT group_id FROM students WHERE id = ?").get(sid);
    const group_id = student?.group_id;
    const entFlat = db.prepare("SELECT e.month, e.score, subj.name AS subject, subj.type FROM ent_results e JOIN subjects subj ON e.subject_id = subj.id WHERE e.student_id = ? ORDER BY e.month, subj.name").all(sid);
    const entMap = {};
    for (const row of entFlat) {
      if (!entMap[row.month]) entMap[row.month] = { month: row.month, subjects: [], total: 0 };
      entMap[row.month].subjects.push({ name: row.subject, score: row.score, type: row.type });
      entMap[row.month].total += row.score;
    }
    const entByMonth = Object.values(entMap).sort((a, b) => a.month.localeCompare(b.month));
    const entBySubject = db.prepare("SELECT subj.name AS subject, COUNT(*) AS months_tested, MIN(e.score) AS score_min, MAX(e.score) AS score_max, ROUND(AVG(e.score),1) AS score_avg FROM ent_results e JOIN subjects subj ON e.subject_id = subj.id WHERE e.student_id = ? GROUP BY subj.id ORDER BY subj.name").all(sid);
    const lastMonth = entByMonth.length > 0 ? entByMonth[entByMonth.length - 1].month : null;
    let groupBenchmark = [], rankInGroup = null, groupSize = 0;
    if (lastMonth && group_id && group_id !== 'null') {
      const gId = parseInt(group_id);
      const groupScores = db.prepare("SELECT e.student_id, SUM(e.score) AS total FROM ent_results e JOIN students s ON e.student_id = s.id WHERE s.group_id = ? AND e.month = ? GROUP BY e.student_id ORDER BY total DESC").all(gId, lastMonth);
      groupSize = groupScores.length;
      const ri = groupScores.findIndex(r => r.student_id === sid);
      rankInGroup = ri >= 0 ? ri + 1 : null;
      groupBenchmark = db.prepare("SELECT subj.name AS subject, ROUND(AVG(e.score),1) AS group_avg, MAX(e.score) AS group_max FROM ent_results e JOIN subjects subj ON e.subject_id = subj.id JOIN students s ON e.student_id = s.id WHERE s.group_id = ? AND e.month = ? GROUP BY subj.id").all(gId, lastMonth);
    }
    const entCertificates = db.prepare("SELECT * FROM ent_certificates WHERE student_id = ? ORDER BY exam_type").all(sid);
    res.json({ byMonth: entByMonth, bySubject: entBySubject, groupBenchmark, lastMonth, rankInGroup, groupSize, entCertificates });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/student-360/:id/activity", (req, res) => {
  try {
    const sid = parseInt(req.params.id);
    const student = db.prepare("SELECT group_id FROM students WHERE id = ?").get(sid);
    const group_id = student?.group_id;
    const teacherFeedback = db.prepare(`SELECT tsf.month, tsf.comment, u.name || ' ' || u.surname AS teacher_name, subj.name AS subject_name, tsf.created_at FROM teacher_student_feedback tsf JOIN users u ON tsf.teacher_id = u.id LEFT JOIN subjects subj ON tsf.subject_id = subj.id WHERE tsf.student_id = ? ORDER BY tsf.month DESC, tsf.created_at DESC`).all(sid);
    const parentFeedback = db.prepare(`SELECT pf.date, pf.notes, pf.status, u.name || ' ' || u.surname AS curator_name FROM parent_feedback pf JOIN users u ON pf.curator_id = u.id WHERE pf.student_id = ? ORDER BY pf.date DESC`).all(sid);
    const callHistory = db.prepare(`SELECT cct.month, cct.status, cct.call_result, cct.notes, cct.completed_at, u.name || ' ' || u.surname AS curator_name FROM curator_call_tasks cct JOIN users u ON cct.curator_id = u.id WHERE cct.student_id = ? ORDER BY cct.month DESC`).all(sid);
    let curatorLogs = [];
    if (group_id && group_id !== 'null') {
       curatorLogs = db.prepare(`SELECT cl.date, cl.type, cl.title, cl.description FROM curatorship_logs cl WHERE cl.group_id = ? AND cl.date >= date('now','-180 days') ORDER BY cl.date DESC LIMIT 20`).all(parseInt(group_id));
    }
    const quizzes = db.prepare(`SELECT q.id, q.title, q.date, qr.score, u.name || ' ' || u.surname AS teacher_name, subj.name AS subject_name FROM quiz_results qr JOIN quizzes q ON qr.quiz_id = q.id LEFT JOIN users u ON q.created_by = u.id LEFT JOIN schedule sc ON q.schedule_id = sc.id LEFT JOIN subjects subj ON sc.subject_id = subj.id WHERE qr.student_id = ? ORDER BY q.date DESC, q.id DESC LIMIT 50`).all(sid);
    res.json({ teacherFeedback, parentFeedback, callHistory, curatorLogs, quizzes });
  } catch (error) { res.status(500).json({ error: error.message }); }
});


// ====================== STUDENT-360 DASHBOARD ======================
app.get("/api/student-360/:id", (req, res) => {
  try {
    const sid = parseInt(req.params.id);
    if (!sid) return res.status(400).json({ error: "Invalid student id" });

    const student = db.prepare(`
      SELECT s.id, s.full_name, s.phone, s.parent_phone, s.parent_name,
             s.group_id, s.status, s.avatar_url,
             g.name as group_name, g.avatar_url as group_avatar,
             p.name as profile_name,
             g.curator_id,
             u.name || ' ' || u.surname as curator_name,
             u.phone as curator_phone
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN profiles p ON g.profile_id = p.id
      LEFT JOIN users u ON g.curator_id = u.id
      WHERE s.id = ?
    `).get(sid);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const { start, end } = req.query;
    
    let dateFilterAtt = "";
    let dateFilterLesson = "";
    let dateFilterMonth = "";
    let dateFilterQuizzes = "";
    const params = { sid };
    
    if (start && end) {
      dateFilterAtt = " AND lesson_id IN (SELECT id FROM lessons WHERE date >= @start AND date <= @end) ";
      dateFilterLesson = " AND l.date >= @start AND l.date <= @end ";
      dateFilterMonth = " AND month >= substr(@start, 1, 7) AND month <= substr(@end, 1, 7) ";
      dateFilterQuizzes = " AND date >= @start AND date <= @end ";
      params.start = start;
      params.end = end;
    }

    const attStats = db.prepare(`
      SELECT COUNT(*) AS total_lessons,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN lateness='late'  THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN homework='done'  THEN 1 ELSE 0 END) AS hw_done_count,
        ROUND(AVG(CASE WHEN status='present' THEN 1.0 ELSE 0.0 END)*100,1) AS attendance_rate,
        ROUND(AVG(CASE WHEN homework='done'  THEN 1.0 ELSE 0.0 END)*100,1) AS homework_rate
      FROM attendance WHERE student_id = @sid ${dateFilterAtt}
    `).get(params);

    const attMonthly = db.prepare(`
      SELECT strftime('%Y-%m', l.date) AS month,
        COUNT(*) AS total,
        SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN a.lateness='late'  THEN 1 ELSE 0 END) AS late,
        ROUND(AVG(CASE WHEN a.status='present' THEN 1.0 ELSE 0.0 END)*100,1) AS rate
      FROM attendance a JOIN lessons l ON a.lesson_id = l.id
      WHERE a.student_id = @sid ${dateFilterLesson} GROUP BY month ORDER BY month
    `).all(params);

    const attBySubject = db.prepare(`
      SELECT subj.name AS subject,
        COUNT(*) AS total,
        SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN a.homework='done'  THEN 1 ELSE 0 END) AS hw_done,
        ROUND(AVG(CASE WHEN a.status='present' THEN 1.0 ELSE 0.0 END)*100,1) AS rate
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sc ON l.schedule_id = sc.id
      JOIN subjects subj ON sc.subject_id = subj.id
      WHERE a.student_id = @sid ${dateFilterLesson} GROUP BY subj.id ORDER BY subj.name
    `).all(params);

    const attRecords = db.prepare(`
      SELECT l.date, subj.name AS subject,
        u.name || ' ' || u.surname AS teacher,
        a.status, a.lateness, a.homework, a.comment
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sc ON l.schedule_id = sc.id
      LEFT JOIN subjects subj ON sc.subject_id = subj.id
      LEFT JOIN users u ON sc.teacher_id = u.id
      WHERE a.student_id = @sid ${dateFilterLesson} ORDER BY l.date DESC LIMIT 40
    `).all(params);

    const entFlat = db.prepare(`
      SELECT e.month, e.score, subj.name AS subject, subj.type
      FROM ent_results e JOIN subjects subj ON e.subject_id = subj.id
      WHERE e.student_id = @sid ${dateFilterMonth.replace(/month/g, 'e.month')} ORDER BY e.month, subj.name
    `).all(params);

    const entMap = {};
    for (const row of entFlat) {
      if (!entMap[row.month]) entMap[row.month] = { month: row.month, subjects: [], total: 0 };
      entMap[row.month].subjects.push({ name: row.subject, score: row.score, type: row.type });
      entMap[row.month].total += row.score;
    }
    const entByMonth = Object.values(entMap).sort((a, b) => a.month.localeCompare(b.month));

    const entBySubject = db.prepare(`
      SELECT subj.name AS subject,
        COUNT(*) AS months_tested,
        MIN(e.score) AS score_min, MAX(e.score) AS score_max,
        ROUND(AVG(e.score),1) AS score_avg
      FROM ent_results e JOIN subjects subj ON e.subject_id = subj.id
      WHERE e.student_id = @sid ${dateFilterMonth.replace(/month/g, 'e.month')} GROUP BY subj.id ORDER BY subj.name
    `).all(params);

    const lastEntMonth = entByMonth.length > 0 ? entByMonth[entByMonth.length - 1].month : null;
    let groupBenchmark = [], rankInGroup = null, groupSize = 0;
    if (lastEntMonth && student.group_id) {
      const groupScores = db.prepare(`
        SELECT e.student_id, SUM(e.score) AS total
        FROM ent_results e JOIN students s ON e.student_id = s.id
        WHERE s.group_id = ? AND e.month = ?
        GROUP BY e.student_id ORDER BY total DESC
      `).all(student.group_id, lastEntMonth);
      groupSize = groupScores.length;
      const ri = groupScores.findIndex(r => r.student_id === sid);
      rankInGroup = ri >= 0 ? ri + 1 : null;
      groupBenchmark = db.prepare(`
        SELECT subj.name AS subject,
          ROUND(AVG(e.score),1) AS group_avg, MAX(e.score) AS group_max
        FROM ent_results e JOIN subjects subj ON e.subject_id = subj.id
        JOIN students s ON e.student_id = s.id
        WHERE s.group_id = ? AND e.month = ? GROUP BY subj.id
      `).all(student.group_id, lastEntMonth);
    }

    const teacherFeedback = db.prepare(`
      SELECT tsf.month, tsf.comment,
        u.name || ' ' || u.surname AS teacher_name,
        subj.name AS subject_name, tsf.created_at
      FROM teacher_student_feedback tsf
      JOIN users u ON tsf.teacher_id = u.id
      LEFT JOIN subjects subj ON tsf.subject_id = subj.id
      WHERE tsf.student_id = ? ORDER BY tsf.month DESC, tsf.created_at DESC
    `).all(sid);

    const parentFeedback = db.prepare(`
      SELECT pf.date, pf.notes, pf.status,
        u.name || ' ' || u.surname AS curator_name
      FROM parent_feedback pf JOIN users u ON pf.curator_id = u.id
      WHERE pf.student_id = ? ORDER BY pf.date DESC
    `).all(sid);

    const callHistory = db.prepare(`
      SELECT cct.month, cct.status, cct.call_result, cct.notes, cct.completed_at,
        u.name || ' ' || u.surname AS curator_name
      FROM curator_call_tasks cct JOIN users u ON cct.curator_id = u.id
      WHERE cct.student_id = ? ORDER BY cct.month DESC
    `).all(sid);

    const curatorLogs = db.prepare(`
      SELECT cl.date, cl.type, cl.title, cl.description
      FROM curatorship_logs cl
      WHERE cl.group_id = ? AND cl.date >= date('now','-180 days')
      ORDER BY cl.date DESC LIMIT 20
    `).all(student.group_id || 0);

    const studentQuizzes = db.prepare(`
      SELECT q.id, q.title, q.date, qr.score,
             u.name || ' ' || u.surname AS teacher_name,
             subj.name AS subject_name
      FROM quiz_results qr
      JOIN quizzes q ON qr.quiz_id = q.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN schedule sc ON q.schedule_id = sc.id
      LEFT JOIN subjects subj ON sc.subject_id = subj.id
      WHERE qr.student_id = ?
      ORDER BY q.date DESC, q.id DESC
      LIMIT 50
    `).all(sid);

    const lastEntTotal  = entByMonth.length > 0 ? entByMonth[entByMonth.length - 1].total : null;
    const prevEntTotal  = entByMonth.length > 1 ? entByMonth[entByMonth.length - 2].total : null;
    const entDelta      = lastEntTotal !== null && prevEntTotal !== null ? lastEntTotal - prevEntTotal : null;
    let consecutiveAbsences = 0;
    for (const r of attRecords) { if (r.status === "absent") consecutiveAbsences++; else break; }

    res.json({
      id: student.id, full_name: student.full_name,
      phone: student.phone, parentPhone: student.parent_phone,
      parentName: student.parent_name, status: student.status,
      avatar_url: student.avatar_url,
      group: {
        id: student.group_id, name: student.group_name, avatar_url: student.group_avatar,
        profileName: student.profile_name,
        curatorName: student.curator_name, curatorPhone: student.curator_phone,
      },
      hero: {
        attendanceRate: attStats.attendance_rate,
        homeworkRate: attStats.homework_rate,
        totalLessons: attStats.total_lessons,
        presentCount: attStats.present_count,
        absentCount: attStats.absent_count,
        lateCount: attStats.late_count,
        hwDoneCount: attStats.hw_done_count,
        entLastScore: lastEntTotal,
        entDelta, rankInGroup, groupSize, consecutiveAbsences,
      },
      attendance: { stats: attStats, byMonth: attMonthly, bySubject: attBySubject, records: attRecords },
      ent: { byMonth: entByMonth, bySubject: entBySubject, groupBenchmark, lastMonth: lastEntMonth },
      teacherFeedback, parentFeedback, callHistory, curatorLogs, quizzes: studentQuizzes,
      entCertificates: db.prepare("SELECT * FROM ent_certificates WHERE student_id = ? ORDER BY exam_type").all(sid),
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});









// ====================== ATTENDANCE ======================

// Fetch attendance for an existing lesson.
// Query params:
// - lesson_id: number
//   OR
// - schedule_id: number + date: YYYY-MM-DD
// Returns: [{ student_id, status, lateness, homework, comment }]


// Attendance comments (lesson notes) by student for a date range
// Query params: student_id, from?, to?, limit?
// Returns: [{ date, teacher_name, subject_name, comment }]




// Lessons that have at least one attendance record in a date range
// Returns: [{ schedule_id, date }]


// Admin: schedule fill status per teacher per date
app.get("/api/admin/schedule-fill-status", (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    const scheduleEntries = db.prepare(`
      SELECT s.id, s.teacher_id, s.cycle,
             u.name || ' ' || u.surname as teacher_name,
             g.name as group_name, g.avatar_url as group_avatar,
             subj.name as subject_name,
             ts.label as time_label, ts.start_time
      FROM schedule s
      LEFT JOIN users u ON s.teacher_id = u.id
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      ORDER BY u.name, ts.start_time
    `).all();

    function getDaysForCycle(cycle) {
      if (cycle === "PSP") return [1, 3, 5];
      if (cycle === "VChS") return [2, 4, 6];
      return [];
    }

    const markedLessons = db.prepare(`
      SELECT DISTINCT l.schedule_id, l.date
      FROM lessons l
      JOIN attendance a ON a.lesson_id = l.id
      WHERE l.date BETWEEN ? AND ?
    `).all(from, to);
    const markedSet = new Set(markedLessons.map(ml => `${ml.schedule_id}:${ml.date}`));

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const result = [];
    for (const entry of scheduleEntries) {
      const days = getDaysForCycle(entry.cycle);
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        if (days.includes(d.getDay())) {
          const date = d.toISOString().split("T")[0];
          result.push({
            schedule_id: entry.id,
            teacher_id: entry.teacher_id,
            teacher_name: entry.teacher_name,
            group_name: entry.group_name,
            subject_name: entry.subject_name,
            time_label: entry.time_label,
            start_time: entry.start_time,
            cycle: entry.cycle,
            date,
            has_attendance: markedSet.has(`${entry.id}:${date}`),
          });
        }
      }
    }

    res.json(result);
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
      SELECT als.*, st.full_name, st.group_id, g.name as group_name, g.avatar_url as group_avatar
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

// ====================== QUIZZES / КОНТРОЛЬНЫЙ ТЕСТ ======================

app.post("/api/quizzes", (req, res) => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, schedule_id INTEGER, date TEXT NOT NULL,
        title TEXT NOT NULL, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(schedule_id) REFERENCES schedule(id) ON DELETE SET NULL,
        FOREIGN KEY(created_by) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS quiz_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL, score REAL,
        FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id),
        UNIQUE(quiz_id, student_id)
      );
    `);
    const { schedule_id, date, title, results, created_by } = req.body;
    if (!date || !title) return res.status(400).json({ error: "date and title required" });
    const q = db.prepare(
      "INSERT INTO quizzes (schedule_id, date, title, created_by) VALUES (?, ?, ?, ?)"
    ).run(schedule_id || null, date, title, created_by || null);
    const qId = q.lastInsertRowid;
    if (results && Array.isArray(results)) {
      const stmt = db.prepare("INSERT OR REPLACE INTO quiz_results (quiz_id, student_id, score) VALUES (?, ?, ?)");
      for (const r of results) stmt.run(qId, r.student_id, r.score ?? null);
    }
    res.json({ id: qId, success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/quizzes", (req, res) => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, schedule_id INTEGER, date TEXT NOT NULL,
        title TEXT NOT NULL, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(schedule_id) REFERENCES schedule(id) ON DELETE SET NULL,
        FOREIGN KEY(created_by) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS quiz_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL, score REAL,
        FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id),
        UNIQUE(quiz_id, student_id)
      );
    `);
    const { schedule_id, date, start_date, end_date, student_id, group_id, subject_id, status } = req.query;
    if (student_id) {
      const rows = db.prepare(`
        SELECT q.id, q.title, q.date, qr.score,
               u.name || ' ' || u.surname AS teacher_name,
               subj.name AS subject_name,
               g.name as group_name, g.avatar_url as group_avatar
        FROM quiz_results qr
        JOIN quizzes q ON qr.quiz_id = q.id
        LEFT JOIN users u ON q.created_by = u.id
        LEFT JOIN schedule sc ON q.schedule_id = sc.id
        LEFT JOIN subjects subj ON sc.subject_id = subj.id
        LEFT JOIN groups g ON sc.group_id = g.id
        WHERE qr.student_id = ?
        ORDER BY q.date DESC, q.id DESC
      `).all(parseInt(student_id));
      return res.json(rows);
    }
    const params = [];
    let where = "WHERE 1=1";
    if (schedule_id) { where += " AND q.schedule_id = ?"; params.push(schedule_id); }
    if (date)        { where += " AND q.date = ?";        params.push(date); }
    if (start_date)  { where += " AND q.date >= ?";       params.push(start_date); }
    if (end_date)    { where += " AND q.date <= ?";       params.push(end_date); }
    if (group_id)    { where += " AND sc.group_id = ?";   params.push(parseInt(group_id)); }
    if (subject_id)  { where += " AND sc.subject_id = ?"; params.push(parseInt(subject_id)); }
    const quizzes = db.prepare(`
      SELECT q.id, q.title, q.date, q.created_at,
             u.name || ' ' || u.surname AS teacher_name,
             subj.name AS subject_name,
             g.name as group_name, g.avatar_url as group_avatar, sc.group_id
      FROM quizzes q
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN schedule sc ON q.schedule_id = sc.id
      LEFT JOIN subjects subj ON sc.subject_id = subj.id
      LEFT JOIN groups g ON sc.group_id = g.id
      ${where}
      ORDER BY q.date DESC, q.id DESC
    `).all(...params);
    for (const q of quizzes) {
      q.results = db.prepare(`
        SELECT qr.student_id, qr.score, s.full_name AS full_name, g.name AS group_name, g.avatar_url AS group_avatar
        FROM quiz_results qr
        JOIN students s ON qr.student_id = s.id
        LEFT JOIN groups g ON s.group_id = g.id
        WHERE qr.quiz_id = ?
      `).all(q.id);
    }
    res.json(quizzes);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== MONTHLY REPORTS ======================
app.get("/api/monthly-reports", (req, res) => {
  try {
    const { student_id, month } = req.query;
    if (!student_id || !month) return res.status(400).json({ error: "student_id and month required" });
    const report = db.prepare("SELECT * FROM student_monthly_reports WHERE student_id = ? AND month = ?").get(parseInt(student_id), month);
    res.json(report || { student_id: parseInt(student_id), month, summary: "" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/monthly-reports/history", (req, res) => {
  try {
    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ error: "student_id required" });
    const reports = db.prepare("SELECT * FROM student_monthly_reports WHERE student_id = ? ORDER BY month DESC").all(parseInt(student_id));
    res.json(reports);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/monthly-reports", (req, res) => {
  try {
    const { student_id, month, summary, teacher_summary, stats_json } = req.body;
    if (!student_id || !month) return res.status(400).json({ error: "student_id and month required" });
    db.prepare(`
      INSERT INTO student_monthly_reports (student_id, month, summary, teacher_summary, stats_json, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(student_id, month) DO UPDATE SET 
        summary = COALESCE(excluded.summary, summary), 
        teacher_summary = COALESCE(excluded.teacher_summary, teacher_summary), 
        stats_json = COALESCE(excluded.stats_json, stats_json),
        updated_at = excluded.updated_at
    `).run(parseInt(student_id), month, summary, teacher_summary, stats_json);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/monthly-reports/group", (req, res) => {
  try {
    const { group_id, month } = req.query;
    if (!group_id || !month) return res.status(400).json({ error: "group_id and month required" });
    const reports = db.prepare(`
      SELECT r.* FROM student_monthly_reports r
      JOIN students s ON r.student_id = s.id
      WHERE s.group_id = ? AND r.month = ?
    `).all(parseInt(group_id), month);
    res.json(reports);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/monthly-reports/batch", (req, res) => {
  try {
    const { month, summaries } = req.body;
    if (!month || !Array.isArray(summaries)) return res.status(400).json({ error: "month and summaries array required" });
    
    db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO student_monthly_reports (student_id, month, summary, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(student_id, month) DO UPDATE SET summary = excluded.summary, updated_at = excluded.updated_at
      `);
      for (const item of summaries) {
        stmt.run(parseInt(item.student_id), month, item.summary || "");
      }
    })();
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== ENT RESULTS ======================




// Batch save ENT results




// ====================== ENT CERTIFICATES ======================





app.delete("/api/ent-certificates/:id", (req, res) => {
  try {
    const cert = db.prepare("SELECT * FROM ent_certificates WHERE id = ?").get(parseInt(req.params.id));
    if (!cert) return res.status(404).json({ error: "Not found" });
    try { fs.unlinkSync(path.join(uploadsDir, cert.filename)); } catch {}
    db.prepare("DELETE FROM ent_certificates WHERE id = ?").run(cert.id);
    res.json({ success: true });
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
      SELECT cl.*, g.name as group_name, g.avatar_url as group_avatar, u.name || ' ' || u.surname as curator_name
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


// Users: update


// Users: delete (archive — set role to inactive flag via status col doesn't exist, so just delete)


// Students: update


// Archive a student: set status=archived, remove from group


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
             (SELECT COUNT(*) FROM students s2 WHERE s2.group_id = g.id AND s2.status = 'active') as students_count
      FROM groups g
      LEFT JOIN profiles p ON g.profile_id = p.id
      WHERE g.curator_id = ? AND g.status = 'active'
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
             g.name as group_name, g.avatar_url as group_avatar,
             (SELECT SUM(e.score) FROM ent_results e WHERE e.student_id = s.id AND e.month = (SELECT MAX(e2.month) FROM ent_results e2 WHERE e2.student_id = s.id)) as last_ent_score
      FROM students s
      JOIN groups g ON s.group_id = g.id
      WHERE g.curator_id = ? AND s.status = 'active' AND g.status = 'active'
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

// ====================== ADMIN ATTENDANCE RECONCILIATION ======================
app.get("/api/admin/attendance-reconciliation", (req, res) => {
  try {
    const { from, to, group_id } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    // 1) Get students: either one group or all active
    let students;
    if (group_id) {
      students = db.prepare(`
        SELECT s.id, s.full_name, s.status, g.name as group_name, g.avatar_url as group_avatar,
               p.name AS profile_name,
               u.name || ' ' || u.surname AS curator_name
        FROM students s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN profiles p ON g.profile_id = p.id
        LEFT JOIN users u ON g.curator_id = u.id
        WHERE s.group_id = ? AND s.status = 'active' ORDER BY g.name, s.full_name
      `).all(parseInt(group_id));
    } else {
      students = db.prepare(`
        SELECT s.id, s.full_name, s.status, g.name as group_name, g.avatar_url as group_avatar,
               p.name AS profile_name,
               u.name || ' ' || u.surname AS curator_name
        FROM students s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN profiles p ON g.profile_id = p.id
        LEFT JOIN users u ON g.curator_id = u.id
        WHERE s.status = 'active' ORDER BY g.name, s.full_name
      `).all();
    }
    if (!students.length) return res.json({ dates: [], students: [], groups: [] });

    // 2) Get all unique dates where at least one lesson existed (always global)
    const dateQuery = db.prepare(`
      SELECT DISTINCT l.date FROM lessons l
      WHERE l.date BETWEEN ? AND ? ORDER BY l.date
    `).all(from, to);
    const dates = dateQuery.map(r => r.date);

    // 3) Get all attendance records
    const studentIds = students.map(s => s.id);
    const placeholders = studentIds.map(() => "?").join(",");
    const records = db.prepare(`
      SELECT a.student_id, l.date, a.status, a.lateness
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE a.student_id IN (${placeholders}) AND l.date BETWEEN ? AND ?
    `).all(...studentIds, from, to);

    // 4) Build lookup
    const lookup = {};
    for (const r of records) {
      if (!lookup[r.student_id]) lookup[r.student_id] = {};
      const key = r.date;
      // A student may have multiple lessons per day, take worst status
      const existing = lookup[r.student_id][key];
      const val = r.status === "present" ? (r.lateness === "late" ? "late" : "present") : "absent";
      if (!existing || val === "absent") lookup[r.student_id][key] = val;
    }

    // 5) Build result
    const result = students.map(s => {
      const att = {};
      let presentDays = 0, absentDays = 0, lateDays = 0, noData = 0;
      for (const d of dates) {
        const v = lookup[s.id]?.[d] || null;
        att[d] = v;
        if (v === "present") presentDays++;
        else if (v === "late") { lateDays++; presentDays++; }
        else if (v === "absent") absentDays++;
        else noData++;
      }
      return {
        id: s.id, full_name: s.full_name, group_name: s.group_name,
        profile_name: s.profile_name, curator_name: s.curator_name,
        status: s.status, attendance: att,
        summary: { present: presentDays, absent: absentDays, late: lateDays, noData, total: dates.length }
      };
    });

    // 6) Groups list for filter
    const groups = db.prepare(`SELECT id, name FROM groups ORDER BY name`).all();

    res.json({ dates, students: result, groups });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ====================== PARENT FEEDBACK ======================

app.get("/api/parent-feedback", (req, res) => {
  try {
    const { curator_id, student_id } = req.query;
    let query = `
      SELECT pf.*, s.full_name as student_name, s.parent_phone, s.parent_name,
             u.name || ' ' || u.surname as curator_name,
             g.name as group_name, g.avatar_url as group_avatar
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
             s.full_name, s.parent_phone, s.parent_name, g.name as group_name, g.avatar_url as group_avatar
      FROM curator_call_tasks ct
      JOIN students s ON ct.student_id = s.id
      JOIN groups g ON s.group_id = g.id
      WHERE ct.curator_id = ? AND ct.month = ? AND s.status = 'active' AND g.status = 'active'
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
      JOIN students s ON ct.student_id = s.id
      JOIN groups g ON s.group_id = g.id
      LEFT JOIN (
        SELECT g.curator_id, GROUP_CONCAT(DISTINCT g.name) as group_names
        FROM groups g
        WHERE g.curator_id IS NOT NULL
        GROUP BY g.curator_id
      ) g_agg ON g_agg.curator_id = u.id
      WHERE ct.month = ? AND s.status = 'active' AND g.status = 'active'
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
    // Find all groups this teacher teaches
    const scheduleEntries = db.prepare(`
      SELECT DISTINCT group_id FROM schedule WHERE teacher_id = ?
    `).all(parseInt(teacher_id));

    if (!scheduleEntries.length) return res.json({ generated: 0, total: 0, month });

    const check = db.prepare(
      "SELECT 1 FROM teacher_student_feedback WHERE teacher_id = ? AND student_id = ? AND month = ?"
    );
    const insert = db.prepare(
      "INSERT INTO teacher_student_feedback (teacher_id, student_id, month) VALUES (?, ?, ?)"
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
          const exists = check.get(parseInt(teacher_id), st.id, month);
          if (!exists) {
            insert.run(parseInt(teacher_id), st.id, month);
            generated++;
          }
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

    const rows = db.prepare(`
      SELECT tf.id, tf.student_id, tf.subject_id, tf.comment, tf.created_at,
             s.full_name, s.parent_phone, s.parent_name, g.name as group_name, g.avatar_url as group_avatar,
             subj.name as subject_name
      FROM teacher_student_feedback tf
      JOIN students s ON tf.student_id = s.id
      JOIN groups g ON s.group_id = g.id
      LEFT JOIN subjects subj ON tf.subject_id = subj.id
      WHERE tf.teacher_id = ? AND tf.month = ? AND s.status = 'active' AND g.status = 'active'
      ORDER BY g.name, s.full_name, subj.name
    `).all(parseInt(teacher_id), m);

    // Group by student_id
    const studentMap = new Map();
    for (const row of rows) {
      if (!studentMap.has(row.student_id)) {
        studentMap.set(row.student_id, { ...row, subjects: new Set() });
      }
      const existing = studentMap.get(row.student_id);
      if (row.subject_name) existing.subjects.add(row.subject_name);
      if (row.comment && !existing.comment) {
        existing.comment = row.comment;
        existing.id = row.id; // use the ID of the row that has a comment
      }
    }

    const tasks = Array.from(studentMap.values()).map(t => {
      t.subject_name = t.subjects.size > 0 ? Array.from(t.subjects).join(', ') : '';
      delete t.subjects;
      return t;
    });

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
      JOIN students s ON tf.student_id = s.id
      JOIN groups g ON s.group_id = g.id
      WHERE tf.month = ? AND s.status = 'active' AND g.status = 'active'
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

// Wrapper for multer to return JSON errors
function handleAvatarUpload(req, res, next) {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

// User avatar upload (existing)


// Student avatar upload



// Student avatar delete




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

// ====================== GOOGLE SHEETS IMPORT ======================
app.post("/api/import-google-sheet", async (req, res) => {
  try {
    const { url, gid } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    // Extract spreadsheet ID from URL
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) return res.status(400).json({ error: "Invalid Google Sheets URL" });
    const spreadsheetId = idMatch[1];

    const fetchHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/csv,text/plain,*/*",
    };

    // Parse CSV (handle quoted fields with commas/newlines)
    const parseCSV = (text) => {
      const rows = [];
      let row = [];
      let inQuotes = false;
      let field = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
          if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
          else if (ch === '"') { inQuotes = false; }
          else { field += ch; }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { row.push(field.trim()); field = ""; }
          else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
            row.push(field.trim()); field = "";
            if (row.some(c => c !== "")) rows.push(row);
            row = [];
            if (ch === '\r') i++;
          } else { field += ch; }
        }
      }
      row.push(field.trim());
      if (row.some(c => c !== "")) rows.push(row);
      return rows;
    };

    // If gid is specified, fetch only that sheet
    if (gid !== undefined && gid !== null) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      const response = await fetch(csvUrl, { redirect: "follow", headers: fetchHeaders });
      if (!response.ok) {
        return res.status(400).json({ error: `Не удалось загрузить лист (HTTP ${response.status}). Убедитесь, что таблица открыта по ссылке.` });
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        return res.status(400).json({ error: "Таблица не доступна. Откройте доступ: Поделиться → Все у кого есть ссылка → Читатель" });
      }
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      if (parsed.length === 0) return res.status(400).json({ error: "Лист пуст" });
      return res.json({ headers: parsed[0], rows: parsed.slice(1) });
    }

    // Otherwise, discover all sheets from the HTML page, then fetch each as CSV
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const htmlResp = await fetch(htmlUrl, { redirect: "follow", headers: { ...fetchHeaders, Accept: "text/html" } });
    if (!htmlResp.ok) {
      return res.status(400).json({ error: `Не удалось получить список листов (HTTP ${htmlResp.status})` });
    }
    const html = await htmlResp.text();

    // Extract sheet names and gids from the HTML
    // Google embeds sheet info in the page as a JS object
    const sheets = [];
    // Pattern 1: look for sheet tabs in HTML
    const sheetRegex = /gid=(\d+)[^>]*>([^<]+)</g;
    let m;
    while ((m = sheetRegex.exec(html)) !== null) {
      const sheetGid = m[1];
      const sheetName = m[2].trim().replace(/&amp;/g, "&").replace(/&#39;/g, "'");
      if (!sheets.find(s => s.gid === sheetGid)) {
        sheets.push({ gid: sheetGid, name: sheetName });
      }
    }

    // Pattern 2: look for sheet list definition in script tags
    if (sheets.length === 0) {
      const scriptMatch = html.match(/\{\\?"sheetId\\?":\s*(\d+).*?\\?"name\\?":\s*\\?"([^"\\]+)/g);
      if (scriptMatch) {
        for (const sm of scriptMatch) {
          const idM = sm.match(/sheetId\\?":\s*(\d+)/);
          const nameM = sm.match(/name\\?":\s*\\?"([^"\\]+)/);
          if (idM && nameM && !sheets.find(s => s.gid === idM[1])) {
            sheets.push({ gid: idM[1], name: nameM[1] });
          }
        }
      }
    }

    // Fallback: just use gid=0
    if (sheets.length === 0) sheets.push({ gid: "0", name: "Лист 1" });

    // Fetch each sheet's CSV
    const results = [];
    for (const sheet of sheets) {
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheet.gid}`;
        const resp = await fetch(csvUrl, { redirect: "follow", headers: fetchHeaders });
        if (!resp.ok) continue;
        const ct = resp.headers.get("content-type") || "";
        if (ct.includes("text/html")) continue;
        const csv = await resp.text();
        if (!csv.trim()) continue;
        const parsed = parseCSV(csv);
        if (parsed.length === 0) continue;
        results.push({ gid: sheet.gid, name: sheet.name, headers: parsed[0], rows: parsed.slice(1) });
      } catch { /* skip failed sheets */ }
    }

    if (results.length === 0) {
      return res.status(400).json({ error: "Не удалось загрузить ни один лист. Проверьте доступ к таблице." });
    }

    res.json({ sheets: results });
  } catch (error) {
    console.error("Google Sheets import error:", error);
    res.status(500).json({ error: error.message });
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
    if (search) { 
      const sLower = search.toLowerCase();
      conditions.push("(LOWER_CYR(user_name) LIKE ? OR LOWER_CYR(entity_name) LIKE ?)"); 
      params.push(`%${sLower}%`, `%${sLower}%`); 
    }
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
      SELECT g.name as group_name, g.avatar_url as group_avatar, g.id as group_id,
             strftime('%Y-%m', l.date) as month,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
             COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
             COUNT(a.id) as total_records
      FROM groups g
      LEFT JOIN attendance a ON a.group_id = g.id
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
      SELECT s.full_name, g.name as group_name, g.avatar_url as group_avatar,
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

    const { cnt: active_student_count } = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE status = 'active'").get();
    res.json({ byGroup: stats, overall, topAbsent, active_student_count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== PERMISSIONS =======================

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



// ====================== TEACHER ANALYTICS ======================

app.get("/api/analytics/teacher/:id", (req, res) => {
  try {
    const teacherId = parseInt(req.params.id);
    const m = parseInt(req.query.months || 6);

    // 1. Total lessons conducted (with at least 1 attendance record)
    const lessonsCount = db.prepare(`
      SELECT COUNT(DISTINCT l.id) as count
      FROM lessons l
      JOIN schedule sch ON l.schedule_id = sch.id
      JOIN attendance a ON a.lesson_id = l.id
      WHERE sch.teacher_id = ?
        AND l.date >= date('now', '-' || ? || ' months')
    `).get(teacherId, m);

    // 2. Unique students taught
    const studentsCount = db.prepare(`
      SELECT COUNT(DISTINCT a.student_id) as count
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sch ON l.schedule_id = sch.id
      WHERE sch.teacher_id = ?
        AND l.date >= date('now', '-' || ? || ' months')
    `).get(teacherId, m);

    // 3. Attendance stats per subject
    const bySubject = db.prepare(`
      SELECT subj.name as subject_name, subj.id as subject_id,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
             COUNT(CASE WHEN a.lateness = 'late' THEN 1 END) as late,
             COUNT(a.id) as total
      FROM schedule sch
      JOIN lessons l ON l.schedule_id = sch.id
      JOIN attendance a ON a.lesson_id = l.id
      LEFT JOIN subjects subj ON sch.subject_id = subj.id
      WHERE sch.teacher_id = ?
        AND l.date >= date('now', '-' || ? || ' months')
      GROUP BY subj.id
      ORDER BY subj.name
    `).all(teacherId, m);

    // 4. Monthly trend
    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', l.date) as month,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
             COUNT(CASE WHEN a.lateness = 'late' THEN 1 END) as late,
             COUNT(a.id) as total,
             COUNT(DISTINCT l.id) as lessons
      FROM schedule sch
      JOIN lessons l ON l.schedule_id = sch.id
      JOIN attendance a ON a.lesson_id = l.id
      WHERE sch.teacher_id = ?
        AND l.date >= date('now', '-' || ? || ' months')
      GROUP BY strftime('%Y-%m', l.date)
      ORDER BY month
    `).all(teacherId, m);

    // 5. Attendance per group
    const byGroup = db.prepare(`
      SELECT g.name as group_name, g.avatar_url as group_avatar, g.id as group_id,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
             COUNT(a.id) as total
      FROM schedule sch
      JOIN lessons l ON l.schedule_id = sch.id
      JOIN attendance a ON a.lesson_id = l.id
      LEFT JOIN groups g ON sch.group_id = g.id
      WHERE sch.teacher_id = ?
        AND l.date >= date('now', '-' || ? || ' months')
      GROUP BY g.id
      ORDER BY g.name
    `).all(teacherId, m);

    // 6. ENT dynamics of students in groups this teacher teaches
    const entDynamics = db.prepare(`
      SELECT e.month, ROUND(AVG(e.score), 1) as avg_score,
             COUNT(DISTINCT e.student_id) as students_count,
             subj.name as subject_name
      FROM ent_results e
      JOIN students s ON e.student_id = s.id
      JOIN subjects subj ON e.subject_id = subj.id
      WHERE e.group_id IN (
        SELECT DISTINCT sch.group_id FROM schedule sch
        WHERE sch.teacher_id = ? AND sch.group_id IS NOT NULL
      )
      AND e.month >= strftime('%Y-%m', date('now', '-' || ? || ' months'))
      GROUP BY e.month, subj.id
      ORDER BY e.month, subj.name
    `).all(teacherId, m);

    // 7. Groups this teacher works with
    const groups = db.prepare(`
      SELECT DISTINCT g.id, g.name
      FROM schedule sch
      JOIN groups g ON sch.group_id = g.id
      WHERE sch.teacher_id = ?
      ORDER BY g.name
    `).all(teacherId);

    res.json({
      lessonsCount: lessonsCount?.count || 0,
      studentsCount: studentsCount?.count || 0,
      bySubject,
      monthlyTrend,
      byGroup,
      entDynamics,
      groups,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== EXPORT REPORTS ======================

// Detailed monthly attendance per student per day
app.get("/api/reports/attendance", (req, res) => {
  try {
    const { month, group_id, teacher_id } = req.query;
    if (!month) return res.status(400).json({ error: "month required (YYYY-MM)" });

    const conditions = ["strftime('%Y-%m', l.date) = ?"];
    const params = [month];
    if (group_id) { conditions.push("a.group_id = ?"); params.push(parseInt(group_id)); }
    if (teacher_id) { conditions.push("sch.teacher_id = ?"); params.push(parseInt(teacher_id)); }

    const rows = db.prepare(`
      SELECT s.full_name as student_name, s.id as student_id,
             g.name as group_name, g.avatar_url as group_avatar, subj.name as subject_name,
             l.date, a.status, a.lateness, a.homework, a.comment,
             u.name || ' ' || u.surname as teacher_name
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sch ON l.schedule_id = sch.id
      JOIN students s ON a.student_id = s.id
      LEFT JOIN groups g ON a.group_id = g.id
      LEFT JOIN subjects subj ON sch.subject_id = subj.id
      LEFT JOIN users u ON sch.teacher_id = u.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY g.name, s.full_name, l.date
    `).all(...params);

    // Summary stats
    const summary = db.prepare(`
      SELECT g.name as group_name, g.avatar_url as group_avatar,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
             COUNT(CASE WHEN a.lateness = 'late' THEN 1 END) as late,
             COUNT(a.id) as total
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sch ON l.schedule_id = sch.id
      JOIN students s ON a.student_id = s.id
      LEFT JOIN groups g ON a.group_id = g.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY g.id
      ORDER BY g.name
    `).all(...params);

    res.json({ rows, summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ENT dynamics report
app.get("/api/reports/ent", (req, res) => {
  try {
    const { group_id, from_month, to_month } = req.query;

    const conditions = [];
    const params = [];
    if (group_id) { conditions.push("e.group_id = ?"); params.push(parseInt(group_id)); }
    if (from_month) { conditions.push("e.month >= ?"); params.push(from_month); }
    if (to_month) { conditions.push("e.month <= ?"); params.push(to_month); }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const rows = db.prepare(`
      SELECT s.full_name as student_name, s.id as student_id,
             g.name as group_name, g.avatar_url as group_avatar,
             subj.name as subject_name,
             e.score, e.month
      FROM ent_results e
      JOIN students s ON e.student_id = s.id
      JOIN subjects subj ON e.subject_id = subj.id
      LEFT JOIN groups g ON e.group_id = g.id
      ${where}
      ORDER BY g.name, s.full_name, subj.name, e.month
    `).all(...params);

    // Group averages by month
    const groupAvg = db.prepare(`
      SELECT g.name as group_name, g.avatar_url as group_avatar,
             e.month,
             ROUND(AVG(e.score), 1) as avg_score,
             MIN(e.score) as min_score,
             MAX(e.score) as max_score,
             COUNT(DISTINCT e.student_id) as students_count
      FROM ent_results e
      JOIN students s ON e.student_id = s.id
      LEFT JOIN groups g ON e.group_id = g.id
      ${where}
      GROUP BY g.id, e.month
      ORDER BY g.name, e.month
    `).all(...params);

    res.json({ rows, groupAvg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Group performance report (grades + attendance combined)
app.get("/api/reports/group-performance", (req, res) => {
  try {
    const { group_id, months = 3 } = req.query;
    if (!group_id) return res.status(400).json({ error: "group_id required" });
    const m = parseInt(months);

    // Students in group
    const students = db.prepare(`
      SELECT s.id, s.full_name FROM students s
      WHERE s.group_id = ? AND s.status = 'active'
      ORDER BY s.full_name
    `).all(parseInt(group_id));

    // Attendance stats per student
    const attendanceByStudent = db.prepare(`
      SELECT a.student_id,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
             COUNT(CASE WHEN a.lateness = 'late' THEN 1 END) as late,
             COUNT(a.id) as total
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE a.group_id = ?
        AND l.date >= date('now', '-' || ? || ' months')
      GROUP BY a.student_id
    `).all(parseInt(group_id), m);

    // Latest ENT scores per student
    const entByStudent = db.prepare(`
      SELECT e.student_id, subj.name as subject_name, e.score, e.month
      FROM ent_results e
      JOIN subjects subj ON e.subject_id = subj.id
      WHERE e.group_id = ?
      ORDER BY e.student_id, subj.name, e.month DESC
    `).all(parseInt(group_id));

    // Group info
    const group = db.prepare(`
      SELECT g.name, u.name || ' ' || u.surname as curator_name
      FROM groups g LEFT JOIN users u ON g.curator_id = u.id
      WHERE g.id = ?
    `).get(parseInt(group_id));

    res.json({ group, students, attendanceByStudent, entByStudent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== ADMISSION TRACKER ======================

// Universities CRUD
app.get("/api/universities", (req, res) => {
  try { res.json(db.prepare("SELECT * FROM universities ORDER BY name").all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/universities", (req, res) => {
  try {
    const { name, city, website, logo_url } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const r = db.prepare("INSERT INTO universities (name, city, website, logo_url) VALUES (?, ?, ?, ?)").run(name, city || null, website || null, logo_url || null);
    res.json({ id: r.lastInsertRowid, name, city, website, logo_url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/universities/:id", (req, res) => {
  try {
    const { name, city, website, logo_url } = req.body;
    db.prepare("UPDATE universities SET name=?, city=?, website=?, logo_url=? WHERE id=?").run(name, city || null, website || null, logo_url || null, parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/universities/:id", (req, res) => {
  try { db.prepare("DELETE FROM universities WHERE id=?").run(parseInt(req.params.id)); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Specialties CRUD
app.get("/api/specialties", (req, res) => {
  try { res.json(db.prepare("SELECT * FROM specialties ORDER BY code").all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/specialties", (req, res) => {
  try {
    const { code, name, profile_subjects } = req.body;
    if (!code || !name) return res.status(400).json({ error: "code and name required" });
    const r = db.prepare("INSERT INTO specialties (code, name, profile_subjects) VALUES (?, ?, ?)").run(code, name, profile_subjects || null);
    res.json({ id: r.lastInsertRowid, code, name, profile_subjects });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/specialties/:id", (req, res) => {
  try {
    const { code, name, profile_subjects } = req.body;
    db.prepare("UPDATE specialties SET code=?, name=?, profile_subjects=? WHERE id=?").run(code, name, profile_subjects || null, parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/specialties/:id", (req, res) => {
  try { db.prepare("DELETE FROM specialties WHERE id=?").run(parseInt(req.params.id)); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Passing Scores
app.get("/api/passing-scores", (req, res) => {
  try {
    const { university_id, specialty_id, year } = req.query;
    let q = `SELECT ps.*, u.name as university_name, s.name as specialty_name, s.code as specialty_code
             FROM passing_scores ps
             JOIN universities u ON ps.university_id = u.id
             JOIN specialties  s ON ps.specialty_id  = s.id WHERE 1=1`;
    const params = [];
    if (university_id) { q += " AND ps.university_id=?"; params.push(parseInt(university_id)); }
    if (specialty_id)  { q += " AND ps.specialty_id=?";  params.push(parseInt(specialty_id)); }
    if (year)          { q += " AND ps.year=?";           params.push(parseInt(year)); }
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/passing-scores", (req, res) => {
  try {
    const { university_id, specialty_id, year = 2026, grant_score, paid_score } = req.body;
    if (!university_id || !specialty_id) return res.status(400).json({ error: "university_id and specialty_id required" });
    db.prepare(`INSERT INTO passing_scores (university_id, specialty_id, year, grant_score, paid_score) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(university_id, specialty_id, year) DO UPDATE SET grant_score=excluded.grant_score, paid_score=excluded.paid_score`)
      .run(parseInt(university_id), parseInt(specialty_id), parseInt(year), grant_score ?? null, paid_score ?? null);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/passing-scores/:id", (req, res) => {
  try { db.prepare("DELETE FROM passing_scores WHERE id=?").run(parseInt(req.params.id)); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Student admission target + scores


// Admission tracker table data (all students with targets + passing scores)
app.get("/api/admission-tracker", (req, res) => {
  try {
    const { group_id } = req.query;
    let q = `SELECT s.id, s.full_name, s.group_id, g.name as group_name, g.avatar_url as group_avatar,
      s.target_university_id, s.target_specialty_id,
      (SELECT SUM(e.score) FROM ent_results e WHERE e.student_id = s.id AND e.month = '1000-01') as unt_january_score,
      (SELECT SUM(e.score) FROM ent_results e WHERE e.student_id = s.id AND e.month = '1000-03') as unt_march_score,
      (SELECT SUM(e.score) FROM ent_results e WHERE e.student_id = s.id AND e.month = '1001-01') as unt_grant_1_score,
      (SELECT SUM(e.score) FROM ent_results e WHERE e.student_id = s.id AND e.month = '1001-02') as unt_grant_2_score,
      u.name as university_name, u.logo_url as university_logo_url, sp.name as specialty_name, sp.code as specialty_code,
      ps.grant_score, ps.paid_score, ps.year as ps_year
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN universities u  ON s.target_university_id = u.id
      LEFT JOIN specialties  sp ON s.target_specialty_id  = sp.id
      LEFT JOIN passing_scores ps ON ps.university_id = s.target_university_id
                                  AND ps.specialty_id  = s.target_specialty_id
                                  AND ps.year = 2026
      WHERE s.status = 'active'`;
    const params = [];
    if (group_id) { q += " AND s.group_id=?"; params.push(parseInt(group_id)); }
    q += " ORDER BY g.name, s.full_name";
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Custom columns CRUD
app.get("/api/admission-custom-columns", (req, res) => {
  try { res.json(db.prepare("SELECT * FROM admission_custom_columns ORDER BY position, id").all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/admission-custom-columns", (req, res) => {
  try {
    const { name, type = "checkbox" } = req.body;
    const pos = (db.prepare("SELECT MAX(position) as m FROM admission_custom_columns").get()?.m ?? 0) + 1;
    const r = db.prepare("INSERT INTO admission_custom_columns (name, type, position) VALUES (?,?,?)").run(name, type, pos);
    res.json({ id: r.lastInsertRowid, name, type, position: pos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/admission-custom-columns/:id", (req, res) => {
  try {
    const { name, type } = req.body;
    db.prepare("UPDATE admission_custom_columns SET name=?, type=? WHERE id=?").run(name, type, parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/admission-custom-columns/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM admission_custom_columns WHERE id=?").run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Custom values (per student per column)
app.get("/api/admission-custom-values", (req, res) => {
  try { res.json(db.prepare("SELECT * FROM admission_custom_values").all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/admission-custom-values", (req, res) => {
  try {
    const { student_id, column_id, value } = req.body;
    db.prepare("INSERT INTO admission_custom_values (student_id, column_id, value) VALUES (?,?,?) ON CONFLICT(student_id, column_id) DO UPDATE SET value=excluded.value")
      .run(parseInt(student_id), parseInt(column_id), value ?? null);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk import universities from parsed XLSX data
app.post("/api/universities/bulk", (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: "Expected array" });
    const ins = db.prepare("INSERT OR IGNORE INTO universities (name, city, website, logo_url) VALUES (?,?,?,?)");
    const tx = db.transaction(() => rows.forEach(r => ins.run(r.name ?? "", r.city ?? null, r.website ?? null, r.logo_url ?? null)));
    tx();
    res.json({ inserted: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk import specialties from parsed XLSX data
app.post("/api/specialties/bulk", (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: "Expected array" });
    const ins = db.prepare("INSERT OR IGNORE INTO specialties (code, name, profile_subjects) VALUES (?,?,?)");
    const tx = db.transaction(() => rows.forEach(r => ins.run(r.code ?? "", r.name ?? "", r.profile_subjects ?? null)));
    tx();
    res.json({ inserted: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== SETTINGS ======================
app.get("/api/settings/:key", (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(req.params.key);
    res.json({ value: row ? row.value : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/settings/:key", (req, res) => {
  try {
    const { value } = req.body;
    db.prepare("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP").run(req.params.key, value || "");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== OPENAI ======================
app.post("/api/ai/generate-report", async (req, res) => {
  try {
    const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'openai_api_key'").get();
    const apiKey = apiKeyRow?.value || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: "OpenAI API Key не настроен в настройках CRM." });

    const { action, studentName, month, stats, draft } = req.body;
    const openai = new OpenAI({ apiKey });
    
    let prompt = "";
    if (action === "improve") {
      prompt = `Вы опытный и вежливый куратор образовательного центра. Ваша задача - отредактировать и улучшить текст "Итоги собрания" для родителей ученика.\nУченик: ${studentName}. Месяц: ${month}.\nСтатистика: Посещаемость ${stats.attendance}, ДЗ ${stats.homework}, ЕНТ ${stats.ent}.\nОтзывы учителей: ${stats.feedback}.\n\nЧерновик текста:\n"""\n${draft}\n"""\n\nУлучшите текст, исправьте синтаксис, сделайте его более профессиональным, вежливым и структурированным. Оставьте основные мысли, но подайте их красиво (сначала похвалите, затем конструктивная критика, затем рекомендации). Не используйте слишком сложные слова. Напишите только готовый текст без лишних вступлений.`;
    } else if (action === "process-feedback") {
      prompt = `Вы опытный и вежливый куратор образовательного центра. Ваша задача - составить профессиональную сводку отзывов преподавателей для отправки родителям ученика.\nУченик: ${studentName}. Месяц: ${month}.\nОтзывы учителей:\n"""\n${stats.feedback}\n"""\n\nПроанализируйте эти отзывы. Уберите резкие или обидные выражения, исправьте ошибки и объедините их в связный, профессиональный текст. Текст должен быть структурированным, вежливым и объективным. Подайте информацию конструктивно. Если отзывов нет, напишите "Отзывы преподавателей отсутствуют". Напишите только готовый текст без лишних вступлений (1-2 абзаца).`;
    } else {
      prompt = `Вы опытный и вежливый куратор образовательного центра. Напишите текст "Итоги собрания" для родителей ученика.\nУченик: ${studentName}. Месяц: ${month}.\nСтатистика: Посещаемость ${stats.attendance}, ДЗ ${stats.homework}, ЕНТ ${stats.ent}.\nОтзывы учителей: ${stats.feedback}.\n\nНапишите профессиональный, структурированный и вежливый отчет (2-4 абзаца). Сначала похвалите за успехи, прокомментируйте посещаемость и ДЗ, затем добавьте конструктивную критику на основе отзывов, и дайте конкретные рекомендации. Напишите только готовый текст без лишних вступлений.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    res.json({ result: completion.choices[0].message.content.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================== SPA FALLBACK (production) ======================
// Must be LAST — after all API routes — so it only catches unmatched paths
app.get(/.*/, (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
    return res.status(404).json({ error: "API Route Not found" });
  }
  
  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If index.html is missing, return a clear error so we know it's our Node server responding
    res.status(404).send("Node App Error: index.html not found in dist directory. Please run npm run build.");
  }
});

// ====================== START ======================

const server = app.listen(PORT, () => {
  console.log("🚀 Server running on http://localhost:" + PORT);
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
