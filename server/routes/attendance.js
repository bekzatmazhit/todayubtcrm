import express from "express";
import { db } from "../db.js";
import { logAction, generateLessonDates } from "../utils.js";
import crypto from "crypto";

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { lesson_id, schedule_id, date } = req.query;

    let lessonId = lesson_id ? parseInt(lesson_id) : null;
    if (!lessonId) {
      if (!schedule_id || !date) return res.status(400).json({ error: "lesson_id or schedule_id+date required" });
      const lesson = db.prepare("SELECT id FROM lessons WHERE schedule_id = ? AND date = ?")
        .get(parseInt(schedule_id), date);
      if (!lesson) return res.json([]);
      lessonId = lesson.id;
    }

    const rows = db.prepare(`
      SELECT student_id, status, lateness, homework, comment
      FROM attendance
      WHERE lesson_id = ?
    `).all(lessonId);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/comments/by-student', (req, res) => {
  try {
    const { student_id, from, to, limit } = req.query;
    if (!student_id) return res.status(400).json({ error: "student_id required" });
    const lim = Math.min(Math.max(parseInt(limit || "50"), 1), 200);

    const hasRange = Boolean(from && to);

    const rows = db.prepare(`
      SELECT l.date,
        COALESCE(u.name || ' ' || u.surname, '') as teacher_name,
        COALESCE(subj.name, '') as subject_name,
        a.comment
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN schedule sch ON l.schedule_id = sch.id
      LEFT JOIN users u ON sch.teacher_id = u.id
      LEFT JOIN subjects subj ON sch.subject_id = subj.id
      WHERE a.student_id = ?
        ${hasRange ? "AND l.date BETWEEN ? AND ?" : ""}
        AND a.comment IS NOT NULL
        AND TRIM(a.comment) != ''
      ORDER BY l.date DESC
      LIMIT ?
    `);

    const args = hasRange
      ? [parseInt(student_id), from, to, lim]
      : [parseInt(student_id), lim];

    res.json(rows.all(...args));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
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
    const student = db.prepare("SELECT group_id FROM students WHERE id = ?").get(student_id);
    const sGroupId = student ? student.group_id : null;

    db.prepare(`
      INSERT INTO attendance (student_id, lesson_id, group_id, status, lateness, homework, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, lesson_id) DO UPDATE SET
        group_id=excluded.group_id, status=excluded.status, lateness=excluded.lateness, homework=excluded.homework, comment=excluded.comment
    `).run(student_id, actualLessonId, sGroupId, status || "present", lateness || "on_time", homework || "done", comment || null);

    // Notify curator when student is marked absent
    if ((status || "present") === "absent") {
      try {
        const studentInfo = db.prepare(`
          SELECT s.full_name, g.curator_id, g.name as group_name, g.avatar_url as group_avatar
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

router.get('/marked-lessons', (req, res) => {
  try {
    const { from, to, teacher_id } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    const params = [from, to];
    let teacherClause = "";
    if (teacher_id) {
      teacherClause = " AND sch.teacher_id = ?";
      params.push(parseInt(teacher_id));
    }

    const rows = db.prepare(`
      SELECT DISTINCT l.schedule_id, l.date
      FROM lessons l
      JOIN attendance a ON a.lesson_id = l.id
      JOIN schedule sch ON sch.id = l.schedule_id
      WHERE l.date BETWEEN ? AND ?${teacherClause}
      ORDER BY l.date
    `).all(...params);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
