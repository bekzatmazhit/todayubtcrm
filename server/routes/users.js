import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
const upload = multer({ dest: 'uploads/' });

export default function(db, loginLimiter, handleAvatarUpload) {
  const router = express.Router();

router.get("/", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.surname, u.email, u.phone, u.avatar_url, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.id
    `).all();
    res.json(users);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get("/:id", (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.name, u.surname, u.email, u.phone, u.avatar_url, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post("/", (req, res) => {
  try {
    const { name, surname, phone, email, password, role, avatar_url } = req.body;
    if (!name || !surname) return res.status(400).json({ error: "name and surname required" });
    const roleMap = { admin: 1, umo_head: 2, teacher: 3 };
    const role_id = roleMap[role] ?? 3;
    const rawPwd = password || surname.toLowerCase() + Date.now();
    const pwd = bcrypt.hashSync(rawPwd, 10);
    const result = db.prepare(
      "INSERT INTO users (name, surname, phone, email, password, role_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(name, surname, phone || null, email || null, pwd, role_id, avatar_url || null);
    logAction(req, { action: "create", entityType: "user", entityId: result.lastInsertRowid, entityName: name + " " + surname, details: JSON.stringify({ role, email }) });
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", (req, res) => {
  try {
    const { name, surname, phone, email, role, password, current_password, avatar_url } = req.body;
    const roleMap = { admin: 1, umo_head: 2, teacher: 3 };
    const role_id = role ? roleMap[role] : null;

    // If changing password, verify current password
    if (password) {
      const user = db.prepare("SELECT password FROM users WHERE id = ?").get(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (current_password) {
        const match = user.password && user.password.startsWith("$2") && bcrypt.compareSync(current_password, user.password);
        if (!match) return res.status(400).json({ error: "Текущий пароль неверный" });
      }
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), req.params.id);
    }

    db.prepare(`
      UPDATE users SET
        name       = COALESCE(?, name),
        surname    = COALESCE(?, surname),
        phone      = COALESCE(?, phone),
        email      = COALESCE(?, email),
        role_id    = COALESCE(?, role_id),
        avatar_url = COALESCE(?, avatar_url)
      WHERE id = ?
    `).run(name || null, surname || null, phone || null, email || null, role_id, avatar_url !== undefined ? avatar_url : null, req.params.id);
    logAction(req, { action: "update", entityType: "user", entityId: Number(req.params.id), entityName: (name || '') + ' ' + (surname || ''), details: JSON.stringify({ role, email }) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", (req, res) => {
  try {
    const u = db.prepare("SELECT name, surname FROM users WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    logAction(req, { action: "delete", entityType: "user", entityId: Number(req.params.id), entityName: u ? u.name + " " + u.surname : null });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/:id/avatar", handleAvatarUpload, async (req, res) => {
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

router.delete("/:id/avatar", (req, res) => {
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

router.get("/:id/permissions", (req, res) => {
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

  return router;
};
