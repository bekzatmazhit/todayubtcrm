import express from "express";
import { db } from "../db.js";
import { logAction, generateLessonDates } from "../utils.js";
import crypto from "crypto";

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { month, group_id, status } = req.query;
    let query = `
      SELECT e.id, e.student_id, e.subject_id, e.score, e.month,
             s.full_name as student_name, subj.name as subject_name, s.group_id, g.name as group_name, g.avatar_url as group_avatar
      FROM ent_results e
      JOIN students s ON e.student_id = s.id
      JOIN subjects subj ON e.subject_id = subj.id
      LEFT JOIN groups g ON s.group_id = g.id
    `;
    const conditions = [];
    const params = [];
    const statusFilter = status || 'active';
    if (statusFilter !== 'all') { conditions.push("s.status = ?"); params.push(statusFilter); }
    if (month) { conditions.push("e.month = ?"); params.push(month); }
    if (group_id) { conditions.push("s.group_id = ?"); params.push(parseInt(group_id)); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY s.full_name, subj.name";
    res.json(db.prepare(query).all(...params));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', (req, res) => {
  try {
    const { student_id, subject_id, score, month } = req.body;
    if (!student_id || !subject_id || score === undefined || !month)
      return res.status(400).json({ error: "All fields required" });
    const student = db.prepare("SELECT group_id FROM students WHERE id = ?").get(student_id);
    const sGroupId = student ? student.group_id : null;
    db.prepare(`
      INSERT INTO ent_results (student_id, subject_id, group_id, score, month) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_id, subject_id, month) DO UPDATE SET group_id=excluded.group_id, score=excluded.score
    `).run(student_id, subject_id, sGroupId, score, month);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/batch', (req, res) => {
  try {
    const { scores } = req.body;
    if (!Array.isArray(scores) || scores.length === 0)
      return res.status(400).json({ error: "scores array required" });
    const upsert = db.prepare(`
      INSERT INTO ent_results (student_id, subject_id, group_id, score, month)
      VALUES (?, ?, (SELECT group_id FROM students WHERE id = ?), ?, ?)
      ON CONFLICT(student_id, subject_id, month) DO UPDATE SET group_id = excluded.group_id, score = excluded.score
    `);
    const tx = db.transaction(() => {
      for (const s of scores) {
        if (!s.student_id || !s.subject_id || s.score === undefined || !s.month) continue;
        upsert.run(parseInt(s.student_id), parseInt(s.subject_id), parseInt(s.student_id), parseInt(s.score), s.month);
      }
    });
    tx();
    res.json({ success: true, count: scores.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/', (req, res) => {
  try {
    const { student_id, month } = req.query;
    if (!student_id || !month) return res.status(400).json({ error: "student_id and month required" });
    db.prepare("DELETE FROM ent_results WHERE student_id = ? AND month = ?").run(parseInt(student_id), month);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;
