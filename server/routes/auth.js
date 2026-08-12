import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logAction } from "../utils.js";

const upload = multer({ dest: 'uploads/' });
const JWT_SECRET = process.env.JWT_SECRET || "today_crm_super_secret_key_123!";

export default function(db, loginLimiter, handleAvatarUpload) {
  const router = express.Router();

router.post("/", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = db.prepare(`
      SELECT u.id, u.name, u.surname, u.email, u.phone, u.password, u.avatar_url, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?
    `).get(email);

    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    
    // We expect ALL passwords to be hashed with bcrypt now (due to migration)
    if (!user.password || !user.password.startsWith("$2")) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) return res.status(401).json({ error: "Invalid email or password" });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" } // Token valid for 7 days
    );

    logAction(req, { action: "login", entityType: "user", entityId: user.id, entityName: user.name + " " + user.surname, userId: user.id, userName: user.name + " " + user.surname });
    res.json({ 
      id: user.id.toString(), 
      email: user.email, 
      full_name: user.name + " " + user.surname, 
      role: user.role, 
      avatar_url: user.avatar_url || null,
      token 
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

  return router;
};
