import express from "express";
import { db } from "../db.js";
import { logAction, generateLessonDates, checkConflicts } from "../utils.js";
import crypto from "crypto";

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { teacher_id } = req.query;
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
    if (teacher_id) { query += " WHERE s.teacher_id = ?"; params.push(parseInt(teacher_id)); }
    query += " ORDER BY ts.start_time, g.name";
    const rows = db.prepare(query).all(...params);

    // Attach student_ids for custom (non-group) entries
    const stmtStudents = db.prepare("SELECT student_id FROM schedule_students WHERE schedule_id = ?");
    const result = rows.map(r => ({
      ...r,
      student_ids: r.group_id ? [] : stmtStudents.all(r.id).map(s => s.student_id),
    }));
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', (req, res) => {
  try {
    const { group_id, subject_id, teacher_id, room_id, time_slot_id, cycle, student_ids, custom_label } = req.body;
    if (!subject_id || !teacher_id || !room_id || !time_slot_id || !cycle)
      return res.status(400).json({ error: "subject_id, teacher_id, room_id, time_slot_id, cycle are required" });
    if (!group_id && (!student_ids || student_ids.length === 0))
      return res.status(400).json({ error: "Either group_id or student_ids[] required" });

    // Resolve actual student IDs for the conflict check
    const resolvedStudentIds = group_id
      ? db.prepare("SELECT id FROM students WHERE group_id = ? AND status = 'active'").all(group_id).map(s => s.id)
      : student_ids;

    // Per-student + teacher conflict check (time overlap)
    const conflicts = checkConflicts({ teacher_id, time_slot_id, cycle, group_id, student_ids: resolvedStudentIds });
    if (conflicts.length > 0) {
      const msg = conflicts.map(c => c.message).join("\n");
      return res.status(409).json({ error: msg, conflicts });
    }

    const result = db.prepare(
      "INSERT INTO schedule (group_id, subject_id, teacher_id, room_id, time_slot_id, cycle, custom_label) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(group_id || null, subject_id, teacher_id, room_id, time_slot_id, cycle, custom_label || null);

    // Insert custom student assignments if no group
    if (!group_id && student_ids && student_ids.length > 0) {
      const insert = db.prepare("INSERT INTO schedule_students (schedule_id, student_id) VALUES (?, ?)");
      for (const sid of student_ids) insert.run(result.lastInsertRowid, sid);
    }

    const created = db.prepare(`
      SELECT s.*, g.name as group_name, g.avatar_url as group_avatar, subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name, r.name as room_name,
             ts.start_time, ts.end_time, ts.label as time_label
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN users u ON s.teacher_id = u.id LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    // Attach student_ids to response
    const sids = !group_id
      ? db.prepare("SELECT student_id FROM schedule_students WHERE schedule_id = ?").all(result.lastInsertRowid).map(s => s.student_id)
      : [];

    const label = created?.group_name || created?.custom_label || 'Сводная группа';
    logAction(req, { action: "create", entityType: "schedule", entityId: result.lastInsertRowid, entityName: label + ' / ' + created?.subject_name });
    res.json({ ...created, student_ids: sids });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { group_id, subject_id, teacher_id, room_id, time_slot_id, cycle, student_ids, custom_label } = req.body;
    const id = parseInt(req.params.id);

    const resolvedStudentIds = group_id
      ? db.prepare("SELECT id FROM students WHERE group_id = ? AND status = 'active'").all(group_id).map(s => s.id)
      : (student_ids || []);

    // Conflict check excluding current entry (time overlap)
    const conflicts = checkConflicts({ teacher_id, time_slot_id, cycle, exclude_id: id, group_id, student_ids: resolvedStudentIds });
    if (conflicts.length > 0) {
      const msg = conflicts.map(c => c.message).join("\n");
      return res.status(409).json({ error: msg, conflicts });
    }

    db.prepare(
      "UPDATE schedule SET group_id=?, subject_id=?, teacher_id=?, room_id=?, time_slot_id=?, cycle=?, custom_label=? WHERE id=?"
    ).run(group_id || null, subject_id, teacher_id, room_id, time_slot_id, cycle, custom_label || null, id);

    // Rebuild custom student assignments
    db.prepare("DELETE FROM schedule_students WHERE schedule_id = ?").run(id);
    if (!group_id && student_ids && student_ids.length > 0) {
      const insert = db.prepare("INSERT INTO schedule_students (schedule_id, student_id) VALUES (?, ?)");
      for (const sid of student_ids) insert.run(id, sid);
    }

    const updated = db.prepare(`
      SELECT s.*, g.name as group_name, g.avatar_url as group_avatar, subj.name as subject_name,
             u.name || ' ' || u.surname as teacher_name, r.name as room_name,
             ts.start_time, ts.end_time, ts.label as time_label
      FROM schedule s
      LEFT JOIN groups g ON s.group_id = g.id LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN users u ON s.teacher_id = u.id LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      WHERE s.id = ?
    `).get(id);

    const sids = !group_id
      ? db.prepare("SELECT student_id FROM schedule_students WHERE schedule_id = ?").all(id).map(s => s.student_id)
      : [];

    logAction(req, { action: "update", entityType: "schedule", entityId: id, entityName: (updated?.group_name || updated?.custom_label || 'Сводная') + ' / ' + updated?.subject_name });
    res.json({ ...updated, student_ids: sids });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/clear', (req, res) => {
  try {
    const cycle = req.query.cycle;
    db.transaction(() => {
      if (cycle) {
        db.prepare("DELETE FROM attendance WHERE lesson_id IN (SELECT l.id FROM lessons l JOIN schedule s ON l.schedule_id = s.id WHERE s.cycle = ?)").run(cycle);
        db.prepare("DELETE FROM schedule WHERE cycle = ?").run(cycle);
        logAction(req, { action: "clear", entityType: "schedule", entityId: 0, entityName: cycle });
      } else {
        db.prepare("DELETE FROM attendance WHERE lesson_id IN (SELECT id FROM lessons)").run();
        db.prepare("DELETE FROM schedule").run();
        logAction(req, { action: "clear", entityType: "schedule", entityId: 0, entityName: "All" });
      }
    })();
    db.prepare("DELETE FROM time_slots WHERE (label IS NULL OR label = '') AND id NOT IN (SELECT time_slot_id FROM schedule)").run();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    // Get the time_slot_id before deleting
    const entry = db.prepare("SELECT time_slot_id FROM schedule WHERE id = ?").get(req.params.id);
    db.transaction(() => {
      db.prepare("DELETE FROM attendance WHERE lesson_id IN (SELECT id FROM lessons WHERE schedule_id = ?)").run(req.params.id);
      db.prepare("DELETE FROM schedule WHERE id = ?").run(req.params.id);
    })();
    // Clean up orphan custom time_slots (no label = custom) that are no longer referenced
    if (entry) {
      const slot = db.prepare("SELECT id, label FROM time_slots WHERE id = ?").get(entry.time_slot_id);
      if (slot && !slot.label) {
        const refs = db.prepare("SELECT COUNT(*) as cnt FROM schedule WHERE time_slot_id = ?").get(slot.id);
        if (refs.cnt === 0) db.prepare("DELETE FROM time_slots WHERE id = ?").run(slot.id);
      }
    }
    logAction(req, { action: "delete", entityType: "schedule", entityId: Number(req.params.id) });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/:id/move', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { time_slot_id, cycle } = req.body;
    
    if (!time_slot_id || !cycle)
      return res.status(400).json({ error: "Требуются time_slot_id и cycle" });

    // Get current entry
    const current = db.prepare("SELECT group_id, teacher_id FROM schedule WHERE id = ?").get(id);
    if (!current) return res.status(404).json({ error: "Entry not found" });

    const newTeacherId = req.body.teacher_id || current.teacher_id;
    const newGroupId = req.body.group_id || current.group_id;

    // Resolve student IDs for this entry
    const resolvedStudentIds = newGroupId
      ? db.prepare("SELECT id FROM students WHERE group_id = ? AND status = 'active'").all(newGroupId).map(s => s.id)
      : db.prepare("SELECT student_id FROM schedule_students WHERE schedule_id = ?").all(id).map(s => s.student_id);

    // Check for conflicts using time overlap formula
    const conflicts = checkConflicts({
      teacher_id: newTeacherId, 
      time_slot_id, 
      cycle,
      exclude_id: id,
      group_id: newGroupId,
      student_ids: resolvedStudentIds,
    });
    
    if (conflicts.length > 0) {
      const msg = conflicts.map(c => c.message).join("\n");
      return res.status(409).json({ error: msg, conflicts });
    }

    db.prepare("UPDATE schedule SET teacher_id = ?, group_id = ?, time_slot_id = ?, cycle = ? WHERE id = ?")
      .run(newTeacherId, newGroupId, time_slot_id, cycle, id);

    const updated = db.prepare(`
      SELECT s.*, g.name as group_name, g.avatar_url as group_avatar, subj.name as subject_name,
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
      newTeacherId, 'schedule',
      'Изменение в расписании',
      updated
        ? `Урок ${updated.group_name || updated.custom_label || 'Сводная группа'} — ${updated.subject_name} перенесён на ${updated.start_time}`
        : 'Ваше расписание было изменено',
      '/calendar'
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/publish', (req, res) => {
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

router.post('/share-token', (req, res) => {
  try {
    const { group_id } = req.body;
    const createdBy = req.user?.id || null;
    const token = crypto.randomBytes(32).toString("hex");
    db.prepare(
      "INSERT INTO schedule_share_tokens (token, group_id, created_by) VALUES (?, ?, ?)"
    ).run(token, group_id || null, createdBy);
    res.json({ token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/share-token/:token', (req, res) => {
  try {
    db.prepare("DELETE FROM schedule_share_tokens WHERE token = ?").run(req.params.token);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/share-tokens', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT t.id, t.token, t.group_id, t.created_at, g.name as group_name, g.avatar_url as group_avatar
      FROM schedule_share_tokens t
      LEFT JOIN groups g ON t.group_id = g.id
      ORDER BY t.created_at DESC
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/check-conflicts', (req, res) => {
  try {
    const { teacher_id, room_id, time_slot_id, cycle, exclude_id } = req.body;
    const conflicts = checkConflicts({ teacher_id, room_id, time_slot_id, cycle, exclude_id });
    res.json({ conflicts, hasConflict: conflicts.length > 0 });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;
