import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { logAction } from "../utils.js";
const upload = multer({ dest: 'uploads/' });

export default function(db, loginLimiter, handleAvatarUpload) {
  const router = express.Router();

router.get("/", (req, res) => {
  try {
    const { limit, offset = "0", search, status, group_id, sort = "full_name", sort_dir = "asc", att_min, att_max, ent_min, ent_max } = req.query;
    const ALLOWED_SORTS = { full_name: "full_name", group_name: "group_name", attendance_rate: "attendance_rate", last_ent_score: "last_ent_score" };
    const sortCol = ALLOWED_SORTS[sort] || "full_name";
    const dir = sort_dir === "desc" ? "DESC" : "ASC";
    const conditions = [];
    const params = [];
    if (search) { 
      const sLower = search.toLowerCase();
      conditions.push("(LOWER_CYR(s.full_name) LIKE ?)"); 
      params.push(`%${sLower}%`); 
    }
    // Default to active students if no status filter specified
    const effectiveStatus = status || 'active';
    if (effectiveStatus !== 'all') { conditions.push("s.status = ?"); params.push(effectiveStatus); }
    if (group_id) { conditions.push("s.group_id = ?"); params.push(parseInt(group_id)); }
    // Enforce students without groups are never shown
    conditions.push("s.group_id IS NOT NULL");
    
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    let outerConditions = [];
    const outerParams = [];
    if (att_min !== undefined) { outerConditions.push(`attendance_rate >= ?`); outerParams.push(parseFloat(att_min)); }
    if (att_max !== undefined) { outerConditions.push(`attendance_rate <= ?`); outerParams.push(parseFloat(att_max)); }
    if (ent_min !== undefined) { outerConditions.push(`last_ent_score >= ?`); outerParams.push(parseFloat(ent_min)); }
    if (ent_max !== undefined) { outerConditions.push(`last_ent_score <= ?`); outerParams.push(parseFloat(ent_max)); }
    const outerWhere = outerConditions.length ? "WHERE " + outerConditions.join(" AND ") : "";

    const baseSelect = `
      SELECT s.id, s.full_name, s.phone, s.parent_phone, s.parent_name, s.group_id, s.status, s.graduation_year, s.avatar_url, g.name as group_name, g.avatar_url as group_avatar,
        att.attendance_rate,
        ent.last_ent_score
      FROM students s 
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN (
        SELECT student_id, ROUND(AVG(CASE WHEN status='present' THEN 1.0 ELSE 0.0 END)*100,1) as attendance_rate
        FROM attendance
        GROUP BY student_id
      ) att ON s.id = att.student_id
      LEFT JOIN (
        SELECT e.student_id, SUM(e.score) as last_ent_score
        FROM ent_results e
        JOIN (SELECT student_id, MAX(month) as max_month FROM ent_results GROUP BY student_id) em 
          ON e.student_id = em.student_id AND e.month = em.max_month
        GROUP BY e.student_id
      ) ent ON s.id = ent.student_id
      ${where}
    `;

    const finalQuery = `SELECT * FROM (${baseSelect}) ${outerWhere} ORDER BY ${sortCol} ${dir}`;

    if (limit !== undefined) {
      const { cnt } = db.prepare(`SELECT COUNT(*) as cnt FROM (${baseSelect}) ${outerWhere}`).get(...params, ...outerParams);
      const students = db.prepare(`${finalQuery} LIMIT ? OFFSET ?`).all(...params, ...outerParams, parseInt(limit), parseInt(offset));
      return res.json({ students, total: cnt });
    }
    res.json(db.prepare(finalQuery).all(...params, ...outerParams));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get("/:id", (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.id, s.full_name, s.phone, s.parent_phone, s.parent_name, s.group_id, s.status, g.name as group_name, g.avatar_url as group_avatar
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

router.post("/", (req, res) => {
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

router.delete("/:id", (req, res) => {
  try {
    const id = req.params.id;
    const st = db.prepare("SELECT full_name FROM students WHERE id = ?").get(id);
    db.prepare("DELETE FROM students WHERE id = ?").run(id);
    logAction(req, { action: "delete", entityType: "student", entityId: Number(id), entityName: st?.full_name });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post("/bulk-archive", (req, res) => {
  try {
    const { graduation_year, studentIds } = req.body;
    if (!graduation_year) return res.status(400).json({ error: "Graduation year is required" });
    
    let updatedCount = 0;
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',');
      const result = db.prepare(`UPDATE students SET status = 'archived', graduation_year = ? WHERE id IN (${placeholders}) AND status = 'active'`).run(graduation_year, ...studentIds);
      updatedCount = result.changes;
      logAction(req, { action: "bulk-archive", entityType: "student", entityId: 0, entityName: `${updatedCount} students` });
    } else {
      const result = db.prepare("UPDATE students SET status = 'archived', graduation_year = ? WHERE status = 'active'").run(graduation_year);
      updatedCount = result.changes;
      logAction(req, { action: "bulk-archive", entityType: "student", entityId: 0, entityName: "All active students" });
    }
    
    res.json({ success: true, updatedCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post("/bulk-import", (req, res) => {
  try {
    const { students, preview, overwriteMode } = req.body;
    if (!Array.isArray(students)) return res.status(400).json({ error: "Invalid data format" });
    
    const allStudents = db.prepare(`SELECT id, full_name FROM students`).all();
    const existingById = new Map(allStudents.map(s => [s.id, s]));
    const existingByName = new Map(allStudents.map(s => [s.full_name.trim().toLowerCase(), s]));

    let existingCount = 0;
    for (const st of students) {
      if (!st.full_name) continue;
      const sId = Number(st.id);
      const hasId = !isNaN(sId) && sId > 0;
      
      let matchedStudent = null;
      if (hasId && existingById.has(sId)) {
        matchedStudent = existingById.get(sId);
      } else if (existingByName.has(st.full_name.trim().toLowerCase())) {
        matchedStudent = existingByName.get(st.full_name.trim().toLowerCase());
      }
      
      if (matchedStudent) {
        st._matchedId = matchedStudent.id;
        existingCount++;
      }
    }
    
    if (preview) {
      return res.json({ success: true, existingCount });
    }

    const insert = db.prepare("INSERT INTO students (id, full_name, phone, parent_name, parent_phone, group_id, status) VALUES (?, ?, ?, ?, ?, ?, 'active')");
    const insertNoId = db.prepare("INSERT INTO students (full_name, phone, parent_name, parent_phone, group_id, status) VALUES (?, ?, ?, ?, ?, 'active')");
    const update = db.prepare("UPDATE students SET full_name = ?, phone = ?, parent_name = ?, parent_phone = ?, group_id = ? WHERE id = ?");
    
    let count = 0;
    let updatedCount = 0;
    
    db.transaction(() => {
      for (const st of students) {
        if (!st.full_name) continue;
        
        if (st._matchedId) {
          if (overwriteMode) {
            update.run(st.full_name, st.phone || null, st.parent_name || null, st.parent_phone || null, st.group_id || null, st._matchedId);
            updatedCount++;
          }
        } else {
          const sId = Number(st.id);
          const hasId = !isNaN(sId) && sId > 0;
          if (hasId) {
            insert.run(sId, st.full_name, st.phone || null, st.parent_name || null, st.parent_phone || null, st.group_id || null);
          } else {
            insertNoId.run(st.full_name, st.phone || null, st.parent_name || null, st.parent_phone || null, st.group_id || null);
          }
          count++;
        }
      }
    })();
    logAction(req, { action: "bulk-import", entityType: "student", entityId: 0, entityName: `${count} inserted, ${updatedCount} updated` });
    res.json({ success: true, importedCount: count, updatedCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get("/:id/ent-certificates", (req, res) => {
  try {
    const certs = db.prepare("SELECT * FROM ent_certificates WHERE student_id = ? ORDER BY exam_type").all(parseInt(req.params.id));
    res.json(certs);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post("/:id/ent-certificates/:type", upload.single("file"), (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const examType = req.params.type;
    const validTypes = ["1000-01", "1000-03", "1001-01", "1001-02"];
    if (!validTypes.includes(examType)) return res.status(400).json({ error: "Invalid exam type" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Remove old file if exists
    const existing = db.prepare("SELECT * FROM ent_certificates WHERE student_id = ? AND exam_type = ?").get(studentId, examType);
    if (existing) {
      try { fs.unlinkSync(path.join(uploadsDir, existing.filename)); } catch {}
      db.prepare("DELETE FROM ent_certificates WHERE student_id = ? AND exam_type = ?").run(studentId, examType);
    }

    const result = db.prepare(
      "INSERT INTO ent_certificates (student_id, exam_type, filename, original_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(studentId, examType, req.file.filename, req.file.originalname, "/uploads/" + req.file.filename, req.file.size, req.body.uploaded_by || null);

    res.json({ id: result.lastInsertRowid, filename: req.file.filename, original_name: req.file.originalname, file_path: "/uploads/" + req.file.filename });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put("/:id", (req, res) => {
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

router.patch("/:id/archive", (req, res) => {
  try {
    db.prepare("UPDATE students SET status = 'archived', group_id = NULL WHERE id = ?").run(req.params.id);
    const student = db.prepare("SELECT full_name FROM students WHERE id = ?").get(req.params.id);
    logAction(req, { action: "archive", entityType: "student", entityId: Number(req.params.id), entityName: student?.full_name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/:id/avatar", handleAvatarUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file provided" });
    const studentId = req.params.id;
    const student = db.prepare("SELECT id, avatar_url FROM students WHERE id = ?").get(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    // Delete old avatar file if exists
    if (student.avatar_url) {
      const oldPath = path.join(__dirname, student.avatar_url);
      try { fs.unlinkSync(oldPath); } catch {}
    }

    const filename = `student_avatar_${studentId}_${Date.now()}.webp`;
    const filePath = path.join(avatarsDir, filename);

    // Resize & crop to 400x400 square, compress as webp
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: "cover", position: "center" })
      .webp({ quality: 80 })
      .toFile(filePath);

    const avatarUrl = `/uploads/avatars/${filename}`;
    db.prepare("UPDATE students SET avatar_url = ? WHERE id = ?").run(avatarUrl, studentId);
    res.json({ avatar_url: avatarUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id/avatar", async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = db.prepare("SELECT id, avatar_url FROM students WHERE id = ?").get(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.avatar_url) {
      const oldPath = path.join(__dirname, student.avatar_url);
      try { fs.unlinkSync(oldPath); } catch {}
    }
    db.prepare("UPDATE students SET avatar_url = NULL WHERE id = ?").run(studentId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/:id/admission", (req, res) => {
  try {
    const { target_university_id, target_specialty_id } = req.body;
    db.prepare(`UPDATE students SET target_university_id=?, target_specialty_id=? WHERE id=?`)
      .run(target_university_id ?? null, target_specialty_id ?? null, parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

  return router;
};
